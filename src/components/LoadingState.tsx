export default function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status"><span className="sync-spinner" aria-hidden="true" />{label}...</div>;
}
