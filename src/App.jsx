import { useState, useEffect } from "react";
import { apiFetch } from './lib/apiFetch.mjs';
import Login from "./components/Login.jsx";
import Signup from "./components/Signup.jsx";
import ForgotPassword from "./components/ForgotPassword.jsx";
import ConsentPage from "./components/ConsentPage.jsx";
import PrototypeApp from "./components/PrototypeApp.jsx";
import { LanguageProvider } from "./LanguageContext";
import { AccessibilityProvider } from './AccessibilityContext';
import { clearSessionDataCache, setSessionDataScope } from './lib/sessionDataCache.mjs';

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
  clearSessionDataCache();
  setSessionDataScope(null);
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
  const [initialSession] = useState(readStoredSession);
  const [authState, setAuthState] = useState(initialSession.authState === 'authenticated' ? 'checking' : 'login');
  const [currentUser, setCurrentUser] = useState(initialSession.currentUser);
  const [consentState, setConsentState] = useState('idle');
  const [consentData, setConsentData] = useState(null);
  const [consentRetry, setConsentRetry] = useState(0);

  useEffect(() => {
    if (initialSession.authState !== 'authenticated') return;
    setSessionDataScope(
      initialSession.currentUser?.email
      || initialSession.currentUser?.username
      || initialSession.currentUser?.id,
    );
    let active = true;
    apiFetch('/api/me/').then(async (response) => {
      if (!response.ok) {
        const error = new Error('Unable to verify the current session.');
        error.status = response.status;
        throw error;
      }
      const user = await response.json();
      if (active) {
        setSessionDataScope(user?.email || user?.username || user?.id);
        setCurrentUser(user);
        setAuthState('authenticated');
      }
    }).catch((error) => {
      if (active) {
        if (error.status === 401 || error.status === 403) {
          clearStoredSession();
          setCurrentUser(null);
          setConsentData(null);
          setConsentState('idle');
          setAuthState('login');
        } else {
          // Keep the cached identity during outages; the consent check shows a retry state.
          setAuthState('authenticated');
        }
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authState !== 'authenticated') {
      if (authState === 'login' || authState === 'signup' || authState === 'forgot') {
        setConsentData(null);
        setConsentState('idle');
      }
      return;
    }

    let active = true;
    setConsentState('checking');
    apiFetch('/api/consent/').then(async (response) => {
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || 'Unable to check consent status.');
        error.status = response.status;
        throw error;
      }
      if (active) {
        setConsentData(result);
        setConsentState(result.requiresConsent ? 'required' : 'accepted');
      }
    }).catch((error) => {
      console.error('Consent status check failed', error);
      if (active) {
        if (error.status === 401 || error.status === 403) {
          clearStoredSession();
          setCurrentUser(null);
          setConsentData(null);
          setConsentState('idle');
          setAuthState('login');
        } else {
          setConsentState('error');
        }
      }
    });
    return () => { active = false; };
  }, [authState, consentRetry]);

  const handleLogin = (user, rememberMe = true) => {
    setSessionDataScope(user?.email || user?.username || user?.id);
    setAuthState("authenticated");
    setCurrentUser(user || null);
    persistSession(user || null, rememberMe);
    try {
      localStorage.setItem('prototype_active_tab', 'dashboard');
    } catch (e) {
      // Ignore storage issues; the dashboard remains the default tab.
    }
  };

  const handleSignup = (user) => {
    setSessionDataScope(user?.email || user?.username || user?.id);
    setAuthState("authenticated");
    setCurrentUser(user || null);
    persistSession(user || null);
    try {
      localStorage.setItem('prototype_active_tab', 'dashboard');
    } catch (e) {
      // Ignore storage write issues and keep the default dashboard tab.
    }
  };

  const handleLogout = () => {
    console.log('App: handleLogout called â€” switching to login');
    setAuthState("login");
    setCurrentUser(null);
    setConsentData(null);
    setConsentState('idle');
    clearStoredSession();
  };

  const handleConsentDecline = async () => {
    try {
      const response = await apiFetch('/api/logout/', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Unable to end the server session.');
    } catch (error) {
      console.error('Session logout after consent decline failed', error);
    }
    handleLogout();
  };

  const handleConsentAccepted = (result) => {
    setConsentData(result);
    setConsentState('accepted');
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
      {(authState === 'checking' || (authState === 'authenticated' && consentState === 'checking')) && (
        <p role="status" className="p-8 text-center text-stone-700">Checking your session and consent status...</p>
      )}
      {authState === 'authenticated' && consentState === 'error' && (
        <main className="flex min-h-screen items-center justify-center bg-[#F2F0E8] p-5">
          <section className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h1 className="text-xl font-bold text-stone-900">Unable to verify consent</h1>
            <p className="text-sm text-stone-600">Your sign-in is saved, but the server is unavailable to verify your Privacy Notice status. Farm data will stay unavailable until the connection returns; retry when you are back online.</p>
            <button type="button" onClick={() => setConsentRetry((attempt) => attempt + 1)} className="min-h-12 w-full rounded-xl bg-emerald-800 px-4 font-bold text-white hover:bg-emerald-900">
              Retry
            </button>
            <button type="button" onClick={handleConsentDecline} className="min-h-11 w-full rounded-xl border border-stone-300 px-4 font-semibold text-stone-700 hover:bg-stone-50">
              Sign out
            </button>
          </section>
        </main>
      )}
      {authState === 'authenticated' && consentState === 'required' && (
        <ConsentPage
          initialConsent={consentData?.current}
          currentVersion={consentData?.consentVersion}
          onAccepted={handleConsentAccepted}
          onDecline={handleConsentDecline}
        />
      )}
      {authState === "signup" && (
        <Signup
          onSignup={handleSignup}
          onSwitchToLogin={() => setAuthState("login")}
        />
      )}

      {authState === "authenticated" && consentState === 'accepted' && (
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
