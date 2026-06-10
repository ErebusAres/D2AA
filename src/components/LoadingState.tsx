export default function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status">{label}...</div>;
}
