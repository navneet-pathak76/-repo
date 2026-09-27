import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";

import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import Login from "./login";
import Admin from "./admin";

const ADMIN_UID = "AInbtkxwW0UVMWdh12HCWNcDn1l2";

const APP_VERSION = String(Constants.expoConfig?.version || "1.0.1");

const C = {
  bg: "#F7F8FB",
  card: "#FFFFFF",
  text: "#17191F",
  muted: "#7B7F89",
  blue: "#2455D6",
  green: "#16A66A",
  border: "#E7E9EF",
  softBlue: "#F1F4FF",
  navy: "#151A38",
};

type Tab = "home" | "buy" | "sell" | "mine";

type Tx = {
  id: string;
  type?: string;
  amount?: number;
  rate?: number;
  usdtAmount?: number;
  inrAmount?: number;
  status?: string;
  createdAt?: { toDate?: () => Date } | null;
  adminNote?: string;
  transactionId?: string;
  transactionLink?: string;
  paymentReference?: string;
};

const HOME_MENU: Array<[any, string]> = [
  ["document-text-outline", "Transaction History"],
  ["headset-outline", "Customer Support"],
  ["information-circle-outline", "About Simulation"],
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [amount, setAmount] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState({ rate: 115 });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balanceUsdt, setBalanceUsdt] = useState(0);
  const [release, setRelease] = useState({
    latestVersion: APP_VERSION,
    minimumVersion: "1.0.0",
    apkUrl: "",
    updateMessage: "",
  });
  const [updatePromptShown, setUpdatePromptShown] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkForProductionUpdate = async () => {
      try {
        if (!Updates.isEnabled) return;
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled) await Updates.reloadAsync();
      } catch {
        // Keep the embedded/current update if the OTA service is unavailable.
      }
    };

    checkForProductionUpdate();

  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);



  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(
      doc(db, "appSettings", "release"),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        setRelease({
          latestVersion: String(data.latestVersion || APP_VERSION),
          minimumVersion: String(data.minimumVersion || "1.0.0"),
          apkUrl: String(data.apkUrl || ""),
          updateMessage: String(data.updateMessage || ""),
        });
      }
    );
  }, [user]);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, "appSettings", "runtime"), (snapshot) => {
      setMaintenanceMode(snapshot.exists() && snapshot.data().maintenanceMode === true);
    });
  }, []);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, "appSettings", "public"), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setSettings({ rate: Number(data.rate) || 115 });
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setBalanceUsdt(0);
      return;
    }

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const balance = Number(snapshot.data()?.balanceUsdt || 0);
        setBalanceUsdt(Number.isFinite(balance) && balance >= 0 ? balance : 0);
      },
      () => setBalanceUsdt(0)
    );
  }, [user]);

  useEffect(() => {
    if (!user || !db) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Tx, "id">),
      }));
      rows.sort((a, b) => {
        const ad = a.createdAt?.toDate?.()?.getTime() || 0;
        const bd = b.createdAt?.toDate?.()?.getTime() || 0;
        return bd - ad;
      });
      setTransactions(rows);
    });
  }, [user]);



  const rate = settings.rate || 115;
  const updateRequired = compareVersions(APP_VERSION, release.minimumVersion) < 0;
  const updateAvailable = compareVersions(APP_VERSION, release.latestVersion) < 0;

  useEffect(() => {
    if (!user || !updateAvailable || updatePromptShown || !release.apkUrl) return;
    setUpdatePromptShown(true);
    Alert.alert(
      "Update available",
      release.updateMessage || ("Version " + release.latestVersion + " is available."),
      [
        { text: "Later", style: "cancel" },
        {
          text: "Update",
          onPress: async () => {
            try { await Linking.openURL(release.apkUrl); }
            catch { Alert.alert("Could not open update", "Please contact support for the latest APK."); }
          },
        },
      ]
    );
  }, [user, updateAvailable, updatePromptShown, release]);
  const MIN_USDT = 50;
  const MIN_INR = MIN_USDT * rate;

  const usdtAmount = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) && parsed > 0
      ? (parsed / rate).toFixed(2)
      : "0.00";
  }, [amount, rate]);

  const showAction = (title: string) => {
    Alert.alert(
      title,
      isFirebaseConfigured
        ? "This section is available in the next backend phase."
        : "Demo interface — configure Firebase before using account data."
    );
  };

  const handleRequest = async (type: "buy" | "sell") => {
    if (!user || !db || !isFirebaseConfigured) {
      showAction(type === "buy" ? "Buy request" : "Sell request");
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert("Enter an amount", "Enter a valid amount first.");
      return;
    }

    if (type === "buy" && parsed < MIN_INR) {
      Alert.alert("Minimum buy amount", "Minimum buy amount is ₹" + MIN_INR.toFixed(0) + " (50 USDT).");
      return;
    }

    if (type === "sell" && parsed < MIN_USDT) {
      Alert.alert("Minimum withdrawal", "Minimum withdrawal is 50 USDT.");
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type,
        amount: parsed,
        rate,
        usdtAmount: type === "buy" ? parsed / rate : parsed,
        inrAmount: type === "buy" ? parsed : parsed * rate,
        status: "pending",
        simulated: true,
        createdAt: new Date().toISOString(),
      });
      setAmount("");
      Alert.alert("Simulation submitted", "This simulated transaction is now pending admin review.");
    } catch (error: any) {
      const code = String(error?.code || "");
      if (code.includes("permission-denied")) {
        Alert.alert(
          "Permission denied",
          "The Firestore rules have not been published or do not match this app."
        );
      } else {
        Alert.alert(
          "Could not submit",
          "Firebase rejected the request. Please check the Firebase project configuration."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const latestRequest = transactions[0];

  const copyTransactionLink = async (link: string) => {
    const value = link.trim();
    if (!value) return;

    try {
      await Clipboard.setStringAsync(value);
      Alert.alert("Copied", "Transaction link copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "The transaction link could not be copied.");
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Text style={styles.loading}>Loading…</Text></View>
      </SafeAreaView>
    );
  }

  if (isFirebaseConfigured && !user) return <Login />;
  if (user?.uid === ADMIN_UID && ADMIN_UID) return <Admin />;
  if (maintenanceMode) return <MaintenanceScreen />;
  if (updateRequired) return <UpdateScreen version={release.latestVersion} message={release.updateMessage} apkUrl={release.apkUrl} forced />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.top}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>RP</Text>
            </View>

            <View style={styles.simulationBadge}><Text style={styles.simulationBadgeText}>SIMULATION MODE</Text></View>

            <Pressable hitSlop={10} onPress={() => Alert.alert("Notifications", "No new notifications.")}>
              <Ionicons name="notifications-outline" size={25} color={C.text} />
            </Pressable>
          </View>

          {tab === "home" && (
            <View>
              <View style={styles.balanceCard}>
                <Text style={styles.label}>Simulated Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balance}>{balanceUsdt.toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={22} color={C.muted} />
                </View>
                <Text style={styles.balanceUnit}>USDT</Text>
              </View>

              <View style={styles.simulationBanner}><Text style={styles.simulationBannerTitle}>SIMULATED TRANSACTIONS</Text><Text style={styles.simulationBannerText}>All balances and buy/sell activity are for demonstration only. No real money or crypto is transferred or held.</Text></View>

              <View style={styles.menuCard}>
                {HOME_MENU.map(([icon, title]) => (
                  <MenuRow
                    key={title}
                    icon={icon}
                    title={title}
                    onPress={() => {
                      if (title === "Transaction History") setHistoryOpen(true);
                      else showAction(title);
                    }}
                  />
                ))}
              </View>
            </View>
          )}

          {(tab === "buy" || tab === "sell") && (
            <View style={styles.exchangeCard}>
              <View style={styles.exchangeHeader}>
                <View>
                  <Text style={styles.pageTitle}>{tab === "buy" ? "Simulate Buy" : "Simulate Sell"}</Text>
                  <Text style={styles.rate}>1 USDT = ₹{rate}</Text>
                </View>
                <View style={styles.exchangeIcon}>
                  <Ionicons
                    name={tab === "buy" ? "arrow-down-outline" : "arrow-up-outline"}
                    size={23}
                    color={C.blue}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>
                {tab === "buy" ? "INR Amount" : "USDT Withdrawal Amount"}
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={tab === "buy" ? "Minimum ₹" + MIN_INR.toFixed(0) : "Minimum 50 USDT"}
                placeholderTextColor="#A5A8B0"
                style={styles.input}
              />

              {tab === "buy" ? (
                <View style={styles.quote}>
                  <Text style={styles.quoteLabel}>YOU RECEIVE</Text>
                  <Text style={styles.quoteValue}>{usdtAmount} USDT</Text>
                  <Text style={styles.minimumHint}>Minimum: 50 USDT (₹{MIN_INR.toFixed(0)})</Text>
                </View>
              ) : (
                <View style={styles.quote}>
                  <Text style={styles.quoteLabel}>WITHDRAWAL</Text>
                  <Text style={styles.quoteValue}>Simulate INR withdrawal</Text>
                  <Text style={styles.minimumHint}>Minimum withdrawal: 50 USDT</Text>
                </View>
              )}

              <Pressable
                disabled={submitting}
                style={[styles.primary, submitting && styles.primaryDisabled]}
                onPress={() => handleRequest(tab)}
              >
                <Text style={styles.primaryText}>
                  {submitting
                    ? "Submitting…"
                    : tab === "buy"
                      ? "Submit Simulated Buy"
                      : "Request INR Withdrawal"}
                </Text>
              </Pressable>

              <Text style={styles.helper}>
                Simulation only. No real money or crypto is transferred, held, or settled by this app.
              </Text>

              {latestRequest && latestRequest.type === tab ? (
                <View style={styles.requestStatusCard}>
                  <View style={styles.requestStatusTop}>
                    <View>
                      <Text style={styles.requestStatusLabel}>LATEST REQUEST</Text>
                      <Text style={styles.requestStatusTitle}>
                        {latestRequest.status === "pending"
                          ? "Request submitted"
                          : latestRequest.status === "approved"
                            ? "Approved — details added"
                            : latestRequest.status === "completed"
                              ? "Completed"
                              : "Request rejected"}
                      </Text>
                    </View>
                    <View style={styles.statusPillLarge}>
                      <Text style={styles.statusTextLarge}>{latestRequest.status || "pending"}</Text>
                    </View>
                  </View>
                  {latestRequest.status === "pending" ? (
                    <Text style={styles.requestStatusHint}>Waiting for admin approval. Your request will update automatically when the admin adds the transaction details.</Text>
                  ) : (
                    <View>
                      {latestRequest.transactionId ? <Text style={styles.detailText}>Transaction ID: {latestRequest.transactionId}</Text> : null}
                      {latestRequest.paymentReference ? <Text style={styles.detailText}>Payment reference: {latestRequest.paymentReference}</Text> : null}
                      {latestRequest.adminNote ? <Text style={styles.detailText}>Admin note: {latestRequest.adminNote}</Text> : null}
                      {latestRequest.transactionLink ? (
                        <Pressable style={styles.detailButton} onPress={() => copyTransactionLink(latestRequest.transactionLink || "")}>
                          <Text style={styles.detailButtonText}>Copy transaction link</Text>
                          <Ionicons name="copy-outline" size={15} color="#fff" />
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          )}

          {tab === "mine" && (
            <View style={styles.profileCard}>
              <View style={styles.bigAvatar}>
                <Text style={styles.bigAvatarText}>RP</Text>
              </View>

              <Text style={styles.profileName} numberOfLines={1}>
                {user?.email || "Demo User"}
              </Text>

              <View style={styles.profileMenu}>
                <MenuRow
                  icon="receipt-outline"
                  title="Transaction history"
                  onPress={() => setHistoryOpen(true)}
                />
>
>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.nav}>
          <TabButton icon="home-outline" label="Home" active={tab === "home"} onPress={() => setTab("home")} />
          <TabButton icon="swap-horizontal-outline" label="Simulate Buy" active={tab === "buy"} onPress={() => setTab("buy")} />
          <TabButton icon="cash-outline" label="Simulate Sell" active={tab === "sell"} onPress={() => setTab("sell")} />
          <TabButton icon="person-outline" label="Mine" active={tab === "mine"} onPress={() => setTab("mine")} />
        </View>

        <Modal
          visible={historyOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setHistoryOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Transaction history</Text>
                <Pressable onPress={() => setHistoryOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={C.text} />
                </Pressable>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="receipt-outline" size={36} color={C.muted} />
                  <Text style={styles.emptyTitle}>No transactions yet</Text>
                  <Text style={styles.emptyText}>Your buy and sell requests will appear here.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {transactions.map((tx) => (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={[styles.txIcon, tx.type === "buy" ? styles.buyIcon : styles.sellIcon]}>
                        <Ionicons
                          name={tx.type === "buy" ? "arrow-down" : "arrow-up"}
                          size={18}
                          color={tx.type === "buy" ? C.green : C.blue}
                        />
                      </View>
                      <View style={styles.txMain}>
                        <Text style={styles.txTitle}>{tx.type === "buy" ? "Buy RP" : "Sell RP"}</Text>
                        <Text style={styles.txAmount}>
                          {tx.type === "buy"
                            ? `₹${Number(tx.inrAmount || tx.amount || 0).toFixed(2)}`
                            : `${Number(tx.usdtAmount || tx.amount || 0).toFixed(2)} USDT`}
                        </Text>
                        <Text style={styles.txMeta}>
                          {tx.createdAt?.toDate?.()
                            ? tx.createdAt.toDate()!.toLocaleString()
                            : "Just now"}
                        </Text>
                        {tx.transactionId ? (
                          <Text style={styles.txMeta}>TX: {tx.transactionId}</Text>
                        ) : null}
                        {tx.status !== "pending" && tx.transactionLink ? (
                          <Pressable onPress={() => copyTransactionLink(tx.transactionLink || "")}>
                            <Text style={styles.txLink}>Copy transaction link</Text>
                          </Pressable>
                        ) : null}
                        {tx.adminNote ? <Text style={styles.txNote}>{tx.adminNote}</Text> : null}
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{tx.status || "pending"}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

    </View>
    </SafeAreaView>
  );
}

function compareVersions(a:string,b:string){
  const aa=a.split(".").map(Number), bb=b.split(".").map(Number);
  for(let i=0;i<3;i++){
    const x=Number.isFinite(aa[i])?aa[i]:0, y=Number.isFinite(bb[i])?bb[i]:0;
    if(x!==y)return x-y;
  }
  return 0;
}

function UpdateScreen({version,message,apkUrl,forced}:{version:string;message:string;apkUrl:string;forced?:boolean}){
  const [dismissed,setDismissed]=useState(false);
  const openUpdate=async()=>{
    if(!apkUrl.trim()){
      Alert.alert("Update unavailable","The admin has not published an update URL yet.");
      return;
    }
    try{await Linking.openURL(apkUrl.trim());}
    catch{Alert.alert("Could not open update","Please contact support for the latest APK.");}
  };
  if(!forced && dismissed) return null;

  return <SafeAreaView style={styles.maintenanceSafe}>
    <View style={styles.maintenanceCard}>
      <View style={styles.maintenanceIcon}><Ionicons name="cloud-download-outline" size={30} color={C.blue}/></View>
      <Text style={styles.maintenanceTitle}>{forced?"UPDATE REQUIRED":"UPDATE AVAILABLE"}</Text>
      <Text style={styles.maintenanceText}>{message||"A newer version of RP Exchange is available."}</Text>
      <Text style={[styles.maintenanceText,{marginTop:8,fontWeight:"700"}]}>Latest version: {version}</Text>
      <Pressable style={[styles.primary,{marginTop:18,width:"100%"}]} onPress={openUpdate}>
        <Text style={styles.primaryText}>Update App</Text>
      </Pressable>
      {!forced?<Pressable style={{marginTop:12}} onPress={()=>setDismissed(true)}>
        <Text style={styles.maintenanceText}>Continue with current version</Text>
      </Pressable>:null}
    </View>
  </SafeAreaView>;
}

function LoadingScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: C.text }}>Loading…</Text>
    </SafeAreaView>
  );
}

function MaintenanceScreen() {
  return (
    <SafeAreaView style={styles.maintenanceSafe}>
      <View style={styles.maintenanceCard}>
        <View style={styles.maintenanceIcon}>
          <Ionicons name="lock-closed-outline" size={30} color={C.blue} />
        </View>
        <Text style={styles.maintenanceTitle}>COMING SOON</Text>
        <Text style={styles.maintenanceText}>Platform permanently unavailable.</Text>
      </View>
    </SafeAreaView>
  );
}

function MenuRow({
  icon,
  title,
  onPress,
}: {
  icon: any;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={22} color={C.text} />
      </View>
      <Text style={styles.menuTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={19} color={C.muted} />
    </Pressable>
  );
}

function TabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Ionicons name={icon} size={23} color={active ? C.blue : "#8B8F99"} />
      <Text style={[styles.tabText, active && { color: C.blue }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  simulationBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#EEF2FF" },
  simulationBadgeText: { fontSize: 10, fontWeight: "900", color: C.blue, letterSpacing: 0.8 },
  simulationBanner: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 14 },
  simulationBannerTitle: { fontSize: 12, fontWeight: "900", color: C.blue, letterSpacing: 0.8, marginBottom: 6 },
  simulationBannerText: { fontSize: 12, lineHeight: 18, color: C.muted },
  safe: { flex: 1, backgroundColor: C.bg },
  maintenanceSafe: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  maintenanceCard: { width: "100%", maxWidth: 420, backgroundColor: C.card, borderRadius: 24, padding: 28, alignItems: "center", borderWidth: 1, borderColor: C.border },
  maintenanceIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.softBlue, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  maintenanceTitle: { fontSize: 28, fontWeight: "900", color: C.text, letterSpacing: 1 },
  maintenanceText: { fontSize: 14, color: C.muted, textAlign: "center", marginTop: 8 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { color: C.muted, fontSize: 14 },
  scroll: { padding: 16, paddingTop: 10, paddingBottom: 104 },
  top: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  invite: {
    flex: 1, height: 44, backgroundColor: "#fff", borderRadius: 22,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: C.border,
  },
  inviteLabel: { fontSize: 12, color: C.muted, fontWeight: "600" },
  inviteCode: { flex: 1, fontSize: 14, fontWeight: "800", color: C.text },
  balanceCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 20,
    marginBottom: 14, borderWidth: 1, borderColor: C.border,
  },
  label: { fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: "600" },
  balanceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balance: { fontSize: 36, fontWeight: "800", color: C.text },
  balanceUnit: { color: C.muted, fontSize: 12, marginTop: 2, fontWeight: "700" },
  teamBanner: {
    borderRadius: 20, padding: 18, flexDirection: "row",
    alignItems: "center", marginBottom: 14, overflow: "hidden",
  },
  teamContent: { flex: 1 },
  teamSmall: { fontSize: 11, color: C.blue, fontWeight: "800", letterSpacing: 1, marginBottom: 5 },
  teamTitle: { fontSize: 24, fontWeight: "900", color: C.text, lineHeight: 27 },
  teamSubtitle: { fontSize: 14, color: C.text, marginBottom: 13 },
  blueButton: {
    alignSelf: "flex-start", backgroundColor: C.blue, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row",
    alignItems: "center", gap: 6,
  },
  blueButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  menuCard: {
    backgroundColor: C.card, borderRadius: 18, overflow: "hidden",
    borderWidth: 1, borderColor: C.border,
  },
  menuRow: {
    minHeight: 58, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  menuIcon: { width: 38, alignItems: "center" },
  menuTitle: { flex: 1, fontSize: 15.5, fontWeight: "650", color: C.text },
  nav: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 78,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: "row", justifyContent: "space-around", paddingTop: 9,
  },
  tab: { alignItems: "center", minWidth: 70 },
  tabText: { fontSize: 11, color: "#8B8F99", marginTop: 3, fontWeight: "600" },
  exchangeCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 20,
    marginTop: 4, borderWidth: 1, borderColor: C.border,
  },
  exchangeHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 24,
  },
  pageTitle: { fontSize: 29, fontWeight: "800", color: C.text },
  rate: { fontSize: 14, color: C.green, fontWeight: "800", marginTop: 5 },
  exchangeIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.softBlue,
    alignItems: "center", justifyContent: "center",
  },
  inputLabel: { fontSize: 13, color: C.muted, marginBottom: 8, fontWeight: "700" },
  input: {
    height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 15,
    paddingHorizontal: 16, fontSize: 19, color: C.text, marginBottom: 16,
    backgroundColor: "#fff",
  },
  quote: {
    backgroundColor: C.softBlue, borderRadius: 16, padding: 17, marginBottom: 16,
  },
  quoteLabel: { fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: "800", letterSpacing: 0.5 },
  quoteValue: { fontSize: 26, fontWeight: "800", color: C.blue },
  minimumHint: { fontSize: 11, color: C.muted, marginTop: 6, fontWeight: "600" },
  primary: {
    backgroundColor: C.blue, borderRadius: 15, height: 54,
    alignItems: "center", justifyContent: "center",
  },
  primaryDisabled: { opacity: 0.65 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15.5 },
  helper: {
    fontSize: 11, color: C.muted, lineHeight: 16,
    textAlign: "center", marginTop: 10, paddingHorizontal: 8,
  },
  requestStatusCard: {
    marginTop: 16, borderRadius: 16, padding: 15, backgroundColor: "#F7F8FB",
    borderWidth: 1, borderColor: C.border,
  },
  requestStatusTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  requestStatusLabel: { fontSize: 10, color: C.muted, fontWeight: "800", letterSpacing: 0.7 },
  requestStatusTitle: { fontSize: 15, color: C.text, fontWeight: "800", marginTop: 4 },
  statusPillLarge: { backgroundColor: "#E9ECF2", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  statusTextLarge: { fontSize: 10, color: C.text, fontWeight: "800", textTransform: "capitalize" },
  requestStatusHint: { fontSize: 11, lineHeight: 16, color: C.muted, marginTop: 10 },
  detailText: { fontSize: 11.5, lineHeight: 17, color: C.text, marginTop: 7 },
  detailButton: { marginTop: 11, alignSelf: "flex-start", backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  detailButtonText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  profileCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 20,
    alignItems: "center", borderWidth: 1, borderColor: C.border,
  },
  bigAvatar: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: C.navy,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  bigAvatarText: { color: "#fff", fontSize: 23, fontWeight: "800" },
  profileName: { width: "100%", fontSize: 20, fontWeight: "800", color: C.text, textAlign: "center" },
  profileInvite: {
    marginTop: 7, marginBottom: 20, backgroundColor: C.bg, borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 8, flexDirection: "row", gap: 8,
  },
  profileMuted: { fontSize: 12, color: C.muted },
  profileCode: { fontSize: 12, fontWeight: "800", color: C.text },
  profileMenu: { width: "100%", borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: "hidden" },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "78%", backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18,
  },
  sheetSmall: {
    backgroundColor: "#fff", borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 18, minHeight: 260,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#D5D7DD",
    alignSelf: "center", marginBottom: 15,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  sheetTitle: { fontSize: 21, fontWeight: "800", color: C.text },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 45 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginTop: 10 },
  emptyText: { fontSize: 12, color: C.muted, marginTop: 5, textAlign: "center" },
  txRow: {
    flexDirection: "row", alignItems: "flex-start", paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", marginRight: 11,
  },
  buyIcon: { backgroundColor: "#EAF8F1" },
  sellIcon: { backgroundColor: "#EEF2FF" },
  txMain: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  txAmount: { fontSize: 15, fontWeight: "800", color: C.blue, marginTop: 2 },
  txMeta: { fontSize: 10.5, color: C.muted, marginTop: 3 },
  txNote: { fontSize: 11, color: C.text, marginTop: 5 },
  txLink: { fontSize: 11, color: C.blue, fontWeight: "800", marginTop: 5 },
  statusPill: {
    backgroundColor: "#F2F3F6", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5, marginLeft: 6,
  },
  statusText: { fontSize: 10, color: C.text, fontWeight: "800", textTransform: "capitalize" },
  paymentBox: {
    borderWidth: 1, borderColor: C.border, borderRadius: 16,
    padding: 16, backgroundColor: C.softBlue,
  },
  paymentTitle: { fontSize: 14, fontWeight: "800", color: C.text, marginTop: 9 },
  paymentValue: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 18 },
  paymentHint: { fontSize: 11, color: C.muted, lineHeight: 16, marginTop: 12 },
});
