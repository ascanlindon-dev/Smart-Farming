import { useContext, useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch.mjs';
import { LanguageContext } from '../LanguageContext';
import AuthShell from './AuthShell';

const noticeSections = {
  en: [
    {
      title: 'Purpose of Data Collection',
      body: 'RAMBUTECH uses account and farm information to provide sign-in, farm monitoring, weather, and plant disease or maturity assessment features. Research use is separate and happens only when you voluntarily select the research consent checkbox.',
    },
    {
      title: 'Types of Information Collected',
      body: 'This may include your name and email address; farm location; leaf or fruit images you submit for analysis; sensor readings such as temperature, humidity, soil moisture, and rainfall; system-generated predictions; and basic records needed to protect and operate your account.',
    },
    {
      title: 'How Personal Data Will Be Used',
      body: 'Information is used to authenticate your account, show your farm data, provide the features you request, maintain system security, and respond to support requests. Research analysis or research questionnaires are allowed only while your current research consent is active. Declining research does not prevent use of regular farm features after you accept this Privacy Notice.',
    },
    {
      title: 'Data Storage and Security',
      body: 'Production account and consent records are stored in the project Supabase-hosted PostgreSQL database. The application uses authenticated server requests, restricted database access, and Row Level Security for consent records. Passwords are stored as hashes. Development data remains in the local development database. The project team retains data only while needed to provide the service or under the approved research retention schedule, then deletes or de-identifies it as applicable.',
    },
    {
      title: 'Data Confidentiality',
      body: 'Access is limited to authorized project personnel who need the information to operate the system or administer the study. RAMBUTECH does not sell personal data. Information may be disclosed only to service providers under appropriate safeguards or when required by law.',
    },
    {
      title: 'User Rights and Withdrawal of Consent',
      body: 'Under the Data Privacy Act of 2012 (RA 10173), you may request access to or correction of your information, object to or withdraw consent, request blocking or erasure where applicable, and raise a concern with the National Privacy Commission. Use Account Settings to review or withdraw consent. Withdrawing all consent ends access to the farm system until you provide current Privacy Notice consent again. For other privacy requests, contact the RAMBUTECH project administrator or the Data Protection Officer designated by the responsible institution.',
    },
  ],
  tl: [
    {
      title: 'Layunin ng Pangongolekta ng Datos',
      body: 'Ginagamit ng RAMBUTECH ang impormasyon ng account at bukid upang maibigay ang pag-sign in, pagsubaybay sa bukid, impormasyon sa panahon, at pagsusuri ng sakit o pagkahinog ng halaman. Hiwalay at boluntaryo ang paggamit para sa pananaliksik; gagamitin lamang ito kapag pinili mo ang pahintulot sa pananaliksik.',
    },
    {
      title: 'Mga Uri ng Impormasyong Kinokolekta',
      body: 'Maaaring kasama rito ang iyong pangalan at email; lokasyon ng bukid; mga larawan ng dahon o bunga na ipinasa para suriin; datos ng sensor gaya ng temperatura, halumigmig, halumigmig ng lupa at ulan; mga resultang ginawa ng system; at pangunahing rekord na kailangan upang maprotektahan at mapatakbo ang iyong account.',
    },
    {
      title: 'Paano Gagamitin ang Personal na Datos',
      body: 'Ginagamit ang impormasyon upang patunayan ang iyong account, ipakita ang datos ng bukid, ibigay ang mga feature na hinihiling mo, panatilihin ang seguridad ng system, at tumugon sa mga kahilingan para sa tulong. Gagamitin lamang sa pagsusuri ng pananaliksik o questionnaire habang aktibo ang iyong pahintulot sa pananaliksik. Maaari mo pa ring gamitin ang karaniwang farm features kung tatanggihan mo ang pananaliksik ngunit tatanggapin mo ang Privacy Notice.',
    },
    {
      title: 'Pag-iimbak at Seguridad ng Datos',
      body: 'Iniimbak ang production account at consent records sa Supabase-hosted PostgreSQL database ng proyekto. Gumagamit ang application ng authenticated server requests, limitadong database access, at Row Level Security para sa consent records. Hash ang iniimbak na password. Nanatili sa lokal na database ang development data. Itinatago lamang ang datos habang kailangan sa serbisyo o ayon sa aprubadong iskedyul ng pananaliksik; pagkatapos nito, buburahin o aalisan ng pagkakakilanlan kung naaangkop.',
    },
    {
      title: 'Pagiging Kumpidensiyal ng Datos',
      body: 'Tanging awtorisadong kawani ng proyekto na nangangailangan ng impormasyon para patakbuhin ang system o pangasiwaan ang pag-aaral ang may access. Hindi ipinagbibili ng RAMBUTECH ang personal na datos. Maaari lamang itong ibahagi sa mga service provider na may angkop na pananggalang o kapag hinihingi ng batas.',
    },
    {
      title: 'Mga Karapatan ng User at Pag-withdraw ng Pahintulot',
      body: 'Sa ilalim ng Data Privacy Act of 2012 (RA 10173), maaari kang humiling na makita o itama ang iyong impormasyon, tumutol o mag-withdraw ng pahintulot, humiling ng pagharang o pagbura kung naaangkop, at magsumite ng hinaing sa National Privacy Commission. Gamitin ang Account Settings upang suriin o bawiin ang pahintulot. Kapag binawi ang lahat ng pahintulot, matatapos ang access sa farm system hanggang muli mong tanggapin ang kasalukuyang Privacy Notice. Para sa ibang kahilingan sa privacy, makipag-ugnayan sa project administrator o Data Protection Officer ng responsableng institusyon.',
    },
  ],
};

export default function ConsentPage({
  initialConsent,
  currentVersion,
  mode = 'gate',
  onAccepted,
  onDecline,
}) {
  const { language, changeLanguage } = useContext(LanguageContext);
  const isTagalog = language === 'tl';
  const [researchConsent, setResearchConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const hasCurrentConsent = Boolean(
      initialConsent
      && initialConsent.consent_version === currentVersion
      && !initialConsent.withdrawn_at
    );
    setResearchConsent(hasCurrentConsent && Boolean(initialConsent.research_consent));
    setPrivacyConsent(hasCurrentConsent && Boolean(initialConsent.privacy_consent));
  }, [initialConsent, currentVersion]);

  const saveConsent = async (research, privacy) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await apiFetch('/api/consent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_consent: research,
          privacy_consent: privacy,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to save your consent choices.');
      }
      onAccepted(result);
    } catch (requestError) {
      setError(requestError.message || 'Unable to save your consent choices.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAgree = (event) => {
    event.preventDefault();
    if (!privacyConsent) return;
    saveConsent(researchConsent, privacyConsent);
  };

  const handleDecline = () => {
    if (mode === 'review') {
      onDecline?.();
      return;
    }
    if (privacyConsent) {
      saveConsent(false, true);
      return;
    }
    onDecline?.();
  };

  const sections = noticeSections[isTagalog ? 'tl' : 'en'];

  return (
    <div className={mode === 'review' ? 'fixed inset-0 z-[70] overflow-y-auto' : ''}>
      <AuthShell
        language={language}
        onLanguageChange={changeLanguage}
        badge={isTagalog ? 'Paalala sa Privacy' : 'Data Privacy'}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-[#14532D]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#14532D]">
                {isTagalog ? `Bersyon ${currentVersion}` : `Version ${currentVersion}`}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {isTagalog ? 'Paalala sa Data Privacy at Pahintulot' : 'Data Privacy Notice & Consent'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {isTagalog
                  ? 'Basahin ang paalalang ito tungkol sa pagproseso ng datos sa ilalim ng RA 10173. Boluntaryo ang pagsali sa pananaliksik.'
                  : 'Please review this notice about data processing under RA 10173. Participation in research is voluntary.'}
              </p>
            </div>
          </div>

          <div className="max-h-[34vh] space-y-3 overflow-y-auto rounded-2xl border border-[#D6D3CD] bg-white p-4 pr-3 shadow-sm sm:max-h-[38vh] sm:p-5" aria-label={isTagalog ? 'Mga detalye ng Privacy Notice' : 'Privacy Notice details'}>
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-sm font-bold text-[#14532D]">{section.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">{section.body}</p>
              </section>
            ))}
            <p className="border-t border-stone-200 pt-3 text-xs leading-relaxed text-stone-500">
              {isTagalog
                ? 'Ang responsableng institusyon, opisyal na contact ng Data Protection Officer, at tiyak na panahon ng retention ay dapat kumpirmahin sa aprubadong protocol ng proyekto bago mangalap ng datos para sa pag-aaral.'
                : 'The responsible institution, official Data Protection Officer contact, and exact retention period should be confirmed in the approved project protocol before study data is collected.'}
            </p>
          </div>

          <form onSubmit={handleAgree} className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-300 bg-white p-3.5 text-sm leading-relaxed text-stone-800 transition hover:border-emerald-700">
              <input
                type="checkbox"
                checked={researchConsent}
                onChange={(event) => setResearchConsent(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#14532D] focus:ring-2 focus:ring-emerald-700"
              />
              <span>
                {isTagalog
                  ? 'Boluntaryo akong sumasang-ayon na lumahok sa pag-aaral ng RAMBUTECH.'
                  : 'I voluntarily agree to participate in the RAMBUTECH research study.'}
                <span className="mt-1 block text-xs text-stone-500">
                  {isTagalog ? 'Opsyonal. Maaari mong tanggihan ito at gamitin pa rin ang karaniwang farm system.' : 'Optional. You may decline and still use the regular farm system.'}
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-300 bg-white p-3.5 text-sm leading-relaxed text-stone-800 transition hover:border-emerald-700">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(event) => setPrivacyConsent(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#14532D] focus:ring-2 focus:ring-emerald-700"
              />
              <span>
                {isTagalog
                  ? 'Nabasa at naunawaan ko ang Data Privacy Notice at sumasang-ayon ako sa pagproseso ng aking personal na datos para sa mga layuning nakasaad.'
                  : 'I have read and understood the Data Privacy Notice and consent to the processing of my personal data for the stated purposes.'}
                <span className="mt-1 block text-xs text-stone-500">
                  {isTagalog ? 'Kailangan ito upang magamit ang farm system.' : 'Required to use the farm system.'}
                </span>
              </span>
            </label>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="grid gap-3 pt-1 sm:grid-cols-[1fr_auto]">
              <button
                type="submit"
                disabled={!privacyConsent || submitting}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#14532D] px-5 text-base font-bold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-[#0F3F22] focus:outline-none focus:ring-4 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none"
              >
                {submitting
                  ? (isTagalog ? 'Sine-save...' : 'Saving...')
                  : (mode === 'review'
                    ? (isTagalog ? 'I-save ang mga pagpili' : 'Save preferences')
                    : (isTagalog ? 'Sumang-ayon at Magpatuloy' : 'Agree and Continue'))}
                {!submitting && <ChevronRight className="h-5 w-5" aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={submitting}
                className="min-h-[52px] rounded-2xl border-2 border-stone-300 px-5 text-sm font-bold text-stone-700 transition hover:border-stone-400 hover:bg-stone-100 focus:outline-none focus:ring-4 focus:ring-stone-400/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTagalog ? 'Tanggihan' : 'Decline'}
              </button>
            </div>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-stone-500">
              <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {isTagalog
                ? 'Itinatala lamang ang mga kahong pinili mo kapag pinindot mo ang button. Ang petsa at oras ay itinatakda ng server.'
                : 'Only the choices you make are recorded when you submit. The server records the actual date and time.'}
            </p>
          </form>

          {mode === 'review' && (
            <button type="button" onClick={onDecline} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-[#14532D] hover:underline">
              <Check className="h-4 w-4" aria-hidden="true" />
              {isTagalog ? 'Bumalik sa Account Settings' : 'Return to Account Settings'}
            </button>
          )}
        </div>
      </AuthShell>
    </div>
  );
}
