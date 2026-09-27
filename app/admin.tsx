import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Pressable, Alert } from "react-native";
import { onSnapshot, collection, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../lib/firebase";

const ADMIN_UID = "AInbtkxwW0UVMWdh12HCWNcDn1l2";
const C = {
  bg: "#F7F8FB", card: "#FFFFFF", text: "#17191F", muted: "#7B7F89",
  blue: "#2455D6", green: "#16A66A", red: "#D64545", border: "#E7E9EF",
};

type UserRow = { id: string; email?: string; displayName?: string; balanceUsdt?: number };
type Tx = { id: string; userId?: string; type?: string; amount?: number; rate?: number; usdtAmount?: number; inrAmount?: number; status?: string; simulated?: boolean; balanceAfter?: number };

export default function Admin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rate, setRate] = useState(115);
  const [busy, setBusy] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!db || auth?.currentUser?.uid !== ADMIN_UID) return;
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserRow, "id">) })));
    });
    const unsubTx = onSnapshot(collection(db, "transactions"), snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Tx, "id">) }));
      rows.sort((a, b) => String(b.id).localeCompare(String(a.id)));
      setTransactions(rows);
    });
    const unsubRuntime = onSnapshot(doc(db, "appSettings", "runtime"), snap => {
      setMaintenanceMode(snap.exists() && snap.data().maintenanceMode === true);
    });
    const unsubPublic = onSnapshot(doc(db, "appSettings", "public"), snap => {
      if (snap.exists()) setRate(Number(snap.data().rate) || 115);
    });
    return () => { unsubUsers(); unsubTx(); unsubRuntime(); unsubPublic(); };
  }, []);

  const setMaintenance = async (enabled: boolean) => {
    if (!db) return;
    try {
      setBusy("maintenance");
      await updateDoc(doc(db, "appSettings", "runtime"), { maintenanceMode: enabled, updatedAt: new Date().toISOString() });
      setMaintenanceMode(enabled);
    } catch {
      try {
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "appSettings", "runtime"), { maintenanceMode: enabled, updatedAt: new Date().toISOString() }, { merge: true });
        setMaintenanceMode(enabled);
      } catch (error: any) {
        Alert.alert("Update failed", String(error?.message || "Could not update maintenance mode."));
      }
    } finally { setBusy(""); }
  };

  const saveRate = async () => {
    if (!db) return;
    try {
      setBusy("rate");
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "appSettings", "public"), { rate: Number(rate) || 115, updatedAt: new Date().toISOString() }, { merge: true });
      Alert.alert("Saved", "Simulation rate updated.");
    } catch (error: any) {
      Alert.alert("Save failed", String(error?.message || "Could not save the simulation rate."));
    } finally { setBusy(""); }
  };

  const updateTx = async (tx: Tx, status: "approved" | "rejected" | "completed") => {
    if (!db) return;
    try {
      setBusy(tx.id);
      if (status === "completed") {
        if (!functions) throw new Error("Firebase Functions are not configured.");
        const complete = httpsCallable(functions, "completeTransaction");
        const result: any = await complete({ transactionId: tx.id, details: { simulated: true } });
        Alert.alert("Simulation completed", "Simulated balance: " + Number(result?.data?.balanceUsdt || 0).toFixed(8));
      } else {
        await updateDoc(doc(db, "transactions", tx.id), { status, simulated: true, updatedAt: new Date().toISOString() });
      }
    } catch (error: any) {
      Alert.alert("Update failed", String(error?.message || "The simulation update was rejected."));
    } finally { setBusy(""); }
  };

  const publishLatestUpdate = async () => {
    if (!functions) return Alert.alert("Unavailable", "Firebase Functions are not configured.");
    try {
      setPublishing(true);
      const publish = httpsCallable(functions, "publishLatestUpdate");
      await publish({});
      Alert.alert("Queued", "The latest compatible simulation update was queued for publication.");
    } catch (error: any) {
      Alert.alert("Publish failed", String(error?.message || "The OTA publish request failed."));
    } finally { setPublishing(false); }
  };

  const syncBalance = async (userId: string) => {
    if (!functions) return;
    try {
      setBusy("sync-" + userId);
      const rebuild = httpsCallable(functions, "rebuildUserBalance");
      const result: any = await rebuild({ userId });
      Alert.alert("Simulation balance synced", Number(result?.data?.balanceUsdt || 0).toFixed(8) + " simulated USDT");
    } catch (error: any) {
      Alert.alert("Sync failed", String(error?.message || "Could not rebuild the simulated balance."));
    } finally { setBusy(""); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>Simulation Admin</Text>
        <Text style={styles.sub}>Transparent demo controls and simulated transaction review</Text>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>SIMULATION ONLY</Text>
          <Text style={styles.bannerText}>No real money, crypto custody, payment collection, or settlement is enabled by this application.</Text>
        </View>

        <View style={styles.stats}>
          <Stat value={String(users.length)} label="Users" />
          <Stat value={String(transactions.filter(x => x.status === "pending").length)} label="Pending" />
          <Stat value={String(transactions.length)} label="Simulations" />
        </View>

        <Card title="Maintenance Mode">
          <Text style={styles.muted}>When enabled, users see a transparent maintenance message and new simulated transaction requests are blocked.</Text>
          <Pressable disabled={busy === "maintenance"} style={[styles.primary, { backgroundColor: maintenanceMode ? C.green : C.red }]} onPress={() => setMaintenance(!maintenanceMode)}>
            <Text style={styles.primaryText}>{busy === "maintenance" ? "Saving…" : maintenanceMode ? "DISABLE MAINTENANCE MODE" : "ENABLE MAINTENANCE MODE"}</Text>
          </Pressable>
          <Text style={styles.status}>Current: {maintenanceMode ? "Maintenance Mode" : "Simulation Active"}</Text>
        </Card>

        <Card title="Simulation Settings">
          <Text style={styles.label}>Demo rate (INR / simulated USDT)</Text>
          <View style={styles.rateRow}>
            <Pressable style={styles.rateButton} onPress={() => setRate(Math.max(1, rate - 1))}><Text style={styles.rateText}>−</Text></Pressable>
            <Text style={styles.rateValue}>₹{rate}</Text>
            <Pressable style={styles.rateButton} onPress={() => setRate(rate + 1)}><Text style={styles.rateText}>+</Text></Pressable>
          </View>
          <Pressable disabled={busy === "rate"} style={styles.primary} onPress={saveRate}><Text style={styles.primaryText}>{busy === "rate" ? "Saving…" : "SAVE SIMULATION RATE"}</Text></Pressable>
        </Card>

        <Card title="OTA Updates">
          <Text style={styles.muted}>Publishes compatible JavaScript updates. It does not control or hide application behavior.</Text>
          <Pressable disabled={publishing} style={[styles.primary, publishing && styles.disabled]} onPress={publishLatestUpdate}>
            <Text style={styles.primaryText}>{publishing ? "PUBLISHING…" : "PUBLISH LATEST SIMULATION UPDATE"}</Text>
          </Pressable>
        </Card>

        <Text style={styles.section}>Simulated Transactions</Text>
        {transactions.length === 0 ? <Card title=""><Text style={styles.muted}>No simulated transactions yet.</Text></Card> : transactions.map(tx => (
          <View key={tx.id} style={styles.card}>
            <View style={styles.row}><Text style={styles.type}>{String(tx.type || "transaction").toUpperCase()}</Text><Text style={styles.status}>{tx.status}</Text></View>
            <Text style={styles.amount}>{tx.type === "buy" ? "₹" + Number(tx.inrAmount || tx.amount || 0).toFixed(2) + " → " : Number(tx.usdtAmount || tx.amount || 0).toFixed(2) + " simulated USDT → "} {tx.type === "buy" ? Number(tx.usdtAmount || 0).toFixed(2) + " simulated USDT" : "₹" + Number(tx.inrAmount || 0).toFixed(2)}</Text>
            <Text style={styles.meta}>User: {tx.userId || "—"}</Text>
            <Text style={styles.meta}>Simulation: {tx.simulated === false ? "legacy record" : "yes"}</Text>
            {tx.balanceAfter !== undefined ? <Text style={styles.meta}>Simulated balance after: {Number(tx.balanceAfter).toFixed(8)}</Text> : null}
            <View style={styles.actions}>
              {tx.status === "pending" && <>
                <Pressable disabled={busy === tx.id} style={styles.approve} onPress={() => updateTx(tx, "approved")}><Text style={styles.actionText}>Approve</Text></Pressable>
                <Pressable disabled={busy === tx.id} style={styles.reject} onPress={() => updateTx(tx, "rejected")}><Text style={styles.actionText}>Reject</Text></Pressable>
              </>}
              {tx.status === "approved" && <Pressable disabled={busy === tx.id} style={styles.complete} onPress={() => updateTx(tx, "completed")}><Text style={styles.actionText}>{busy === tx.id ? "Saving…" : "Complete Simulation"}</Text></Pressable>}
            </View>
          </View>
        ))}

        <Text style={styles.section}>Registered Users</Text>
        <View style={styles.card}>
          {users.length === 0 ? <Text style={styles.muted}>No users yet.</Text> : users.map(u => (
            <View key={u.id} style={styles.userRow}>
              <Text style={styles.userEmail}>{u.email || u.displayName || "User"}</Text>
              <Text style={styles.userUid}>{u.id}</Text>
              <Text style={styles.status}>Simulated balance: {Number(u.balanceUsdt || 0).toFixed(2)}</Text>
              <Pressable disabled={busy === "sync-" + u.id} style={styles.secondary} onPress={() => syncBalance(u.id)}><Text style={styles.secondaryText}>{busy === "sync-" + u.id ? "Syncing…" : "Sync Simulated Balance"}</Text></Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statNum}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.card}>{title ? <Text style={styles.cardTitle}>{title}</Text> : null}{children}</View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg}, wrap:{padding:16,paddingBottom:40}, title:{fontSize:30,fontWeight:"800",color:C.text},
  sub:{fontSize:14,color:C.muted,marginTop:4,marginBottom:16}, banner:{backgroundColor:"#EEF2FF",borderColor:"#C9D4FF",borderWidth:1,borderRadius:16,padding:15,marginBottom:12},
  bannerTitle:{fontSize:12,fontWeight:"900",color:C.blue,letterSpacing:1,marginBottom:5}, bannerText:{fontSize:12,lineHeight:18,color:C.text},
  stats:{flexDirection:"row",gap:10,marginBottom:14}, stat:{flex:1,backgroundColor:C.card,borderRadius:15,padding:14,borderWidth:1,borderColor:C.border},
  statNum:{fontSize:24,fontWeight:"800",color:C.text}, statLabel:{fontSize:11,color:C.muted,marginTop:3}, card:{backgroundColor:C.card,borderRadius:16,padding:15,borderWidth:1,borderColor:C.border,marginBottom:12},
  cardTitle:{fontSize:17,fontWeight:"800",color:C.text,marginBottom:10}, muted:{fontSize:13,color:C.muted,lineHeight:18}, primary:{height:48,borderRadius:12,backgroundColor:C.blue,alignItems:"center",justifyContent:"center",marginTop:12},
  primaryText:{color:"#fff",fontWeight:"800"}, status:{fontSize:11,fontWeight:"800",color:C.blue,textTransform:"uppercase",marginTop:8}, label:{fontSize:12,color:C.muted,marginBottom:8},
  rateRow:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:20,marginBottom:12}, rateButton:{width:44,height:44,borderRadius:12,backgroundColor:"#EEF2FF",alignItems:"center",justifyContent:"center"}, rateText:{fontSize:24,fontWeight:"800",color:C.blue}, rateValue:{fontSize:26,fontWeight:"900",color:C.text},
  disabled:{opacity:.5}, section:{fontSize:19,fontWeight:"800",color:C.text,marginTop:8,marginBottom:10}, row:{flexDirection:"row",justifyContent:"space-between"}, type:{fontSize:13,fontWeight:"800",color:C.text}, amount:{fontSize:17,fontWeight:"800",color:C.blue,marginTop:10},
  meta:{fontSize:11.5,color:C.muted,marginTop:5}, actions:{flexDirection:"row",gap:8,marginTop:12}, approve:{flex:1,backgroundColor:C.green,borderRadius:10,paddingVertical:11,alignItems:"center"}, reject:{flex:1,backgroundColor:C.red,borderRadius:10,paddingVertical:11,alignItems:"center"}, complete:{flex:1,backgroundColor:C.blue,borderRadius:10,paddingVertical:11,alignItems:"center"}, actionText:{color:"#fff",fontWeight:"800",fontSize:12},
  userRow:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border}, userEmail:{fontSize:14,fontWeight:"700",color:C.text}, userUid:{fontSize:10,color:C.muted,marginTop:3}, secondary:{marginTop:9,borderWidth:1,borderColor:C.border,borderRadius:9,paddingVertical:9,alignItems:"center"}, secondaryText:{fontSize:11,fontWeight:"800",color:C.blue},
});
