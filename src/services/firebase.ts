import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCkZwHogueP75oFxI742cws2IzFvOwP--4",
  authDomain: "auto-sheduler-v2.firebaseapp.com",
  projectId: "auto-sheduler-v2",
  storageBucket: "auto-sheduler-v2.firebasestorage.app",
  messagingSenderId: "1003647815251",
  appId: "1:1003647815251:web:ff9eeab5e9afaa217dc0a6",
  measurementId: "G-6N8YKPP47H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
export default app;
