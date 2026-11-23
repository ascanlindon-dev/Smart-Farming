import { Leaf, ShieldCheck } from 'lucide-react';

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
          style={{
            backgroundColor: '#14532D',
            backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15">
              <Leaf className="h-7 w-7 text-emerald-200" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <span className="block text-xl font-extrabold tracking-wide text-white sm:text-2xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                RAMBUTECH
              </span>
              <span className="mt-1 block text-xs font-medium text-emerald-100 sm:text-sm">
                {isTagalog ? 'Proteksyon at Pagsusuri ng Pananim' : 'Farm Resilience & Disease Detection'}
              </span>
            </div>
          </div>

          <div className="relative z-10 my-5 rounded-2xl border border-emerald-300/25 bg-emerald-950/50 p-4 backdrop-blur-sm sm:p-5 lg:my-0">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-100 p-1.5 shadow-md sm:h-28 sm:w-28">
                <RambutanIllustration />
              </div>
              <div className="min-w-0 space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {isTagalog ? 'Gabay sa Rambutan Farm' : 'Smart Orchard Care'}
                </span>
                <h2 className="text-base font-bold leading-snug text-white sm:text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {isTagalog ? 'Pangalagaan nang maaga ang iyong ani.' : 'Protect your rambutan harvest early.'}
                </h2>
                <p className="hidden text-xs leading-relaxed text-emerald-100/90 sm:block sm:text-sm">
                  {isTagalog
                    ? 'Suriin ang dahon at bunga upang makita agad ang sakit at makakuha ng praktikal na gabay.'
                    : 'Scan leaves and fruit to spot diseases early and get practical care guidance.'}
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 hidden items-center justify-between border-t border-white/15 pt-4 text-xs text-emerald-100/80 lg:flex">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {isTagalog ? 'Para sa pangangalaga ng bukid' : 'Built for orchard care'}
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
