import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C={bg:"#F7F7FA",card:"#fff",text:"#17191F",muted:"#7B7F89",blue:"#2455D6",border:"#E8E9EE"};

export default function Admin(){
 const [rate,setRate]=useState("110");
 const [address,setAddress]=useState("Paste approved payment address");
 const [qr,setQr]=useState("QR image URL");
 useEffect(()=>{if(!db)return;return onSnapshot(doc(db,"appSettings","public"),snap=>{if(snap.exists()){const d=snap.data();setRate(String(d.rate??110));setAddress(String(d.paymentAddress??""));setQr(String(d.qrUrl??""))}})},[]);
 const save=async()=>{if(!db)return Alert.alert("Firebase not configured","Add Firebase credentials first.");try{await setDoc(doc(db,"appSettings","public"),{rate:Number(rate)||110,paymentAddress:address.trim(),qrUrl:qr.trim(),updatedAt:new Date().toISOString()},{merge:true});Alert.alert("Saved","Public settings updated.")}catch(e){Alert.alert("Save failed","Make sure this account is seeded as an admin in Firestore.")}};
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.wrap}>
  <Text style={s.title}>Admin Panel</Text>
  <Text style={s.sub}>Application configuration</Text>
  <Field label="USDT / INR Rate" value={rate} onChangeText={setRate} keyboard="decimal-pad"/>
  <Field label="Payment Address" value={address} onChangeText={setAddress}/>
  <Field label="QR Image URL" value={qr} onChangeText={setQr}/>
  <Pressable style={s.save} onPress={save}><Text style={s.saveText}>Save Settings</Text></Pressable>
  <View style={s.card}><Text style={s.cardTitle}>Management</Text><Row icon="people-outline" title="Users"/><Row icon="receipt-outline" title="Transaction history"/><Row icon="share-social-outline" title="Referral / team settings"/><Row icon="megaphone-outline" title="Announcements"/></View>
  <Text style={s.note}>This admin screen writes the public configuration to Firestore. Before production use, protect it with Firebase Authentication and Firestore security rules. Do not store private wallet keys in the app.</Text>
 </ScrollView></SafeAreaView>;
}
function Field({label,value,onChangeText,keyboard}:{label:string,value:string,onChangeText:(v:string)=>void,keyboard?:any}){return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboard} style={s.input}/></View>}
function Row({icon,title}:{icon:any,title:string}){return <View style={s.row}><Ionicons name={icon} size={21} color={C.text}/><Text style={s.rowText}>{title}</Text><Ionicons name="chevron-forward" size={18} color={C.muted}/></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:C.bg},wrap:{padding:20,paddingBottom:40},title:{fontSize:30,fontWeight:"800",color:C.text},sub:{fontSize:14,color:C.muted,marginTop:5,marginBottom:22},field:{marginBottom:16},label:{fontSize:13,color:C.muted,marginBottom:7},input:{height:52,backgroundColor:C.card,borderWidth:1,borderColor:C.border,borderRadius:13,paddingHorizontal:14,fontSize:15,color:C.text},save:{height:52,borderRadius:13,backgroundColor:C.blue,alignItems:"center",justifyContent:"center",marginBottom:22},saveText:{color:"#fff",fontSize:15,fontWeight:"800"},card:{backgroundColor:C.card,borderRadius:16,padding:10,borderWidth:1,borderColor:C.border},cardTitle:{fontSize:17,fontWeight:"800",color:C.text,padding:10},row:{height:52,borderTopWidth:1,borderTopColor:C.border,flexDirection:"row",alignItems:"center",paddingHorizontal:10,gap:12},rowText:{flex:1,fontSize:14.5,fontWeight:"600",color:C.text},note:{fontSize:11.5,color:C.muted,lineHeight:17,marginTop:18}});
