import { db } from './firebase';
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

export async function recordUserLogin(user: User, method: string = 'password') {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL || '',
      lastLoginAt: serverTimestamp(),
      loginMethod: method,
      loginCount: increment(1),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      platform: typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform : ''
    }, { merge: true });

    await addDoc(collection(db, 'login_history'), {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      timestamp: serverTimestamp(),
      method,
      type: 'login'
    });
  } catch (err) {
    console.error('Firestore user tracking error:', err);
  }
}

export async function logUserActivity(user: User | null, action: string, metadata: Record<string, any> = {}) {
  try {
    if (!user || user.uid.startsWith('guest_')) return;
    await addDoc(collection(db, 'user_activity'), {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'User',
      action,
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Could not log activity:', err);
  }
}

export async function saveUserWorkspace(uid: string, workspaceData: any) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('autoscheduler_workspace_' + uid, JSON.stringify(workspaceData));
    }

    if (uid.startsWith('guest_')) {
      return;
    }

    const sessionRef = doc(db, 'users', uid, 'workspace', 'current');
    await setDoc(sessionRef, {
      courses: workspaceData.courses,
      selectedCodes: workspaceData.selectedCodes,
      optionPrefs: workspaceData.optionPrefs,
      datasetStats: workspaceData.datasetStats,
      timetables: workspaceData.timetables || [],
      currentIndex: workspaceData.currentIndex || 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save user workspace to Firestore:', err);
  }
}

export async function loadUserWorkspace(uid: string) {
  let localData = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('autoscheduler_workspace_' + uid);
      if (saved) localData = JSON.parse(saved);
    }
  } catch (e) {}

  if (uid.startsWith('guest_')) {
    return localData;
  }

  try {
    const sessionRef = doc(db, 'users', uid, 'workspace', 'current');
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (e) {
    console.warn('Could not fetch remote workspace, using local cache:', e);
  }

  return localData;
}
