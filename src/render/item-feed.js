(() => {
  const { STORAGE } = window.D2AA_CONSTANTS;
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm = (value) => String(value || '').trim();
  function feed() { return readJson(STORAGE.feed, []); }
  function saveFeed(items) { writeJson(STORAGE.feed, items.slice(0,25)); }
  function seed(rows) { const existing = new Set(feed().map((item) => item.id)); const adds = (rows || []).filter((row) => norm(row.Id) && !existing.has(norm(row.Id))).slice(0,12).map((row) => ({ id:norm(row.Id), name:row.Name, slot:row.Slot, rarity:row.Rarity, total:row['Total (Base)'], light:row.Light || row.Power || 0, icon:row.IconUrl || '', at:new Date().toISOString() })); if (adds.length) saveFeed([...adds, ...feed()]); }
  function renderFeed() { const list = document.getElementById('itemFeedList'); const count = document.getElementById('itemFeedCount'); if (!list) return; const items = feed(); if (count) count.textContent = String(items.length); list.innerHTML = items.length ? items.map((item) => `<div class="feed-card">${item.icon ? `<img src="${esc(item.icon)}" alt="">` : '<div></div>'}<div><div class="feed-title">${esc(item.name)}</div><div class="feed-meta">${esc(item.rarity)} • ${esc(item.slot)}${item.light ? ` • ${esc(item.light)}` : ''}</div></div><div class="feed-total">${Number(item.total || 0)}</div></div>`).join('') : '<p class="feed-empty">No recent items yet. Import a DIM CSV to seed the feed.</p>'; }
  window.D2AA_FEED = { seed, renderFeed };
})();
