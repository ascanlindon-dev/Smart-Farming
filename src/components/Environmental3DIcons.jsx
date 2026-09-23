export function Thermometer3D({ className = 'h-full w-full', trend = 'stable' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><defs><radialGradient id="env-t-bulb" cx="35%" cy="35%" r="60%"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="100%" stopColor="#dc2626"/></radialGradient><linearGradient id="env-t-tube" x1="0%" y1="0%" x2="100%" y2="0%"><stop stopColor="#fca5a5"/><stop offset=".45" stopColor="#fff" stopOpacity=".95"/><stop offset="1" stopColor="#fca5a5"/></linearGradient><linearGradient id="env-t-mercury" x1="0%" y1="100%" x2="0%" y2="0%"><stop stopColor="#dc2626"/><stop offset="1" stopColor="#f97316"/></linearGradient><filter id="env-t-shadow"><feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#dc262640"/></filter></defs><rect x="33" y="10" width="14" height="42" rx="7" fill="url(#env-t-tube)" stroke="#fca5a5" strokeWidth="1.5" filter="url(#env-t-shadow)"/><rect x="37" y="24" width="6" height="28" rx="3" fill="url(#env-t-mercury)"/><path d="M47 18h5m-5 16h5m-5-8h3m-3 16h3" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/><circle cx="40" cy="57" r="11" fill="url(#env-t-bulb)" filter="url(#env-t-shadow)"/><circle cx="36" cy="53" r="3.5" fill="#fff" fillOpacity=".35"/>{trend === 'up' && <g stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M58 30V16"/><path d="m54 21 4-7 4 7"/></g>}{trend === 'down' && <g stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M58 16v14"/><path d="m54 25 4 7 4-7"/></g>}</svg>;
}

export function WaterDrop3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><defs><radialGradient id="env-drop" cx="35%" cy="30%" r="65%"><stop stopColor="#7dd3fc"/><stop offset=".6" stopColor="#2563eb"/><stop offset="1" stopColor="#1e3a8a"/></radialGradient><radialGradient id="env-drop-shine" cx="35%" cy="25%" r="40%"><stop stopColor="#fff" stopOpacity=".7"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient><filter id="env-drop-shadow"><feDropShadow dx="2" dy="4" stdDeviation="4" floodColor="#2563eb50"/></filter></defs><path d="M40 12S20 36 20 50c0 11 9 18 20 18s20-7 20-18C60 36 40 12 40 12Z" fill="url(#env-drop)" filter="url(#env-drop-shadow)"/><path d="M40 12S20 36 20 50c0 11 9 18 20 18s20-7 20-18C60 36 40 12 40 12Z" fill="url(#env-drop-shine)"/><ellipse cx="34" cy="36" rx="5" ry="8" fill="#fff" fillOpacity=".3" transform="rotate(-20 34 36)"/></svg>;
}

export function RainCloud3D({ className = 'h-full w-full', isRaining = false }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">{!isRaining && <g opacity=".9"><circle cx="26" cy="30" r="11" fill="#f59e0b"/><circle cx="22" cy="26" r="2.5" fill="#fff" fillOpacity=".5"/></g>}<path d="M55 52H25c-8 0-13-6-13-13 0-6 4-11 10-12 0-7 6-13 14-13 7 0 13 5 14 12 2-1 4-1 7 0 6 2 10 8 8 14-1 7-5 12-10 12Z" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1.5"/><path d="M24 32c6-7 15-10 25-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".65"/>{isRaining && <g fill="#2563eb"><ellipse cx="28" cy="61" rx="1.5" ry="4"/><ellipse cx="36" cy="65" rx="1.5" ry="4"/><ellipse cx="44" cy="61" rx="1.5" ry="4"/><ellipse cx="52" cy="65" rx="1.5" ry="4"/></g>}</svg>;
}

export function Leaf3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><path d="M40 68S14 54 14 30c0-14 12-20 26-20s26 6 26 20C66 54 40 68 40 68Z" fill="#16a34a" stroke="#14532d" strokeWidth="2"/><path d="M40 64V14M40 36C32 30 20 28 20 28m20 8c8-6 20-8 20-8" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round"/><ellipse cx="34" cy="24" rx="5" ry="8" fill="#bbf7d0" fillOpacity=".7" transform="rotate(-15 34 24)"/></svg>;
}

export function Lightbulb3D() {
  return <svg viewBox="0 0 80 80" className="h-full w-full" fill="none" aria-hidden="true"><defs><radialGradient id="env-bulb" cx="45%" cy="35%" r="65%"><stop stopColor="#fef9c3"/><stop offset=".4" stopColor="#fbbf24"/><stop offset="1" stopColor="#d97706"/></radialGradient><filter id="env-bulb-shadow"><feDropShadow dx="1" dy="3" stdDeviation="4" floodColor="#d9770650"/></filter></defs><circle cx="40" cy="34" r="20" fill="#fbbf24" fillOpacity=".15"/><path d="M40 12c-12 0-18 10-18 20 0 8 4 14 10 18v6q0 2 2 2h12q2 0 2-2v-6c6-4 10-10 10-18 0-10-6-20-18-20Z" fill="url(#env-bulb)" filter="url(#env-bulb-shadow)"/><path d="M34 54h12" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/><rect x="34" y="58" width="12" height="4" rx="2" fill="#d97706"/><rect x="35" y="62" width="10" height="3" rx="1.5" fill="#b45309"/><rect x="36" y="65" width="8" height="3" rx="1.5" fill="#92400e"/><ellipse cx="34" cy="24" rx="4" ry="7" fill="#fff" fillOpacity=".35" transform="rotate(-20 34 24)"/></svg>;
}

export function Rambutan3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="env-rambutan-body" cx="32%" cy="24%" r="78%"><stop stopColor="#fb7185"/><stop offset=".48" stopColor="#e11d48"/><stop offset="1" stopColor="#881337"/></radialGradient>
      <linearGradient id="env-rambutan-spikes" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fecdd3"/><stop offset=".45" stopColor="#fb7185"/><stop offset="1" stopColor="#9f1239"/></linearGradient>
      <linearGradient id="env-rambutan-leaf" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#bbf7d0"/><stop offset=".55" stopColor="#22c55e"/><stop offset="1" stopColor="#166534"/></linearGradient>
    </defs>
    <path d="M40 22C26 18 16 25 14 39c-2 14 8 27 25 29 17 2 29-8 29-23 0-13-11-22-28-23Z" fill="#e11d48" stroke="#881337" strokeWidth="2"/>
    <path d="M22 28 17 20m11 7-1-11m10 10 3-12m5 14 7-10m2 15 10-6M20 39l-9-2m12 12-9 4m17 6-5 10m15-11 2 11m9-17 8 8m-6-19 11 1" stroke="#fb7185" strokeWidth="3" strokeLinecap="round"/>
    <path d="M40 22c-1-8 2-13 8-17" stroke="#78350f" strokeWidth="3" strokeLinecap="round"/>
    <path d="M43 12c-4-8-15-9-21-4 4 7 12 10 21 7Zm5-1c4-9 14-11 21-6-3 8-11 12-21 10Z" fill="#22c55e" stroke="#166534" strokeWidth="1.5"/>
    <path d="M25 30c5-6 14-8 20-5" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".42"/>
    <circle cx="28" cy="35" r="3" fill="#fff" opacity=".35"/>
  </svg>;
}

export function Activity3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><defs><linearGradient id="env-activity" x1="10" y1="12" x2="68" y2="68"><stop stopColor="#a7f3d0"/><stop offset=".55" stopColor="#10b981"/><stop offset="1" stopColor="#047857"/></linearGradient><filter id="env-activity-shadow"><feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#04785755"/></filter></defs><circle cx="40" cy="40" r="28" fill="url(#env-activity)" filter="url(#env-activity-shadow)"/><path d="M18 43h11l6-17 9 29 7-18h11" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="28" cy="43" r="3" fill="#ecfdf5"/></svg>;
}

export function Analytics3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><defs><linearGradient id="env-chart" x1="12" y1="10" x2="68" y2="70"><stop stopColor="#bfdbfe"/><stop offset=".5" stopColor="#3b82f6"/><stop offset="1" stopColor="#1e40af"/></linearGradient><filter id="env-chart-shadow"><feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#1e40af55"/></filter></defs><rect x="12" y="12" width="56" height="56" rx="18" fill="url(#env-chart)" filter="url(#env-chart-shadow)"/><path d="M23 56V25M23 56h35" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="m29 48 9-10 8 5 9-15" stroke="#dbeafe" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="55" cy="28" r="3" fill="white"/></svg>;
}

export function Monitor3D({ className = 'h-full w-full' }) {
  return <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true"><defs><linearGradient id="env-monitor" x1="10" y1="10" x2="70" y2="70"><stop stopColor="#e2e8f0"/><stop offset=".45" stopColor="#64748b"/><stop offset="1" stopColor="#1e293b"/></linearGradient><filter id="env-monitor-shadow"><feDropShadow dx="2" dy="3" stdDeviation="3" floodColor="#0f172a55"/></filter></defs><rect x="13" y="14" width="54" height="40" rx="8" fill="url(#env-monitor)" filter="url(#env-monitor-shadow)"/><rect x="19" y="20" width="42" height="28" rx="4" fill="#0f766e"/><path d="m25 39 8-8 7 5 9-10" stroke="#a7f3d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M32 64h16M40 54v10" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round"/></svg>;
}
