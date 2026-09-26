import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { db } from "../lib/firebase";

const C={bg:"#F7F7FA",card:"#fff",text:"#17191F",muted:"#7B7F89",blue:"#2455D6",green:"#16A66A",red:"#C93A3A",border:"#E8E9EE"};

export default function Admin(){
 const [transactions,setTransactions]=useState<any[]>([]);
 const [users,setUsers]=useState<any[]>([]);
 const [rate,setRate]=useState("110");
 const [address,setAddress]=useState("");
 const [qr,setQr]=useState("");
 const [maintenanceMode,setMaintenanceMode]=useState(false);
 const [busy,setBusy]=useState("");

 useEffect(()=>{
  if(!db)return;
  const a=onSnapshot(collection(db,"transactions"),snap=>{
   const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
   rows.sort((x:any,y:any)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));
   setTransactions(rows);
  });
  const b=onSnapshot(collection(db,"users"),snap=>setUsers(snap.docs.map(d=>({id:d.id,...d.data()}))));
  const c=onSnapshot(doc(db,"appSettings","public"),snap=>{
   if(!snap.exists())return;
   const d=snap.data();setRate(String(d.rate??110));setAddress(String(d.paymentAddress??""));setQr(String(d.qrUrl??""));
  });
  const d=onSnapshot(doc(db,"appSettings","runtime"),snap=>{
   setMaintenanceMode(snap.exists() && snap.data().maintenanceMode === true);
  });
  return()=>{a();b();c();d();};
 },[]);

 const saveSettings=async()=>{
  if(!db)return;
  try{await setDoc(doc(db,"appSettings","public"),{rate:Number(rate)||110,paymentAddress:address.trim(),qrUrl:qr.trim(),updatedAt:new Date().toISOString()},{merge:true});Alert.alert("Saved","Public settings updated.");}
  catch{Alert.alert("Save failed","Firebase rejected the update.");}
 };

 const setMaintenance=async(enabled:boolean)=>{
  if(!db)return;
  try{
   await setDoc(doc(db,"appSettings","runtime"),{maintenanceMode:enabled,updatedAt:new Date().toISOString()},{merge:true});
   Alert.alert("Emergency mode",enabled?"App locked for all users.":"App is live again.");
  }catch{Alert.alert("Update failed","Firebase rejected the emergency mode change.");}
 };

 const updateTx=async(id:string,status:"approved"|"rejected"|"completed",data:any)=>{
  if(!db)return;
  if(status==="approved" && !data.transactionId && !data.transactionLink && !data.paymentReference){
    Alert.alert("Add transaction details","Enter at least a Transaction ID, Payment Link, or Payment Reference before approving.");
    return;
  }
  try{setBusy(id);await updateDoc(doc(db,"transactions",id),{...data,status,updatedAt:new Date().toISOString(),processedAt:status==="rejected"?null:new Date().toISOString()});}
  catch{Alert.alert("Update failed","Firebase rejected the transaction update.");}
  finally{setBusy("");}
 };

 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap}>
  <Text style={s.title}>Admin Panel</Text>
  <Text style={s.sub}>Manage users, requests and transaction details</Text>
  <View style={s.stats}>
   <View style={s.stat}><Text style={s.statNum}>{users.length}</Text><Text style={s.statLabel}>Users</Text></View>
   <View style={s.stat}><Text style={s.statNum}>{transactions.filter(x=>x.status==="pending").length}</Text><Text style={s.statLabel}>Pending</Text></View>
   <View style={s.stat}><Text style={s.statNum}>{transactions.length}</Text><Text style={s.statLabel}>Transactions</Text></View>
  </View>

  <View style={s.card}>
   <Text style={s.cardTitle}>Emergency control</Text>
   <Text style={s.muted}>Locks the user app and blocks new transaction requests at the database level.</Text>
   <Pressable style={[s.primary,{backgroundColor:maintenanceMode?C.green:C.red,marginTop:12}]} onPress={()=>setMaintenance(!maintenanceMode)}>
    <Text style={s.primaryText}>{maintenanceMode?"Disable Emergency Lockdown":"ENABLE EMERGENCY LOCKDOWN"}</Text>
   </Pressable>
  </View>

  <View style={s.card}>
   <Text style={s.cardTitle}>Public settings</Text>
   <Field label="USDT / INR Rate" value={rate} onChangeText={setRate}/>
   <Field label="Payment Address" value={address} onChangeText={setAddress}/>
   <Field label="QR Image URL" value={qr} onChangeText={setQr}/>
   <Pressable style={s.primary} onPress={saveSettings}><Text style={s.primaryText}>Save Settings</Text></Pressable>
  </View>

  <Text style={s.section}>Transaction Requests</Text>
  {transactions.length===0?<View style={s.card}><Text style={s.muted}>No requests yet.</Text></View>:transactions.map(tx=><TxCard key={tx.id} tx={tx} busy={busy===tx.id} onSave={updateTx}/>)}

  <Text style={s.section}>Registered Users</Text>
  <View style={s.card}>{users.length===0?<Text style={s.muted}>No users yet.</Text>:users.map(u=><View key={u.id} style={s.user}><Text style={s.userEmail}>{u.email||"No email"}</Text><Text style={s.userUid}>{u.id}</Text></View>)}</View>
 </ScrollView></SafeAreaView>;
}

function TxCard({tx,busy,onSave}:{tx:any;busy:boolean;onSave:(id:string,status:any,data:any)=>void}){
 const [tid,setTid]=useState(tx.transactionId||"");
 const [link,setLink]=useState(tx.transactionLink||"");
 const [ref,setRef]=useState(tx.paymentReference||"");
 const [note,setNote]=useState(tx.adminNote||"");
 const detailsSaved=Boolean(tid.trim()||link.trim()||ref.trim());

 return <View style={s.card}>
  <View style={s.top}><Text style={s.type}>{String(tx.type||"").toUpperCase()} RP</Text><Text style={s.status}>{tx.status}</Text></View>
  <Text style={s.amount}>{tx.type==="sell"?String(tx.usdtAmount||tx.amount)+" USDT → ₹"+Number(tx.inrAmount||((tx.amount||0)*(tx.rate||110))).toFixed(2):"₹"+Number(tx.inrAmount||tx.amount||0).toFixed(2)+" → "+Number(tx.usdtAmount||0).toFixed(2)+" USDT"}</Text>
  <Text style={s.meta}>User: {tx.userId}</Text>
  <Text style={s.meta}>Rate: ₹{tx.rate||110}</Text>
  <Field label="Transaction ID" value={tid} onChangeText={setTid}/>
  <Field label="Transaction / Payment Link" value={link} onChangeText={setLink}/>
  <Field label="Payment Reference" value={ref} onChangeText={setRef}/>
  <Field label="Admin Note" value={note} onChangeText={setNote}/>
  {tx.status==="pending"&&<View>
    <Text style={s.hint}>Add at least one transaction detail, then approve. The user remains Pending until approval.</Text>
    <View style={s.actions}>
      <Pressable disabled={busy} style={[s.approve,!detailsSaved&&s.disabled]} onPress={()=>onSave(tx.id,"approved",{transactionId:tid.trim(),transactionLink:link.trim(),paymentReference:ref.trim(),adminNote:note.trim()})}><Text style={s.actionText}>{busy?"Saving…":"Approve & Send Details"}</Text></Pressable>
      <Pressable disabled={busy} style={s.reject} onPress={()=>onSave(tx.id,"rejected",{transactionId:tid.trim(),transactionLink:link.trim(),paymentReference:ref.trim(),adminNote:note.trim()})}><Text style={s.actionText}>Reject</Text></Pressable>
    </View>
  </View>}
  {tx.status==="approved"&&<Pressable disabled={busy} style={s.complete} onPress={()=>onSave(tx.id,"completed",{transactionId:tid.trim(),transactionLink:link.trim(),paymentReference:ref.trim(),adminNote:note.trim()})}><Text style={s.actionText}>{busy?"Saving…":"Mark Completed"}</Text></Pressable>}
 </View>;
}

function Field({label,value,onChangeText}:{label:string;value:string;onChangeText:(v:string)=>void}){
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={s.input}/></View>;
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},wrap:{padding:16,paddingBottom:40},title:{fontSize:30,fontWeight:"800",color:C.text},sub:{fontSize:14,color:C.muted,marginTop:4,marginBottom:16},
 stats:{flexDirection:"row",gap:10,marginBottom:14},stat:{flex:1,backgroundColor:C.card,borderRadius:15,padding:14,borderWidth:1,borderColor:C.border},statNum:{fontSize:24,fontWeight:"800",color:C.text},statLabel:{fontSize:11,color:C.muted,marginTop:3},
 card:{backgroundColor:C.card,borderRadius:16,padding:15,borderWidth:1,borderColor:C.border,marginBottom:12},cardTitle:{fontSize:17,fontWeight:"800",color:C.text,marginBottom:14},
 field:{marginBottom:10},label:{fontSize:12,color:C.muted,marginBottom:6},input:{height:46,borderWidth:1,borderColor:C.border,borderRadius:11,paddingHorizontal:12,fontSize:14,color:C.text},
 primary:{height:48,borderRadius:12,backgroundColor:C.blue,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},
 section:{fontSize:19,fontWeight:"800",color:C.text,marginTop:8,marginBottom:10},muted:{fontSize:13,color:C.muted},top:{flexDirection:"row",justifyContent:"space-between"},type:{fontSize:13,fontWeight:"800",color:C.text},status:{fontSize:11,fontWeight:"800",color:C.blue,textTransform:"uppercase"},
 amount:{fontSize:18,fontWeight:"800",color:C.blue,marginTop:10},meta:{fontSize:11.5,color:C.muted,marginTop:5},hint:{fontSize:11,color:C.muted,lineHeight:16,marginBottom:9},
 actions:{flexDirection:"row",gap:8},approve:{flex:1,backgroundColor:C.green,borderRadius:10,paddingVertical:11,alignItems:"center"},disabled:{opacity:.45},reject:{flex:1,backgroundColor:C.red,borderRadius:10,paddingVertical:11,alignItems:"center"},complete:{backgroundColor:C.blue,borderRadius:10,paddingVertical:11,alignItems:"center"},actionText:{color:"#fff",fontWeight:"800",fontSize:12},
 user:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},userEmail:{fontSize:14,fontWeight:"700",color:C.text},userUid:{fontSize:10,color:C.muted,marginTop:3}
});
