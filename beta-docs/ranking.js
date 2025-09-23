import { num } from './utils.js';

export function rateLegendary(total) {
  const value = num(total);
  if (value >= 75) return '5★';
  if (value === 74) return '4★';
  if (value === 73) return '3★';
  if (value === 72) return '2★';
  if (value === 71) return '1★';
  return '💩';
}

export function rateExotic(total) {
  const value = num(total);
  if (value >= 63) return '5★';
  if (value === 62) return '4★';
  if (value === 61) return '3★';
  if (value === 60) return '2★';
  if (value === 59) return '1★';
  return '💩';
}

export function rateTotal({ rarity, total }) {
  const tier = (rarity || '').toLowerCase();
  if (tier.includes('legendary')) {
    return rateLegendary(total);
  }
  if (tier.includes('exotic')) {
    return rateExotic(total);
  }
  return String(num(total));
}

export function rankScore(rank) {
  if (!rank) return 0;
  if (rank === '💩') return -1;
  const stars = rank.replace(/[^★]/g, '').length;
  return stars || 0;
}
