import { useState, useEffect } from "react";
import { apiFetch } from './lib/apiFetch.mjs';
import Login from "./components/Login.jsx";
import Signup from "./components/Signup.jsx";
import ForgotPassword from "./components/ForgotPassword.jsx";
import PrototypeApp from "./components/PrototypeApp.jsx";
import { LanguageProvider } from "./LanguageContext";
import { AccessibilityProvider } from './AccessibilityContext';

const readStoredSession = () => {
  if (typeof window === 'undefined') {
    return { authState: 'login', currentUser: null };
  }

  try {
    const savedState =
      localStorage.getItem('authState') || sessionStorage.getItem('authState');
    const savedUserRaw =
      localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
    const parsedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;

    if (savedState === 'authenticated' || parsedUser) {
      return { authState: 'authenticated', currentUser: parsedUser };
    }
  } catch (e) {
    // Ignore storage parsing issues and fall back to login.
  }

  return { authState: 'login', currentUser: null };
};

const persistSession = (user, rememberMe) => {
  try {
    const serializedUser = JSON.stringify(user || null);
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    otherStorage.removeItem('authState');
    otherStorage.removeItem('auth_user');
    otherStorage.removeItem('auth_user_email');
    storage.setItem('authState', 'authenticated');
    storage.setItem('auth_user', serializedUser);

    if (user && user.email) {
      storage.setItem('auth_user_email', user.email);
    }
  } catch (e) {
    // Ignore storage write issues.
  }
};

const clearStoredSession = () => {
  try {
    localStorage.removeItem('authState');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_user_email');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('authState');
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('auth_user_email');
    sessionStorage.removeItem('auth_token');
  } catch (e) {
    // Ignore storage clear issues.
  }
};

function App() {
  const initialSession = readStoredSession();
  const [authState, setAuthState] = useState(initialSession.authState === 'authenticated' ? 'checking' : 'login');
  const [currentUser, setCurrentUser] = useState(initialSession.currentUser);

  useEffect(() => {
    if (initialSession.authState !== 'authenticated') return;
    let active = true;
    apiFetch('/api/me/').then(async (response) => {
      if (!response.ok) throw new Error('Session expired');
      const user = await response.json();
      if (active) { setCurrentUser(user); setAuthState('authenticated'); }
    }).catch(() => {
      if (active) { clearStoredSession(); setCurrentUser(null); setAuthState('login'); }
    });
    return () => { active = false; };
  }, []);

  const handleLogin = (user, rememberMe = true) => {
    setAuthState("authenticated");
    setCurrentUser(user || null);
    persistSession(user || null, rememberMe);
  };

  const handleSignup = (user) => {
    setAuthState("authenticated");
    setCurrentUser(user || null);
    persistSession(user || null);
    try {
      localStorage.setItem('prototype_active_tab', 'monitoring');
    } catch (e) {
      // Ignore storage write issues and keep the default monitoring tab.
    }
  };

  const handleLogout = () => {
    console.log('App: handleLogout called â€” switching to login');
    setAuthState("login");
    setCurrentUser(null);
    clearStoredSession();
  };

  useEffect(() => {
    const onLogoutEvent = () => {
      console.log('App: received rambutanLogout event â€” performing logout');
      handleLogout();
    };

    window.addEventListener('rambutanLogout', onLogoutEvent);
    return () => window.removeEventListener('rambutanLogout', onLogoutEvent);
  }, []);

  return (
    <LanguageProvider>
      {authState === 'checking' && <p role="status" className="p-8 text-center">Checking session...</p>}
      {authState === "signup" && (
        <Signup
          onSignup={handleSignup}
          onSwitchToLogin={() => setAuthState("login")}
        />
      )}

      {authState === "authenticated" && (
        <PrototypeApp onBack={handleLogout} currentUser={currentUser} />
      )}

      {authState === "login" && (
        <Login
          onLogin={handleLogin}
          onSwitchToSignup={() => setAuthState("signup")}
          onSwitchToForgot={() => setAuthState("forgot")}
        />
      )}

      {authState === "forgot" && (
        <ForgotPassword onSwitchToLogin={() => setAuthState("login")} />
      )}
    </LanguageProvider>
  );
}

function AppWrapper() {
  return (
    <AccessibilityProvider>
      <App />
    </AccessibilityProvider>
  );
}

export default AppWrapper;
