import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAy7dwlG8HN02XHHndUV15w48n076jyw",
  authDomain: "apptest-1f683.firebaseapp.com",
  projectId: "apptest-1f683",
  storageBucket: "apptest-1f683.firebasestorage.app",
  messagingSenderId: "18890268864",
  appId: "1:18890268864:web:8f21cad8573b71b01a1c09",
};

export const isFirebaseConfigured = true;
export const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
