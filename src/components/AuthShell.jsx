import { Activity, CloudSun, Leaf, ShieldCheck } from 'lucide-react';
import appLogo from '../assets/app-logo.png';

function RambutanIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label="Rambutan cluster">
      <path d="M58 26C35 12 16 22 18 40c18 2 30-5 40-14Zm4-2c22-14 42-4 40 14-18 2-30-5-40-14Z" fill="#15803d" />
      <path d="M60 12v32M60 32 40 58m20-22 20 26" stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="78" cy="68" r="19" fill="#991b1b" />
      <circle cx="42" cy="66" r="20" fill="#dc2626" />
      <circle cx="63" cy="82" r="22" fill="#b91c1c" />
      <circle cx="57" cy="76" r="7" fill="#ef4444" opacity=".6" />
      <g stroke="#fca5a5" strokeWidth="2.3" strokeLinecap="round">
        <path d="M63 54v6m14-2-3 5m13 6-5 3m7 12-5-1m-3 15-4-4m-13 14v-5m-16-1 3-5m-13-8 5-2m-5-14 5 2m5-15 3 5" />
        <path d="m42 41 0 5m-19 6 4 3m-10 13h5m2 15 4-4m14 12v-5m36-37 0 5m18 5-4 3m9 13h-5m-2 15-4-4" />
      </g>
    </svg>
  );
}

export default function AuthShell({
  children,
  language,
  onLanguageChange,
  badge,
}) {
  const isTagalog = language === 'tl';

  return (
    <div className="auth-shell-frame bg-stone-950 font-sans text-stone-900">
      <main className="auth-shell-card mx-auto overflow-hidden bg-[#F2F0E8] shadow-2xl">
        <aside
          className="auth-shell-aside relative overflow-hidden text-white"
        >
          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-2">
              <img src={appLogo} alt="" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0">
              <span className="auth-brand-name block text-xl font-extrabold tracking-wide text-white sm:text-2xl">
                RAMBUTECH
              </span>
              <span className="mt-1 block text-xs font-medium text-emerald-100 sm:text-sm">
                {isTagalog ? 'Matalinong Pagsubaybay sa Bukid' : 'Smart Rambutan Farm Monitoring'}
              </span>
            </div>
          </div>

          <div className="auth-shell-showcase relative z-10 my-5 rounded-3xl border border-white/15 bg-[#0F4229]/70 p-4 sm:p-6 lg:my-0">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-[#F4F7EF] p-1.5 sm:h-28 sm:w-28">
                <RambutanIllustration />
              </div>
              <div className="min-w-0 space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
                  {isTagalog ? 'Gabay sa Rambutan Farm' : 'Smart Orchard Care'}
                </span>
                <h2 className="auth-heading text-base font-bold leading-snug text-white sm:text-lg">
                  {isTagalog ? 'Mas maagang pag-alaga. Mas handang ani.' : 'Better care starts with better farm insights.'}
                </h2>
                <p className="hidden text-xs leading-relaxed text-emerald-50/80 sm:block sm:text-sm">
                  {isTagalog
                    ? 'Subaybayan ang kondisyon ng bukid, suriin ang mga dahon at bunga, at gumamit ng praktikal na gabay.'
                    : 'Monitor field conditions, assess leaves and fruit, and get practical guidance for your orchard.'}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-[11px] font-semibold text-emerald-50 sm:gap-3 sm:text-xs">
              <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{isTagalog ? 'Mga Sensor' : 'Sensors'}</span>
              <span className="flex items-center gap-1.5"><CloudSun className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{isTagalog ? 'Panahon' : 'Weather'}</span>
              <span className="flex items-center gap-1.5"><Leaf className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{isTagalog ? 'Pagsusuri' : 'Crop scans'}</span>
            </div>
          </div>

          <div className="relative z-10 hidden items-center justify-between border-t border-white/15 pt-4 text-xs text-emerald-100/80 lg:flex">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {isTagalog ? 'Para sa matalinong pag-aalaga ng bukid' : 'Designed for confident orchard care'}
            </span>
            <span className="font-semibold text-white">RAMBUTECH</span>
          </div>
        </aside>

        <section className="auth-shell-section bg-[#FAF9F5]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="rounded-lg bg-emerald-100/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#14532D]">
              {badge || (isTagalog ? 'Portal ng Magsasaka' : 'Farmer Portal')}
            </span>
            <div className="inline-flex items-center rounded-2xl border border-stone-300 bg-stone-200/90 p-1" role="group" aria-label="Language selector">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                aria-pressed={!isTagalog}
                className={`min-h-10 rounded-xl px-3.5 text-xs font-bold transition sm:text-sm ${
                  !isTagalog ? 'bg-[#14532D] text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300/60'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('tl')}
                aria-pressed={isTagalog}
                className={`min-h-10 rounded-xl px-3.5 text-xs font-bold transition sm:text-sm ${
                  isTagalog ? 'bg-[#14532D] text-white shadow-sm' : 'text-stone-700 hover:bg-stone-300/60'
                }`}
              >
                Tagalog
              </button>
            </div>
          </div>
          <div className="auth-shell-content">
            {children}
          </div>
          <p className="mt-5 text-center text-xs text-stone-500">
            {isTagalog ? 'Mga solusyon sa pagsasaka ng rambutan' : 'Smart farming solutions for rambutan cultivation'}
          </p>
        </section>
      </main>
    </div>
  );
}
