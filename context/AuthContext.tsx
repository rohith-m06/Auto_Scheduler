import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../services/firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    User,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
    currentUser: User | null;
    userName: string | null;
    signup: (email: string, password: string, name: string) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function signup(email: string, password: string, name: string) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update Firebase Auth profile with display name
        await updateProfile(userCredential.user, {
            displayName: name
        });
        
        // Store user info in Firestore (so you can see it in database)
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            name: name,
            email: email,
            createdAt: new Date()
        }, { merge: true });
        
        setUserName(name);
    }

    async function login(email: string, password: string) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Always update/check Firestore info on login so the admin (you) can see who it is
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: email,
            lastLogin: new Date()
        }, { merge: true });

        // Try to get name from Firestore
        try {
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userDoc.exists() && userDoc.data().name) {
                setUserName(userDoc.data().name);
            }
        } catch (error) {
            console.error('Error fetching user name:', error);
        }
    }

    async function loginWithGoogle() {
        const userCredential = await signInWithPopup(auth, googleProvider);
        
        // Store/Update user info in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            name: userCredential.user.displayName,
            email: userCredential.user.email,
            lastLogin: new Date()
        }, { merge: true });

        if (userCredential.user.displayName) {
            setUserName(userCredential.user.displayName);
        }
    }

    function logout() {
        setUserName(null);
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            
            if (user) {
                // Try to get name from displayName first
                if (user.displayName) {
                    setUserName(user.displayName);
                } else {
                    // Try to get from Firestore
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        if (userDoc.exists() && userDoc.data().name) {
                            setUserName(userDoc.data().name);
                        }
                    } catch (error) {
                        console.error('Error fetching user name:', error);
                    }
                }
            } else {
                setUserName(null);
            }
            
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userName,
        signup,
        login,
        loginWithGoogle,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
