import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { recordUserLogin } from '../services/userTracking';

interface AuthContextType {
  currentUser: User | null;
  userName: string | null;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const guestActive = localStorage.getItem('autoscheduler_guest_active') === 'true';
      const guestId = localStorage.getItem('autoscheduler_guest_id');
      if (guestActive && guestId) {
        return {
          uid: guestId,
          email: 'guest@autoscheduler.app',
          displayName: 'Guest Scholar',
          isAnonymous: true
        } as any;
      }
    } catch (e) {}
    return null;
  });

  const [userName, setUserName] = useState<string | null>(() => {
    try {
      if (localStorage.getItem('autoscheduler_guest_active') === 'true') {
        return 'Guest Scholar';
      }
    } catch (e) {}
    return null;
  });

  const [loading, setLoading] = useState(false);

  async function signup(email: string, password: string, name: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    localStorage.removeItem('autoscheduler_guest_active');
    await recordUserLogin(userCredential.user, 'signup');
    setUserName(name);
  }

  async function login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    localStorage.removeItem('autoscheduler_guest_active');
    await recordUserLogin(userCredential.user, 'password');
    setUserName(userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User');
  }

  async function loginWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    localStorage.removeItem('autoscheduler_guest_active');
    await recordUserLogin(userCredential.user, 'google');
    setUserName(userCredential.user.displayName || 'Google User');
  }

  function loginAsGuest() {
    let guestId = localStorage.getItem('autoscheduler_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('autoscheduler_guest_id', guestId);
    }
    localStorage.setItem('autoscheduler_guest_active', 'true');
    const guestUser: any = {
      uid: guestId,
      email: 'guest@autoscheduler.app',
      displayName: 'Guest Scholar',
      isAnonymous: true
    };
    setCurrentUser(guestUser);
    setUserName('Guest Scholar');
  }

  async function logout() {
    localStorage.removeItem('autoscheduler_guest_active');
    if (currentUser?.isAnonymous) {
      setCurrentUser(null);
      setUserName(null);
    } else {
      await signOut(auth);
      setCurrentUser(null);
      setUserName(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        setCurrentUser(user);
        setUserName(user.displayName || user.email?.split('@')[0] || null);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userName, signup, login, loginWithGoogle, loginAsGuest, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
