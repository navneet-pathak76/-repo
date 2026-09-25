import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { auth, db, isFirebaseConfigured } from "../lib/firebase";
import Login from "./login";

const C = {
  bg: "#F7F7FA",
  card: "#FFFFFF",
  text: "#17191F",
  muted: "#7B7F89",
  blue: "#2455D6",
  green: "#16A66A",
  border: "#E8E9EE",
};

type Tab = "home" | "buy" | "sell" | "mine";

const HOME_MENU = [
  ["people-outline", "My Team"],
  ["gift-outline", "Rebate Rewards"],
  ["document-text-outline", "Transaction History"],
  ["headset-outline", "Customer Support"],
] as const;

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [amount, setAmount] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState({
    rate: 110,
    paymentAddress: "",
    qrUrl: "",
  });
  const [loading, setLoading] = useState(true);

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
    if (!user || !db) return;

    setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }, [user]);

  const rate = settings.rate || 110;

  const usdt = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return "0.00";
    return (value / rate).toFixed(2);
  }, [amount, rate]);

  const action = (title: string) => {
    Alert.alert(
      title,
      isFirebaseConfigured
        ? "This action is ready for backend wiring."
        : "Demo interface — configure Firebase before using account data."
    );
  };

  const request = async (type: "buy" | "sell") => {
    if (!user || !db) {
      action(type === "buy" ? "Buy request" : "Sell request");
      return;
    }

    const value = Number(amount);

    if (!value || value <= 0) {
      Alert.alert("Enter an amount", "Enter a valid amount first.");
      return;
    }

    try {
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type,
        amount: value,
        rate,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "Request submitted",
        "Your request was recorded with status: pending."
      );
      setAmount("");
    } catch {
      Alert.alert(
        "Could not submit",
        "Check your Firebase configuration and Firestore rules."
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isFirebaseConfigured && !user) {
    return <Login />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Header onCopy={() => action("Invite code copied")} />

          {tab === "home" && (
            <HomeContent onAction={action} />
          )}

          {(tab === "buy" || tab === "sell") && (
            <ExchangeCard
              tab={tab}
              amount={amount}
              setAmount={setAmount}
              rate={rate}
              usdt={usdt}
              onSubmit={request}
            />
          )}

          {tab === "mine" && (
            <ProfileContent
              email={user?.email}
              onAction={action}
            />
          )}
        </ScrollView>

        <BottomNavigation tab={tab} setTab={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Header({ onCopy }: { onCopy: () => void }) {
  return (
    <View style={styles.top}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>RP</Text>
      </View>

      <View style={styles.invite}>
        <Text style={styles.inviteLabel}>Invite Code:</Text>
        <Text style={styles.inviteCode}>5z3xIkYy</Text>

        <Pressable onPress={onCopy}>
          <Ionicons name="copy-outline" size={18} color={C.muted} />
        </Pressable>
      </View>

      <Ionicons
        name="notifications-outline"
        size={24}
        color={C.text}
      />
    </View>
  );
}

function HomeContent({ onAction }: { onAction: (title: string) => void }) {
  return (
    <View>
      <View style={styles.balanceCard}>
        <Text style={styles.label}>Current Balance</Text>

        <View style={styles.balanceRow}>
          <Text style={styles.balance}>89.1</Text>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </View>
      </View>

      <LinearGradient
        colors={["#EEF1FF", "#E7ECFF"]}
        style={styles.teamBanner}
      >
        <View style={styles.teamCopy}>
          <Text style={styles.teamSmall}>My team</Text>

          <Text style={styles.teamTitle}>
            3-LEVEL{" "}
            <Text style={styles.teamTitleLight}>rebate mechanism</Text>
          </Text>

          <Pressable
            style={styles.blueButton}
            onPress={() => onAction("View earnings")}
          >
            <Text style={styles.blueButtonText}>View earnings ›</Text>
          </Pressable>
        </View>

        <Ionicons name="people" size={48} color={C.blue} />
      </LinearGradient>

      {HOME_MENU.map(([icon, title]) => (
        <MenuRow
          key={title}
          icon={icon}
          title={title}
          onPress={() => onAction(title)}
        />
      ))}
    </View>
  );
}

function ExchangeCard({
  tab,
  amount,
  setAmount,
  rate,
  usdt,
  onSubmit,
}: {
  tab: "buy" | "sell";
  amount: string;
  setAmount: (value: string) => void;
  rate: number;
  usdt: string;
  onSubmit: (type: "buy" | "sell") => void;
}) {
  const isBuy = tab === "buy";
  const quote = isBuy
    ? usdt + " USDT"
    : "₹" + (Number(amount || 0) * rate).toFixed(2);

  return (
    <View style={styles.exchangeCard}>
      <Text style={styles.pageTitle}>{isBuy ? "Buy RP" : "Sell RP"}</Text>

      <Text style={styles.rate}>Rate: 1 USDT = ₹{rate}</Text>

      <Text style={styles.inputLabel}>
        {isBuy ? "INR Amount" : "USDT Quantity"}
      </Text>

      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={isBuy ? "Enter INR amount" : "Enter USDT quantity"}
        style={styles.input}
      />

      <View style={styles.quote}>
        <Text style={styles.quoteLabel}>
          {isBuy ? "USDT Amount" : "INR Amount"}
        </Text>

        <Text style={styles.quoteValue}>{quote}</Text>
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => onSubmit(tab)}
      >
        <Text style={styles.primaryText}>
          {isBuy ? "Submit Buy Request" : "Submit Sell Request"}
        </Text>
      </Pressable>

      <Text style={styles.helper}>
        Requests are recorded for review. This app does not transfer or
        custody crypto assets.
      </Text>
    </View>
  );
}

function ProfileContent({
  email,
  onAction,
}: {
  email?: string | null;
  onAction: (title: string) => void;
}) {
  return (
    <View style={styles.profileCard}>
      <View style={styles.bigAvatar}>
        <Text style={styles.bigAvatarText}>RP</Text>
      </View>

      <Text style={styles.profileName}>{email || "Demo User"}</Text>
      <Text style={styles.profileMuted}>Invite Code: 5z3xIkYy</Text>

      <MenuRow
        icon="receipt-outline"
        title="Transaction history"
        onPress={() => onAction("Transaction history")}
      />
      <MenuRow
        icon="wallet-outline"
        title="Payment methods"
        onPress={() => onAction("Payment methods")}
      />
      <MenuRow
        icon="share-social-outline"
        title="Share invitation"
        onPress={() => onAction("Share invitation")}
      />
    </View>
  );
}

function MenuRow({
  icon,
  title,
  onPress,
}: {
  icon: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon as any} size={22} color={C.text} />
      </View>

      <Text style={styles.menuTitle}>{title}</Text>

      <Ionicons name="chevron-forward" size={19} color={C.muted} />
    </Pressable>
  );
}

function BottomNavigation({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
}) {
  return (
    <View style={styles.nav}>
      <TabButton
        icon="home-outline"
        label="Home"
        active={tab === "home"}
        onPress={() => setTab("home")}
      />
      <TabButton
        icon="swap-horizontal-outline"
        label="Buy RP"
        active={tab === "buy"}
        onPress={() => setTab("buy")}
      />
      <TabButton
        icon="cash-outline"
        label="Sell RP"
        active={tab === "sell"}
        onPress={() => setTab("sell")}
      />
      <TabButton
        icon="person-outline"
        label="Mine"
        active={tab === "mine"}
        onPress={() => setTab("mine")}
      />
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Ionicons
        name={icon as any}
        size={23}
        color={active ? C.blue : "#8B8F99"}
      />
      <Text
        style={[
          styles.tabText,
          active && { color: C.blue },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: 16,
    paddingBottom: 110,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#222C55",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  invite: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inviteLabel: {
    fontSize: 12,
    color: C.muted,
  },
  inviteCode: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
  },
  balanceCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: {
    fontSize: 14,
    color: C.muted,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balance: {
    fontSize: 34,
    fontWeight: "700",
    color: C.text,
  },
  teamBanner: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    marginBottom: 12,
    overflow: "hidden",
  },
  teamCopy: {
    flex: 1,
  },
  teamSmall: {
    fontSize: 14,
    color: C.blue,
    fontWeight: "700",
    marginBottom: 6,
  },
  teamTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: C.text,
    marginBottom: 12,
  },
  teamTitleLight: {
    fontWeight: "400",
  },
  blueButton: {
    alignSelf: "flex-start",
    backgroundColor: C.blue,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  blueButtonText: {
    color: C.card,
    fontSize: 12,
    fontWeight: "800",
  },
  menuRow: {
    minHeight: 58,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  menuIcon: {
    width: 38,
    alignItems: "center",
  },
  menuTitle: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: "600",
    color: C.text,
  },
  nav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 9,
  },
  tab: {
    alignItems: "center",
    minWidth: 70,
  },
  tabText: {
    fontSize: 11,
    color: "#8B8F99",
    marginTop: 3,
    fontWeight: "600",
  },
  exchangeCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: C.text,
    marginBottom: 8,
  },
  rate: {
    fontSize: 13,
    color: C.green,
    fontWeight: "700",
    marginBottom: 22,
  },
  inputLabel: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 7,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 18,
    color: C.text,
    marginBottom: 15,
  },
  quote: {
    backgroundColor: "#F2F5FF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  quoteLabel: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 5,
  },
  quoteValue: {
    fontSize: 25,
    fontWeight: "800",
    color: C.blue,
  },
  primary: {
    backgroundColor: C.blue,
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: {
    color: C.card,
    fontWeight: "800",
    fontSize: 15,
  },
  helper: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 12,
  },
  profileCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  bigAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#222C55",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  bigAvatarText: {
    color: C.card,
    fontSize: 22,
    fontWeight: "800",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
  },
  profileMuted: {
    fontSize: 13,
    color: C.muted,
    marginBottom: 20,
    marginTop: 5,
  },
});
