import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import Login from "./login";
import Admin from "./admin";

const ADMIN_UID = "AInbtkxwW0UVMWdh12HCWNcDn1l2";

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
  ["people-outline", "My Team"],
  ["gift-outline", "Rebate Rewards"],
  ["document-text-outline", "Transaction History"],
  ["headset-outline", "Customer Support"],
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [amount, setAmount] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState({ rate: 110, paymentAddress: "", qrUrl: "" });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      setSettings({
        rate: Number(data.rate) || 110,
        paymentAddress: String(data.paymentAddress || ""),
        qrUrl: String(data.qrUrl || ""),
      });
    });
  }, []);

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

  useEffect(() => {
    if (!user || !db) return;
    setDoc(
      doc(db, "users", user.uid),
      { email: user.email || "", updatedAt: serverTimestamp() },
      { merge: true }
    ).catch(() => undefined);
  }, [user]);

  const rate = settings.rate || 110;

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
        createdAt: serverTimestamp(),
      });
      setAmount("");
      Alert.alert("Request submitted", "Your request is now pending admin review.");
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

  const shareInvite = async () => {
    try {
      await Share.share({
        message: "Join RP Exchange using my invite code: 5z3xIkYy",
      });
    } catch {
      // User cancelled sharing.
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Text style={styles.loading}>Loading…</Text></View>
      </SafeAreaView>
    );
  }

  if (maintenanceMode) return <MaintenanceScreen />;
  if (isFirebaseConfigured && !user) return <Login />;
  if (user?.uid === ADMIN_UID && ADMIN_UID) return <Admin />;

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

            <View style={styles.invite}>
              <Text style={styles.inviteLabel}>Invite</Text>
              <Text style={styles.inviteCode}>5z3xIkYy</Text>
              <Pressable
                hitSlop={10}
                onPress={() => Alert.alert("Invite code", "5z3xIkYy")}
              >
                <Ionicons name="copy-outline" size={20} color={C.muted} />
              </Pressable>
            </View>

            <Pressable hitSlop={10} onPress={() => Alert.alert("Notifications", "No new notifications.")}>
              <Ionicons name="notifications-outline" size={25} color={C.text} />
            </Pressable>
          </View>

          {tab === "home" && (
            <View>
              <View style={styles.balanceCard}>
                <Text style={styles.label}>Current Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balance}>89.1</Text>
                  <Ionicons name="chevron-forward" size={22} color={C.muted} />
                </View>
                <Text style={styles.balanceUnit}>USDT</Text>
              </View>

              <LinearGradient
                colors={["#EEF1FF", "#E7ECFF"]}
                style={styles.teamBanner}
              >
                <View style={styles.teamContent}>
                  <Text style={styles.teamSmall}>MY TEAM</Text>
                  <Text style={styles.teamTitle}>3-LEVEL</Text>
                  <Text style={styles.teamSubtitle}>rebate mechanism</Text>
                  <Pressable
                    style={styles.blueButton}
                    onPress={() => showAction("My team")}
                  >
                    <Text style={styles.blueButtonText}>View earnings</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </Pressable>
                </View>
                <Ionicons name="people" size={58} color={C.blue} />
              </LinearGradient>

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
                  <Text style={styles.pageTitle}>{tab === "buy" ? "Buy RP" : "Sell RP"}</Text>
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
                {tab === "buy" ? "INR Amount" : "USDT Quantity"}
              </Text>

              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={tab === "buy" ? "Enter INR amount" : "Enter USDT quantity"}
                placeholderTextColor="#A5A8B0"
                style={styles.input}
              />

              <View style={styles.quote}>
                <Text style={styles.quoteLabel}>
                  {tab === "buy" ? "YOU RECEIVE" : "YOU RECEIVE"}
                </Text>
                <Text style={styles.quoteValue}>
                  {tab === "buy"
                    ? `${usdtAmount} USDT`
                    : `₹${(Number(amount || 0) * rate).toFixed(2)}`}
                </Text>
              </View>

              <Pressable
                disabled={submitting}
                style={[styles.primary, submitting && styles.primaryDisabled]}
                onPress={() => handleRequest(tab)}
              >
                <Text style={styles.primaryText}>
                  {submitting
                    ? "Submitting…"
                    : tab === "buy"
                      ? "Submit Buy Request"
                      : "Submit Sell Request"}
                </Text>
              </Pressable>

              <Text style={styles.helper}>
                Requests are reviewed by admin. No crypto is transferred or held by this app.
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
                        <Pressable style={styles.detailButton} onPress={() => Alert.alert("Transaction link", latestRequest.transactionLink || "")}>
                          <Text style={styles.detailButtonText}>View transaction details</Text>
                          <Ionicons name="open-outline" size={15} color="#fff" />
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
              <View style={styles.profileInvite}>
                <Text style={styles.profileMuted}>Invite code</Text>
                <Text style={styles.profileCode}>5z3xIkYy</Text>
              </View>

              <View style={styles.profileMenu}>
                <MenuRow
                  icon="receipt-outline"
                  title="Transaction history"
                  onPress={() => setHistoryOpen(true)}
                />
                <MenuRow
                  icon="wallet-outline"
                  title="Payment methods"
                  onPress={() => setPaymentOpen(true)}
                />
                <MenuRow
                  icon="share-social-outline"
                  title="Share invitation"
                  onPress={shareInvite}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.nav}>
          <TabButton icon="home-outline" label="Home" active={tab === "home"} onPress={() => setTab("home")} />
          <TabButton icon="swap-horizontal-outline" label="Buy RP" active={tab === "buy"} onPress={() => setTab("buy")} />
          <TabButton icon="cash-outline" label="Sell RP" active={tab === "sell"} onPress={() => setTab("sell")} />
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
                          <Pressable onPress={() => Alert.alert("Transaction link", tx.transactionLink || "")}>
                            <Text style={styles.txLink}>View transaction details</Text>
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

        <Modal
          visible={paymentOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPaymentOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.sheetSmall}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Payment methods</Text>
                <Pressable onPress={() => setPaymentOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={24} color={C.text} />
                </Pressable>
              </View>
              <View style={styles.paymentBox}>
                <Ionicons name="wallet-outline" size={28} color={C.blue} />
                <Text style={styles.paymentTitle}>USDT payment address</Text>
                <Text style={styles.paymentValue}>
                  {settings.paymentAddress || "Not configured by admin"}
                </Text>
              </View>
              <Text style={styles.paymentHint}>
                Payment details are controlled by the admin account.
              </Text>
            </View>
          </View>
        </Modal>
      </View>
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
