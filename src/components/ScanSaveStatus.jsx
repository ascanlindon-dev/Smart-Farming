export default function ScanSaveStatus({ storage, language }) {
  if (!storage) return null;
  const tl = language === 'tl';
  const failed = !storage.saved || storage.cloud_saved === false;
  const message = !storage.saved
    ? (tl ? 'Nasuri ang larawan pero hindi nai-save ang resulta. Subukan ulit.' : 'The photo was analyzed, but the result could not be saved. Please try again.')
    : storage.cloud_saved === false
      ? (tl ? 'Na-save ang resulta sa lokal na scan history, pero hindi pa sa cloud.' : 'The result is saved in local scan history, but cloud sync failed.')
      : storage.cloud_saved
        ? (tl ? 'Na-save ang resulta sa cloud at scan history.' : 'Result saved to cloud and scan history.')
        : (tl ? 'Na-save ang resulta sa scan history.' : 'Result saved to scan history.');
  return (
    <p role={failed ? 'alert' : 'status'} className={`mb-4 rounded-lg border p-3 text-sm ${failed ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {message}
    </p>
  );
}
