import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut, signInWithPopup, signInAnonymously } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";

// Safe native platform detection — works on Vercel (web) AND Capacitor WebView (Android/iOS)
// Avoids a static import of @capacitor/core which breaks Vite/Vercel SSG builds
const isNativePlatform = (): boolean => {
  try {
    return typeof (window as any)?.Capacitor?.isNativePlatform === "function"
      && (window as any).Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      // In native Android/iOS WebViews, Google strictly blocks OAuth popups and redirects.
      // To give users immediate access to the functional app, we use Firebase Anonymous Login.
      if (isNativePlatform()) {
        console.log("Native platform detected. Bypassing Google Auth block with Anonymous Login.");
        await signInAnonymously(auth);
      } else {
        // Standard Web Browser logic
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("Login failed:", error);
      // Fallback just in case standard login fails on a weird browser
      if (!isNativePlatform()) {
        try {
          await signInAnonymously(auth);
        } catch (fallbackError) {
          console.error("Fallback anonymous login also failed:", fallbackError);
        }
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
