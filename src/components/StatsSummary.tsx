import type { ArmorItem } from '../types/armor';
import { getActiveFeedRows } from '../data/feedState';

interface StatsSummaryProps {
  allRows: ArmorItem[];
  shownRows: ArmorItem[];
  activeClass: string;
}

export default function StatsSummary({ allRows, shownRows, activeClass }: StatsSummaryProps) {
  const groups = new Set(allRows.filter((row) => row.Is_Dupe).map((row) => row.GroupActionKey)).size;
  return (
    <section className="summary-strip" aria-label="Inventory summary">
      <span>Shown<strong>{shownRows.length}</strong></span>
      <span>Cached<strong>{allRows.length}</strong></span>
      <span>Groups<strong>{groups}</strong></span>
      <span>New<strong>{getActiveFeedRows(allRows).length}</strong></span>
      <span>Class<strong>{activeClass}</strong></span>
    </section>
  );
}
