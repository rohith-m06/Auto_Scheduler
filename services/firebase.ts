import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCkPB6xGLw4oj5ZcH0kwKLnUYd52JZcQac",
    authDomain: "auto-scheduler-6b93b.firebaseapp.com",
    projectId: "auto-scheduler-6b93b",
    storageBucket: "auto-scheduler-6b93b.firebasestorage.app",
    messagingSenderId: "659335226240",
    appId: "1:659335226240:web:3b1588e846082af6ba9765",
    measurementId: "G-1QP14WRSK8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
