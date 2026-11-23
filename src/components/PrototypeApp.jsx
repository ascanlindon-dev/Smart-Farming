import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { LanguageContext } from '../LanguageContext';
import { sensorSnapshot } from '../lib/sensorReadings.mjs';
import { translations } from '../translation';
import ConsentSettings from './ConsentSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import EnvironmentalMonitoring from './EnvironmentalMonitoring';
import WeatherAlerts from './WeatherAlerts';
import DiseaseDetection from './DiseaseDetection';
import MaturityDetection from './MaturityDetection';
import HistoricalData from './HistoricalData';
import FarmDashboard from './FarmDashboard';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';
import { Leaf, CloudRain, Activity, BarChart3, LayoutDashboard, User, LogOut, Edit, Globe, Bell, KeyRound, MapPin, Save, X, Camera, Menu, ScanLine, Sprout } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import appLogo from '../assets/app-logo.png';
import { Activity3D, Analytics3D, Leaf3D, Rambutan3D, RainCloud3D } from './Environmental3DIcons';

const ACTIVE_TAB_STORAGE_KEY = 'prototype_active_tab';
const DISMISSED_NOTIFICATION_STORAGE_KEY = 'dismissed_notification_ids';
const DEFAULT_PROFILE_AVATAR = 'https://api.dicebear.com/10.x/avataaars/svg';

const appTabs = [
  { value: 'dashboard', icon: LayoutDashboard, color: 'emerald', labelKey: 'dashboard', sidebarLabel: 'Dashboard' },
  { value: 'monitoring', icon: Activity3D, color: 'emerald', labelKey: 'environmentalMonitoring', sidebarLabel: 'Environmental Monitoring' },
  { value: 'weather', icon: RainCloud3D, color: 'blue', labelKey: 'weatherAlerts', sidebarLabel: 'Weather' },
  { value: 'disease', icon: Leaf3D, color: 'green', labelKey: 'diseaseDetection', sidebarLabel: 'Leaf Disease Monitoring' },
  { value: 'maturity', icon: Rambutan3D, color: 'orange', labelKey: 'maturityDetection', sidebarLabel: 'Maturity Assessment' },
  { value: 'analytics', icon: Analytics3D, color: 'purple', labelKey: 'historicalData', sidebarLabel: 'Farm Overview' },
];

const getTabGlowClass = (color) => {
  switch (color) {
    case 'emerald':
      return 'bg-emerald-500/30';
    case 'blue':
      return 'bg-blue-500/30';
    case 'green':
      return 'bg-green-500/30';
    case 'orange':
      return 'bg-orange-500/30';
    case 'purple':
      return 'bg-purple-500/30';
    default:
      return 'bg-slate-500/30';
  }
};

const getTabIconClass = (color, isActive) => {
  if (!isActive) return 'text-gray-700';

  switch (color) {
    case 'emerald':
      return 'text-emerald-600';
    case 'blue':
      return 'text-blue-600';
    case 'green':
      return 'text-green-600';
    case 'orange':
      return 'text-orange-500';
    case 'purple':
      return 'text-purple-600';
    default:
      return 'text-slate-700';
  }
};

const getTabSurfaceClass = (color, isActive) => {
  if (!isActive) return 'bg-white/70 border-white/60';

  switch (color) {
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50/95';
    case 'blue':
      return 'border-blue-200 bg-blue-50/95';
    case 'green':
      return 'border-green-200 bg-green-50/95';
    case 'orange':
      return 'border-orange-200 bg-orange-50/95';
    case 'purple':
      return 'border-fuchsia-200 bg-fuchsia-50/95';
    default:
      return 'border-slate-200 bg-slate-50/95';
  }
};

const buildAppNotifications = (weatherData, sensorData, language) => {
  const notifications = [];
  const forecast = !weatherData?.stale && Array.isArray(weatherData?.forecast) ? weatherData.forecast : [];
  const today = forecast[0];

  if (today) {
    const rainfall = Number(today.rainfall ?? 0);
    const highTemp = Number(today.temperature?.max ?? 0);
    const wind = Number(today.wind ?? 0);
    const condition = String(today.condition || '').toLowerCase();

    if (rainfall >= 20 || condition.includes('thunder')) {
      notifications.push({
        id: `weather-rain-${today.date || 'today'}`,
        title: language === 'tl' ? 'Maghanda sa Ulan' : 'Prepare for Rain',
        description:
          language === 'tl'
            ? 'Maaaring lumakas ang ulan ngayon. Iwasan munang mag-spray o mag-ani habang maulan.'
            : 'Rain may become heavy today. Avoid spraying or harvesting while it is rainy.',
        tab: 'weather',
        severity: 'high',
      });
    }

    if (wind >= 45) {
      notifications.push({
        id: `weather-wind-${today.date || 'today'}`,
        title: language === 'tl' ? 'Malakas na Hangin' : 'Strong Wind Alert',
        description:
          language === 'tl'
            ? 'Maaaring malakas ang hangin ngayon. Siguraduhing nakatali ang mga batang puno.'
            : 'Winds may be strong today. Make sure young trees are supported.',
        tab: 'weather',
        severity: 'moderate',
      });
    }

    if (highTemp >= 38) {
      notifications.push({
        id: `weather-heat-${today.date || 'today'}`,
        title: language === 'tl' ? 'Matinding Init' : 'Extreme Heat Alert',
        description:
          language === 'tl'
            ? `Inaasahang aabot sa ${highTemp}°C ang init. Pindutin para sa weather guidance.`
            : `Heat may reach ${highTemp}°C. Tap for weather guidance.`,
        tab: 'weather',
        severity: 'moderate',
      });
    }
  }

  if (sensorSnapshot(sensorData).status === 'recent') {
    const temperature = Number(sensorData.temperature ?? sensorData.temp ?? sensorData.temp_c ?? sensorData.temperature_c ?? NaN);
    const humidity = Number(sensorData.humidity ?? sensorData.hum ?? sensorData.relative_humidity ?? NaN);
    const rainfall = Number(sensorData.rain_mm ?? 0);

    if (!Number.isNaN(temperature) && temperature >= 36) {
      notifications.push({
        id: 'monitoring-heat',
        title: language === 'tl' ? 'Mainit sa Bukid' : 'High Farm Temperature',
        description:
          language === 'tl'
            ? `Umabot sa ${temperature.toFixed(1)}°C ang sensor reading. Pindutin para sa environmental monitoring.`
            : `Sensor reading reached ${temperature.toFixed(1)}°C. Tap to open environmental monitoring.`,
        tab: 'monitoring',
        severity: 'high',
      });
    }

    if (!Number.isNaN(humidity) && humidity >= 80) {
      notifications.push({
        id: 'monitoring-humidity',
        title: language === 'tl' ? 'Mataas ang Humidity' : 'High Humidity Alert',
        description:
          language === 'tl'
            ? `Nasa ${Math.round(humidity)}% ang humidity. Pindutin para tingnan ang monitoring page.`
            : `Humidity is at ${Math.round(humidity)}%. Tap to check the monitoring page.`,
        tab: 'monitoring',
        severity: 'moderate',
      });
    }

    if (rainfall >= 20) {
      notifications.push({
        id: 'monitoring-rain',
        title: language === 'tl' ? 'Malakas na Ulan sa Sensor' : 'Heavy Rain Sensor Alert',
        description:
          language === 'tl'
            ? `Nakakita ang sensor ng ${rainfall.toFixed(1)} mm na ulan. Pindutin para sa live monitoring.`
            : `The sensor detected ${rainfall.toFixed(1)} mm of rainfall. Tap for live monitoring.`,
        tab: 'monitoring',
        severity: 'high',
      });
    }
  }

  return notifications;
};

const PrototypeApp = ({ onBack, currentUser }) => {
  const { language, changeLanguage } = useContext(LanguageContext);
  const t = translations[language] || translations.en;

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';

    try {
      const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      if (appTabs.some((tab) => tab.value === savedTab)) {
        return savedTab;
      }
    } catch (error) {
      // Ignore storage read issues and keep the default tab.
    }

    return 'dashboard';
  });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [farmer, setFarmer] = useState({
    name: currentUser?.name || currentUser?.username || 'Farmer',
    email: currentUser?.email || '',
    photo: '',
  });
  const [location, setLocation] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState([]);
  const [customNotifications, setCustomNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_NOTIFICATION_STORAGE_KEY) || '[]');
    } catch (error) {
      return [];
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [unreadNotificationIds, setUnreadNotificationIds] = useState([]);
  const [isTabSwitchLocked, setIsTabSwitchLocked] = useState(false);
  const appTabsRef = useRef(null);
  const notifications = useMemo(
    () => [...customNotifications, ...systemNotifications].filter((notification) => !dismissedNotificationIds.includes(notification.id)),
    [customNotifications, systemNotifications, dismissedNotificationIds],
  );
  const unreadCount = useMemo(
    () => notifications.filter((notification) => unreadNotificationIds.includes(notification.id)).length,
    [notifications, unreadNotificationIds],
  );

  useEffect(() => {
    const activeTrigger = appTabsRef.current?.querySelector(`[data-app-tab="${activeTab}"]`);
    activeTrigger?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch (error) {
      // Ignore storage write issues and keep the app usable.
    }
  }, [activeTab]);

  useEffect(() => {
    setUnreadNotificationIds((prev) => {
      const next = [...prev];
      notifications.forEach((notification) => {
        if (!next.includes(notification.id)) {
          next.push(notification.id);
        }
      });
      return next.filter((id) => notifications.some((notification) => notification.id === id));
    });
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_NOTIFICATION_STORAGE_KEY, JSON.stringify(dismissedNotificationIds));
    } catch (error) {
      // Dismissal still works for the current session when storage is unavailable.
    }
  }, [dismissedNotificationIds]);

  useEffect(() => {
    const fallbackName = currentUser?.name || currentUser?.username || 'Farmer';
    const fallbackEmail = currentUser?.email || '';

    setFarmer((prev) => ({
      ...prev,
      name: prev.name && prev.name !== 'Farmer Name' ? prev.name : fallbackName,
      email: fallbackEmail || prev.email,
    }));
  }, [currentUser]);

  useEffect(() => {
    const email = currentUser?.email || '';
    if (!email) return;

    let cancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const response = await apiFetch(`/api/me/?email=${encodeURIComponent(email)}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const profile = await response.json();
        if (cancelled) return;

        setFarmer({
          name: profile.name || currentUser?.name || currentUser?.username || 'Farmer',
          email: profile.email || email,
          photo: profile.photo || '',
        });
        setLocation(profile.location || '');

        try {
          const nextUser = {
            ...(currentUser || {}),
            email: profile.email || email,
            name: profile.name || currentUser?.name || currentUser?.username || '',
          };
          localStorage.setItem('auth_user', JSON.stringify(nextUser));
          localStorage.setItem('auth_user_email', nextUser.email || email);
        } catch (e) {}
      } catch (error) {
        if (!cancelled) {
          setFarmer((prev) => ({
            ...prev,
            name: currentUser?.name || currentUser?.username || prev.name || 'Farmer',
            email: email || prev.email,
          }));
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const handleSaveProfile = async () => {
    const email = farmer.email || currentUser?.email || '';
    if (!email) {
      toast.error('No logged-in account found');
      return;
    }

    try {
      const response = await apiFetch('/api/me/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          name: farmer.name,
          location,
          photo: farmer.photo || '',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save profile');
      }

      setFarmer({
        name: payload.name || farmer.name,
        email: payload.email || email,
        photo: payload.photo || '',
      });
      setLocation(payload.location || '');
      setEditing(false);

      try {
        const nextUser = {
          ...(currentUser || {}),
          email: payload.email || email,
          name: payload.name || farmer.name,
        };
        localStorage.setItem('auth_user', JSON.stringify(nextUser));
        localStorage.setItem('auth_user_email', nextUser.email || email);
      } catch (e) {}

      toast.success('Profile saved successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to save profile');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      const response = await apiFetch('/api/password/change/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword: confirmNewPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Password change failed');
      toast.success(data.message);
      setShowPasswordReset(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      toast.error(error.message || 'Password change failed');
    }
  };

  // No outside-click handling needed (dropdown removed). Responsive avatar behavior removed.

  const logoutUser = async () => {
    // Ask backend to clear session cookie (HttpOnly) and server-side session
    try {
      await apiFetch('/api/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
    } catch (e) {
      // ignore network errors; proceed to clear client state anyway
    }

    try {
      ['authState', 'auth_user', 'auth_user_email', 'auth_token'].forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    } catch (e) {}

    if (typeof onBack === 'function') {
      try { onBack(); } catch (e) {}
    }

    try { window.dispatchEvent(new Event('rambutanLogout')); } catch (e) {}
    toast.success(language === 'en' ? 'Logged out' : 'Naka-logout');
  };

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const sensorRequest = apiFetch('/api/sensors/');
        const weatherRequest = location.trim()
          ? apiFetch(`/api/weather/?q=${encodeURIComponent(location.trim())}&days=2`)
          : Promise.resolve(null);
        const [weatherResponse, sensorResponse] = await Promise.all([weatherRequest, sensorRequest]);

        const weatherData = weatherResponse?.ok ? await weatherResponse.json().catch(() => null) : null;
        const sensorData = sensorResponse.ok ? await sensorResponse.json().catch(() => null) : null;

        if (cancelled) return;

        setSystemNotifications(buildAppNotifications(weatherData, sensorData, language));
      } catch (error) {
        if (!cancelled) {
          setSystemNotifications([]);
        }
      }
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 300000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [language, location]);

  const openNotification = (notification) => {
    if (isTabSwitchLocked && notification.tab !== activeTab) return;
    setActiveTab(notification.tab);
    setShowNotifications(false);
  };

  const dismissNotification = (notificationId) => {
    setDismissedNotificationIds((previous) => (
      previous.includes(notificationId) ? previous : [...previous, notificationId]
    ));
    setUnreadNotificationIds((previous) => previous.filter((id) => id !== notificationId));
  };

  const handleTabChange = (nextTab) => {
    if (isTabSwitchLocked && nextTab !== activeTab) {
      return;
    }

    setActiveTab(nextTab);
  };

  const handleDiseaseAnalysisComplete = (analysisResult) => {
    const severity = analysisResult?.severity === 'healthy' ? 'moderate' : 'high';
    const title =
      language === 'tl'
        ? 'Tapos na ang Disease Analysis'
        : 'Disease Analysis Complete';
    const description =
      analysisResult?.severity === 'healthy'
        ? (language === 'tl'
            ? 'Mukhang healthy ang dahon. Pindutin para makita ang detalye.'
            : 'The leaf looks healthy. Tap to view the details.')
        : (language === 'tl'
            ? `${analysisResult?.disease || 'May result na'} ang natukoy. Pindutin para makita ang detalye.`
            : `${analysisResult?.disease || 'A result is ready'} was detected. Tap to view the details.`);

    setCustomNotifications((prev) => [
      {
        id: `disease-analysis-${Date.now()}`,
        title,
        description,
        tab: 'disease',
        severity,
      },
      ...prev.slice(0, 9),
    ]);
  };

  const handleMaturityAnalysisComplete = (analysisResult) => {
    const isReady = analysisResult?.readiness === 'mature';
    const isInvalid = analysisResult?.readiness === 'not_rambutan';
    const severity = isReady ? 'moderate' : 'high';
    const title =
      language === 'tl'
        ? 'Tapos na ang Maturity Analysis'
        : 'Maturity Analysis Complete';
    const description = isInvalid
      ? (language === 'tl'
          ? 'Hindi ito natukoy bilang rambutan. Pindutin para makita ang detalye.'
          : 'This was not identified as a rambutan. Tap to view details.')
      : isReady
        ? (language === 'tl'
            ? 'Hinog ang rambutan sa larawang sinuri. Pindutin para makita ang detalye.'
            : 'The photographed rambutan was classified as ripe. Tap to view details.')
        : (language === 'tl'
            ? `${analysisResult?.stage || 'May result na'} ang natukoy. Pindutin para makita ang detalye.`
            : `${analysisResult?.stage || 'A result is ready'} was detected. Tap to view details.`);

    setCustomNotifications((prev) => [
      {
        id: `maturity-analysis-${Date.now()}`,
        title,
        description,
        tab: 'maturity',
        severity,
      },
      ...prev.slice(0, 9),
    ]);
  };

  // Show a weather toast only when the live API reports a real severe condition.
  useEffect(() => {
    let cancelled = false;

    const loadWeatherToast = async () => {
      const weatherQuery = location.trim();
      if (!weatherQuery) return;
      try {
        const response = await apiFetch(`/api/weather/?q=${encodeURIComponent(weatherQuery)}&days=2`);
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled || data?.ok === false || data?.stale) return;

        const today = Array.isArray(data.forecast) ? data.forecast[0] : null;
        if (!today) return;

        const rainfall = Number(today.rainfall ?? 0);
        const highTemp = Number(today.temperature?.max ?? 0);
        const wind = Number(today.wind ?? 0);
        const condition = String(today.condition || '').toLowerCase();

        let title = '';
        let description = '';

        if (rainfall >= 20 || condition.includes('thunder')) {
          title = language === 'tl' ? 'Maghanda sa Ulan' : 'Prepare for Rain';
          description =
            language === 'tl'
              ? 'Maaaring lumakas ang ulan ngayon. Iwasan munang mag-spray o mag-ani habang maulan.'
              : 'Rain may become heavy today. Avoid spraying or harvesting while it is rainy.';
        } else if (wind >= 45) {
          title = language === 'tl' ? 'Babala sa Malakas na Hangin' : 'Strong Wind Alert';
          description =
            language === 'tl'
              ? `Maaaring umabot sa ${wind} km/h ang hangin ngayong araw. Siguraduhin ang suporta ng mga batang puno.`
              : `Winds may reach ${wind} km/h today. Secure supports for young trees.`;
        } else if (highTemp >= 38) {
          title = language === 'tl' ? 'Babala sa Matinding Init' : 'Extreme Heat Alert';
          description =
            language === 'tl'
              ? `Maaaring umabot sa ${highTemp}°C ang init ngayong araw. Bantayan ang stress ng halaman at pagkatuyo ng lupa.`
              : `Heat may reach ${highTemp}°C today. Watch for plant stress and soil dryness.`;
        }

        if (!title || !description) return;

        toast.error(title, {
          description,
          duration: 10000,
          closeButton: true,
          style: {
            background: '#dc2626',
            color: '#ffffff',
            border: '2px solid #991b1b',
            fontSize: '14px',
          },
          className: 'text-white',
        });
      } catch (error) {
        // Do not show a fake alert when live weather data is unavailable.
      }
    };

    loadWeatherToast();
    return () => {
      cancelled = true;
    };
  }, [language, location]);

  return (
    <div className={`min-h-screen ${activeTab === 'dashboard' || activeTab === 'monitoring' ? 'bg-[#FAF9F5] text-[#1C1917]' : 'bg-[#edf6f2] text-slate-800'}`}>
      <Toaster position="top-right" />
      <Tabs value={activeTab} onValueChange={handleTabChange} className={`dashboard-shell ${activeTab === 'dashboard' || activeTab === 'monitoring' ? 'bg-[#FAF9F5]' : 'bg-[#eef6f2]'}`}>
        <aside className="dashboard-sidebar hidden flex-col bg-[#103F2B] px-4 py-6 text-white">
          <div className="mb-8 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <img src={appLogo} alt="Rambutech" className="h-7 w-7 object-contain" />
              </span>
              <h1 className="font-bold tracking-[0.08em] text-emerald-200">RAMBUTECH</h1>
            </div>
            <p className="ml-[52px] mt-1 text-[10px] font-medium tracking-wide text-emerald-100/65">SMART FARMING SYSTEM</p>
          </div>
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.14em] text-emerald-100/55">MAIN MODULES</p>
          <TabsList ref={appTabsRef} className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
            {appTabs.map((tab) => {
              const Icon = tab.icon;
              return <TabsTrigger key={tab.value} data-app-tab={tab.value} value={tab.value} disabled={isTabSwitchLocked && tab.value !== activeTab}
                className="group flex min-h-12 w-full max-w-full items-center justify-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-semibold text-emerald-100/70 shadow-none transition hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 data-[state=active]:border-white/10 data-[state=active]:bg-white/12 data-[state=active]:text-white data-[state=active]:shadow-none">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-emerald-200 group-data-[state=active]:text-emerald-300"><Icon className="size-5 block" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 whitespace-normal leading-snug">{tab.sidebarLabel}</span>
                {activeTab === tab.value && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />}
              </TabsTrigger>;
            })}
          </TabsList>
          <button onClick={() => setShowAccountModal(true)} className="mt-auto flex items-center gap-3 border-t border-white/10 px-2 pt-5 text-left transition">
            <img src={farmer.photo || DEFAULT_PROFILE_AVATAR} alt="" className="h-10 w-10 rounded-full border border-white/15 object-cover" />
            <span className="min-w-0"><span className="block truncate text-sm font-bold">{farmer.name}</span><span className="block text-xs text-emerald-100/65">Farmer · Account</span></span>
          </button>
        </aside>

        {mobileSidebarOpen && (
          <div className="dashboard-mobile-drawer fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <button aria-label="Close menu" onClick={() => setMobileSidebarOpen(false)} className="absolute inset-0 h-full w-full bg-slate-950/45" />
            <aside className="relative flex h-full w-[278px] flex-col bg-[#103F2B] px-4 py-6 text-white shadow-2xl">
              <div className="mb-8 flex items-start justify-between border-b border-white/10 pb-6">
                <div><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><img src={appLogo} alt="Rambutech" className="h-7 w-7 object-contain" /></span><h1 className="font-bold tracking-[.08em] text-emerald-200">RAMBUTECH</h1></div><p className="ml-[52px] mt-1 text-[10px] font-medium tracking-wide text-emerald-100/65">SMART FARMING SYSTEM</p></div>
                <button onClick={() => setMobileSidebarOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-emerald-100 hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>
              <p className="mb-3 px-3 text-[10px] font-bold tracking-[.14em] text-emerald-100/55">MAIN MODULES</p>
              <TabsList className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0">
                {appTabs.map((tab) => {
                  const Icon = tab.icon;
                  return <TabsTrigger key={tab.value} value={tab.value} onClick={() => setMobileSidebarOpen(false)} className="group flex min-h-12 w-full max-w-full items-center justify-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-semibold text-emerald-100/70 shadow-none transition hover:bg-white/8 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 data-[state=active]:border-white/10 data-[state=active]:bg-white/12 data-[state=active]:text-white">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center text-emerald-200 group-data-[state=active]:text-emerald-300"><Icon className="size-5 block" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1 whitespace-normal leading-snug">{tab.sidebarLabel}</span>
                    {activeTab === tab.value && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300" />}
                  </TabsTrigger>;
                })}
              </TabsList>
              <button onClick={() => { setMobileSidebarOpen(false); setShowAccountModal(true); }} className="mt-auto flex items-center gap-3 border-t border-white/10 px-2 pt-5 text-left"><img src={farmer.photo || DEFAULT_PROFILE_AVATAR} alt="" className="h-10 w-10 rounded-full border border-white/15 object-cover" /><span className="min-w-0"><span className="block truncate text-sm font-bold">{farmer.name}</span><span className="block text-xs text-emerald-100/65">Farmer · Account</span></span></button>
            </aside>
          </div>
        )}

        <div className="dashboard-main-panel min-w-0">
          <header className={`relative ${activeTab === 'dashboard' ? 'border-b border-stone-200 bg-[#FAF9F5] px-4 py-3 text-[#1C1917] sm:px-6 sm:py-4 md:px-8' : activeTab === 'analytics' ? 'min-h-[138px] overflow-hidden bg-[#1D6F42] px-4 py-5 text-white sm:px-9 sm:py-6 md:px-9 md:py-7' : 'min-h-[200px] overflow-hidden bg-gradient-to-r from-[#075137] via-[#0a6947] to-[#32855f] px-4 py-5 text-white sm:min-h-[230px] sm:px-6 sm:py-8 md:px-8 md:py-12'}`}>
            {activeTab !== 'dashboard' && <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[32px] border-white/10" />}
            <div className={`relative flex flex-col justify-between gap-4 sm:gap-6 ${activeTab === 'dashboard' ? 'md:flex-row md:items-center' : 'md:flex-row md:items-start'}`}>
              <div className="min-w-0">
                <div className={`dashboard-mobile-top flex items-center gap-3 ${activeTab === 'dashboard' ? '' : 'mb-4 sm:mb-6'}`}>
                  <button onClick={() => setMobileSidebarOpen(true)} aria-label="Open menu" className={`rounded-xl p-2.5 transition ${activeTab === 'dashboard' ? 'bg-emerald-100 text-[#14532D] hover:bg-emerald-200' : 'bg-white/10 text-white hover:bg-white/20'}`}><Menu className="h-5 w-5" /></button>
                  <span className={`text-xs font-bold tracking-[.14em] ${activeTab === 'dashboard' ? 'text-[#14532D]' : 'text-emerald-200'}`}>RAMBUTECH</span>
                </div>
                {activeTab === 'analytics' ? (
                  <>
                    <p className="text-xs font-medium text-emerald-100/90 sm:text-[13px]">
                      {language === 'tl' ? 'Buod ng Bukid at Mga Tala' : 'Farm Summary & Audit Logs'}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
                      {language === 'tl' ? 'RAMBUTECH Pangkalahatang-ideya ng Bukid' : 'RAMBUTECH Farm Overview'}
                    </h2>
                    <p className="mt-1.5 max-w-2xl text-xs text-emerald-50/85 sm:text-[13.5px]">
                      {language === 'tl'
                        ? 'Subaybayan ang sensor history, AI crop scans, at mga ulat ng bukid.'
                        : 'Monitor historical telemetry, AI crop scans, and downloadable farm reports.'}
                    </p>
                  </>
                ) : activeTab !== 'dashboard' && (
                  <>
                    <p className="text-sm font-semibold text-emerald-100">{language === 'tl' ? 'Magandang Hapon,' : 'Good afternoon,'}</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl md:text-4xl">{farmer.name || 'Farmer'}!</h2>
                    <p className="mt-2 max-w-sm text-xs leading-5 text-emerald-100/75 sm:text-sm sm:leading-6">{language === 'tl' ? 'Bantay ang iyong taniman, para sa mas magandang ani.' : 'Monitor your farm for a healthier, more productive harvest.'}</p>
                  </>
                )}
              </div>
              <div className={`flex items-center gap-3 ${activeTab === 'dashboard' ? 'w-full shrink-0 flex-wrap justify-between sm:justify-end' : 'absolute right-0 top-0 z-20 w-auto'}`}>
              {activeTab === 'dashboard' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setActiveTab('disease')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#14532D] px-3.5 text-xs font-bold text-white transition hover:bg-[#0F3F22] sm:px-4 sm:text-sm">
                    <ScanLine className="h-4 w-4" aria-hidden="true" />{language === 'tl' ? 'Mag-scan ng dahon' : 'Scan a leaf'}
                  </button>
                  <button type="button" onClick={() => setActiveTab('maturity')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-3.5 text-xs font-bold text-[#1C1917] transition hover:border-[#14532D] sm:px-4 sm:text-sm">
                    <Sprout className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{language === 'tl' ? 'Suriin ang pagkahinog' : 'Check maturity'}
                  </button>
                  <div className="hidden items-center rounded-2xl border border-stone-300 bg-stone-200/90 p-1 lg:inline-flex" role="group" aria-label="Language selector">
                    <button type="button" onClick={() => changeLanguage('en')} aria-pressed={language === 'en'} className={`min-h-9 rounded-xl px-3 text-xs font-bold ${language === 'en' ? 'bg-[#14532D] text-white' : 'text-stone-700 hover:bg-stone-300/60'}`}>EN</button>
                    <button type="button" onClick={() => changeLanguage('tl')} aria-pressed={language === 'tl'} className={`min-h-9 rounded-xl px-3 text-xs font-bold ${language === 'tl' ? 'bg-[#14532D] text-white' : 'text-stone-700 hover:bg-stone-300/60'}`}>Tagalog</button>
                  </div>
                </div>
              )}
              <Popover open={showNotifications} onOpenChange={(open) => {
                setShowNotifications(open);
                if (open) setUnreadNotificationIds([]);
              }}>
                <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={language === 'tl' ? 'Mga Notification' : 'Notifications'}
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition ${activeTab === 'dashboard' ? 'bg-emerald-100 text-[#14532D] hover:bg-emerald-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title={language === 'tl' ? 'Mga Notification' : 'Notifications'}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 min-w-[16px] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-red-600 shadow-md">
                      {unreadCount}
                    </span>
                  )}
                </button>
                </PopoverTrigger>

                {showNotifications && (
                  <PopoverContent align="end" sideOffset={12} collisionPadding={12} aria-labelledby="notifications-heading" className="z-[80] w-[calc(100vw-24px)] max-w-[380px] overflow-hidden rounded-2xl border border-emerald-100 bg-white p-0 shadow-2xl">
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-50 px-3 py-2 sm:px-4 sm:py-3">
                      <h3 id="notifications-heading" className="text-sm font-bold text-slate-900 sm:text-base">
                        {language === 'tl' ? 'Mga Notification' : 'Notifications'}
                      </h3>
                      <button type="button" onClick={() => setShowNotifications(false)} aria-label={language === 'tl' ? 'Isara ang notifications' : 'Close notifications'} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(360px, calc(var(--radix-popover-content-available-height) - 68px))' }}>
                      {notifications.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-slate-500 sm:px-4 sm:py-6 sm:text-sm">
                          {language === 'tl'
                            ? 'Wala pang active notifications ngayon.'
                            : 'There are no active notifications right now.'}
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left transition hover:bg-emerald-50 sm:gap-3 sm:px-4 sm:py-3"
                          >
                            <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                              notification.severity === 'high' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            <button type="button" onClick={() => openNotification(notification)} className="flex-1 min-w-0 text-left">
                              <div className="text-xs font-semibold text-slate-900 sm:text-sm">{notification.title}</div>
                              <div className="mt-0.5 text-xs leading-4 text-slate-600 sm:mt-1 sm:leading-5">{notification.description}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => dismissNotification(notification.id)}
                              aria-label={language === 'tl' ? 'Alisin ang notification' : 'Remove notification'}
                              title={language === 'tl' ? 'Alisin' : 'Remove'}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                )}
              </Popover>

              </div>
            </div>
          </header>
          <main className={`mx-auto w-full ${activeTab === 'dashboard' ? 'max-w-7xl px-3 py-4 sm:px-6 sm:py-5 md:px-8' : activeTab === 'analytics' ? 'max-w-[1360px] px-3 py-4 sm:px-6 sm:py-5 md:px-8' : 'max-w-6xl px-3 py-4 sm:px-6 sm:py-5 md:px-10'}`}>

          <TabsContent value="dashboard" className="mt-0 space-y-4 sm:space-y-6">
            <FarmDashboard
              farmerName={farmer.name}
              location={location}
              notifications={notifications}
              onNavigate={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="monitoring" className="mt-0 space-y-4 sm:space-y-6">
            <EnvironmentalMonitoring />
          </TabsContent>

          <TabsContent value="weather" className="space-y-4 sm:space-y-6">
            <WeatherAlerts isActive={activeTab === 'weather'} />
          </TabsContent>

          <TabsContent value="disease" className={activeTab === 'disease' ? 'space-y-4 sm:space-y-6' : 'hidden'} forceMount>
            <DiseaseDetection
              isActive={activeTab === 'disease'}
              onAnalysisComplete={handleDiseaseAnalysisComplete}
              onRequestActiveTab={setActiveTab}
              onCaptureFlowChange={setIsTabSwitchLocked}
            />
          </TabsContent>

          <TabsContent value="maturity" className={activeTab === 'maturity' ? 'space-y-4 sm:space-y-6' : 'hidden'} forceMount>
            <MaturityDetection onAnalysisComplete={handleMaturityAnalysisComplete} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <HistoricalData location={location} />
          </TabsContent>

          {/* Account moved to modal (triggered from header/avatar) */}
          </main>
        </div>
      </Tabs>

      {/* Account Modal */}
      {showAccountModal && (
        <div className="account-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6">
          <div className="account-modal relative max-h-[94vh] w-full max-w-[1080px] overflow-y-auto rounded-[28px] bg-white shadow-2xl ring-1 ring-white/60 md:overflow-hidden">
            {/* Close button positioned absolute */}
            <button type="button" onClick={() => setShowAccountModal(false)} aria-label="Close account modal" className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <X className="h-7 w-7" strokeWidth={2.4} />
            </button>

            <div className="account-modal-grid grid min-h-[680px] grid-cols-1 md:grid-cols-[308px_minmax(0,1fr)]">
              {/* Left Sidebar - Profile Card */}
              <aside
                className="account-profile-panel relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-700 to-[#045238] px-6 py-10 text-white md:px-7 md:py-12"
                style={{ backgroundImage: "linear-gradient(rgba(5, 106, 59, .78), rgba(4, 82, 56, .88)), url('/temp_crop.png')", backgroundPosition: 'center', backgroundSize: 'cover' }}
              >
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-200/15 blur-2xl" />
                <div className="absolute -bottom-16 -left-14 h-48 w-48 rounded-full border-[22px] border-lime-200/20" />
                <Leaf className="absolute bottom-8 right-2 h-28 w-28 rotate-[-28deg] text-lime-200/40" strokeWidth={1.1} />
                <div className="relative z-10 flex h-full flex-col items-center text-center">
                  <img
                    src={farmer.photo || DEFAULT_PROFILE_AVATAR}
                    alt={`${farmer.name} profile`}
                    className="h-32 w-32 rounded-full border-[5px] border-white object-cover shadow-xl"
                  />
                  <span className="absolute top-[105px] right-[calc(50%-80px)] flex h-12 w-12 items-center justify-center rounded-full border-4 border-emerald-700 bg-white text-emerald-800 shadow-md"><Camera className="h-5 w-5" /></span>
                  <h3 className="mt-6 max-w-full break-words text-xl font-bold leading-tight">{farmer.name}</h3>
                  <p className="mt-2 max-w-full break-all text-sm text-emerald-50">{farmer.email}</p>

                  {/* Motivational Quote */}
                  <div className="mt-9 w-full border-t border-white/45 pt-8">
                    <p className="text-base italic leading-relaxed text-white/95">
                      "{language === 'en' ? 'A healthier farm today, a brighter tomorrow.' : 'Mas malusog na bukid ngayon, mas maliwanag na kinabukasan.'}"
                    </p>
                  </div>
                </div>
              </aside>

              {/* Right Side - Settings */}
              <div className="account-settings-panel relative space-y-5 px-6 py-9 sm:px-10 sm:py-10 md:max-h-[94vh] md:overflow-y-auto">
                <Leaf className="pointer-events-none absolute right-12 top-5 h-28 w-28 rotate-[25deg] text-lime-600/15" strokeWidth={1.2} />
                <div className="relative pr-12">
                  <div className="flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><User className="h-8 w-8" /></span>
                    <div>
                      <h3 className="text-3xl font-bold tracking-tight text-slate-900">{language === 'en' ? 'Account Settings' : 'Mga Setting ng Account'}</h3>
                      <p className="mt-1 text-base text-slate-500">{language === 'en' ? 'Manage your farm profile and preferences.' : 'Pamahalaan ang profile at preference ng inyong bukid.'}</p>
                    </div>
                  </div>
                </div>

                {/* Profile Section */}
                <div className="space-y-4">

                  <div>
                    <label className="mb-2 flex items-center gap-3 text-base font-bold text-slate-800">
                      <User className="h-5 w-5 text-slate-700" />
                      {language === 'en' ? 'Full Name' : 'Buong Pangalan'}
                    </label>
                    <input
                      aria-label="Full name"
                      disabled={!editing}
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                      value={farmer.name}
                      onChange={(e) => setFarmer(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-3 text-base font-bold text-slate-800">
                      <span className="text-emerald-700">✉</span>
                      {language === 'en' ? 'Email Address' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      disabled
                      className="h-14 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-base text-slate-500 cursor-not-allowed"
                      value={farmer.email}
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center gap-3 text-base font-bold text-slate-800">
                      <MapPin className="h-5 w-5 text-slate-700" />
                      {language === 'en' ? 'Farm Location' : 'Lokasyon ng bukid'}
                    </label>
                    <input
                      disabled={!editing}
                      placeholder={language === 'en' ? 'Enter your farm location (e.g. Victoria, Oriental Mindoro)' : 'Ilagay ang lokasyon ng inyong bukid'}
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-1">
                    {editing ? (
                      <>
                        <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-slate-300 py-3 font-bold text-slate-700 hover:bg-slate-50 transition">
                          {language === 'en' ? 'Cancel' : 'Kanselahin'}
                        </button>
                        <button type="button" onClick={handleSaveProfile} className="flex-[1.25] rounded-xl py-3 font-bold text-white shadow-sm hover:opacity-90 transition flex items-center justify-center gap-2" style={{ backgroundColor: '#047857' }}>
                          <Save className="h-5 w-5" />
                          {language === 'en' ? 'Save profile' : 'I-save ang profile'}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setEditing(true)} className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white shadow-sm hover:bg-emerald-800 transition flex items-center justify-center gap-2">
                        <Edit className="h-5 w-5" />
                        {language === 'en' ? 'Edit Profile' : 'I-edit ang profile'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Password Section */}
                <div className="border-t border-slate-200 pt-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="flex items-center gap-3 text-lg font-bold text-slate-800">
                        <KeyRound className="h-6 w-6 text-slate-700" />
                        {language === 'en' ? 'Password' : 'Password'}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">{language === 'en' ? 'Change your account password for better security.' : 'Palitan ang password ng inyong account.'}</p>
                    </div>
                  {!showPasswordReset && (
                    <button type="button" onClick={() => setShowPasswordReset(true)} className="shrink-0 rounded-xl bg-emerald-50 px-5 py-3 font-bold text-emerald-800 transition hover:bg-emerald-100">
                      {language === 'en' ? 'Change password' : 'Baguhin ang password'}
                    </button>
                  )}
                  </div>
                  {showPasswordReset && (
                    <form onSubmit={handlePasswordReset} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                      <input type="password" placeholder={language === 'en' ? 'Current password' : 'Kasalukuyang password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input type="password" placeholder={language === 'en' ? 'New password' : 'Bagong password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <input type="password" placeholder={language === 'en' ? 'Confirm new password' : 'Kumpirmahin ang bagong password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition">
                          {language === 'en' ? 'Save Password' : 'I-save ang Password'}
                        </button>
                        <button type="button" onClick={() => setShowPasswordReset(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition">
                          {language === 'en' ? 'Cancel' : 'Kanselahin'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Language Section */}
                <div className="border-t border-slate-200 pt-5">
                  <h4 className="flex items-center gap-3 text-lg font-bold text-slate-800">
                    <Globe className="h-6 w-6 text-slate-700" />
                    {language === 'en' ? 'Language' : 'Wika'}
                  </h4>
                  <p className="text-sm text-gray-600">{language === 'en' ? 'Choose your preferred language.' : 'Piliin ang inyong ginustong wika.'}</p>
                  <div className="mt-4 flex gap-3">
                    <button type="button" onClick={() => changeLanguage('en')} className="flex-1 rounded-xl py-3 font-bold transition" style={language === 'en' ? { backgroundColor: '#047857', color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#1f2937' }}>
                      {language === 'en' ? '✓ English' : 'English'}
                    </button>
                    <button type="button" onClick={() => changeLanguage('tl')} className="flex-1 rounded-xl py-3 font-bold transition" style={language === 'tl' ? { backgroundColor: '#047857', color: '#ffffff' } : { backgroundColor: '#f1f5f9', color: '#1f2937' }}>
                      {language === 'tl' ? '✓ Tagalog' : 'Tagalog'}
                    </button>
                  </div>
                </div>

                <ConsentSettings onWithdrawn={logoutUser} />

                {/* Logout Section */}
                <div className="border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-200 py-3 font-bold text-rose-600 transition hover:bg-rose-50"
                    onClick={() => setShowLogoutConfirm(true)}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>{language === 'en' ? 'Logout' : 'Mag-logout'}</span>
                  </button>
                </div>

                {showLogoutConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="bg-black/40 absolute inset-0 z-0" onClick={() => setShowLogoutConfirm(false)} />
                    <div className="bg-white rounded-lg shadow-lg p-6 relative z-10 w-full max-w-md">
                      <h4 className="text-lg font-semibold">{language === 'en' ? 'Are you sure you want to log out?' : 'Sigurado ka bang mag-logout?'}</h4>
                      <p className="text-sm text-gray-600 mt-2">{language === 'en' ? 'You will be returned to the login screen.' : 'Ibabalik ka sa login screen.'}</p>
                      <div className="mt-4 flex gap-3">
                        <button type="button" className="flex-1 border border-red-300 text-red-600 hover:bg-red-50 py-2 rounded-lg flex items-center justify-center gap-2 font-semibold transition" onClick={() => { setShowLogoutConfirm(false); setShowAccountModal(false); logoutUser(); }}>
                          <LogOut className="w-4 h-4" />
                          <span>{language === 'en' ? 'Yes, log out' : 'Oo, mag-logout'}</span>
                        </button>
                        <button type="button" className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 rounded-lg font-semibold transition" onClick={() => setShowLogoutConfirm(false)}>
                          {language === 'en' ? 'Cancel' : 'Kanselahin'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PrototypeApp;
