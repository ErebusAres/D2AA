export default function EmptyState({ hasRows }: { hasRows: boolean }) {
  return (
    <section className="empty-state">
      <h2>{hasRows ? 'No armor matches these filters' : 'No armor loaded'}</h2>
      <p>{hasRows ? 'Adjust the class, slot, rarity, search, or display options.' : 'Sign in with Bungie or restore a cache to populate the in-game analyzer.'}</p>
    </section>
  );
}
