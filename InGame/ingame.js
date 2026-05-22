import { state, subscribe, setState, updateTag, dismissRecent, getFilteredRows, loadCachedRows, clearCache, loadSettings, normalizeClassFilter, rowMatchesClass, writeJson } from '../src-clean/state.js';
import { CLASS_ORDER, SLOT_ORDER, STAT_KEYS, STAT_LABELS, STAT_ICONS, TAGS, STORAGE_KEYS } from '../src-clean/constants.js';
import { applyDuplicateGroups } from '../src-clean/data/duplicate-groups.js?v=1.64';
import { runItemAction, runGroupPull } from '../src-clean/data/actions.js';
import { getActiveFeedRows } from '../src-clean/data/feed-state.js';

const els = {};
let lastGroupedRows = [];
const collapsedSlots = new Set();

function boot(){ cacheEls(); loadSettings(); forceSingleClassDefault(); bindEvents(); subscribe(render); loadCachedRows(); render(); }
function cacheEls(){ ['statusText','searchBox','refreshBtn','menuBtn','commandPanel','classToggle','gridView','tableView','tableBody','emptyState','summaryShown','summaryCached','summaryGroups','summaryRecent','summaryClasses','activeChips','csvFile','uploadCsvBtn','restoreCacheBtn','clearCacheBtn','classFilter','slotFilter','rarityFilter','sortBy','duplicateTolerance','duplicateToleranceOut','feedList','feedCount','feedToggle','itemFeed'].forEach(id=>els[id]=document.getElementById(id)); }
function forceSingleClassDefault(){ const cls = normalizeClassFilter(state.filters.class); if(cls === 'all') setState({ filters:{...state.filters, class:'Warlock'} }); }
function bindEvents(){
  els.searchBox?.addEventListener('input',()=>setState({search:els.searchBox.value}));
  els.menuBtn?.addEventListener('click',()=>setOptionsOpen(!els.commandPanel?.classList.contains('is-open')));
  document.addEventListener('pointerdown',(e)=>{ if(!document.body.classList.contains('options-open')) return; if(els.commandPanel?.contains(e.target)||els.menuBtn?.contains(e.target)) return; setOptionsOpen(false); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') { setOptionsOpen(false); closeCompareModal(); } });
  els.classToggle?.querySelectorAll('[data-class-filter]').forEach(btn=>btn.addEventListener('click',()=>setClassFilter(btn.dataset.classFilter)));
  els.classFilter?.addEventListener('change',()=>setClassFilter(els.classFilter.value));
  els.slotFilter?.addEventListener('change',()=>setState({filters:{...state.filters, slot:els.slotFilter.value}}));
  els.rarityFilter?.addEventListener('change',()=>setState({filters:{...state.filters, rarity:els.rarityFilter.value}}));
  els.sortBy?.addEventListener('change',()=>setState({sortBy:els.sortBy.value}));
  els.duplicateTolerance?.addEventListener('input',()=>setState({duplicateTolerance:Number(els.duplicateTolerance.value||5)}));
  els.restoreCacheBtn?.addEventListener('click',()=>loadCachedRows()||setState({status:'No cached rows found. Bungie cache restores automatically at startup.'}));
  els.clearCacheBtn?.addEventListener('click',clearCache);
  els.feedToggle?.addEventListener('click',()=>{ const open=!els.itemFeed.classList.contains('is-open'); els.itemFeed.classList.toggle('is-open',open); document.body.classList.toggle('feed-open',open); writeJson(STORAGE_KEYS.feedOpen,open); });
  document.addEventListener('click',handleDocumentClick);
}
function setOptionsOpen(open){ els.commandPanel?.classList.toggle('is-open',open); document.body.classList.toggle('options-open',open); els.menuBtn?.setAttribute('aria-expanded',String(open)); }
function setClassFilter(className){ setState({filters:{...state.filters, class:normalizeClassFilter(className)}}); }
function render(){
  document.body.dataset.theme='ingame';
  if(els.statusText) els.statusText.textContent=state.status;
  if(els.searchBox) els.searchBox.value=state.search;
  if(els.sortBy) els.sortBy.value=state.sortBy;
  if(els.duplicateTolerance) els.duplicateTolerance.value=state.duplicateTolerance;
  if(els.duplicateToleranceOut) els.duplicateToleranceOut.textContent=`±${state.duplicateTolerance}`;
  syncFilters(); syncClassToggle();
  const grouped = applyDuplicateGroups(state.rows,state.duplicateTolerance).map(addGrade);
  lastGroupedRows = grouped;
  const filtered = getFilteredRowsFrom(grouped).filter(r=>normalizeClassFilter(state.filters.class)!=='all' ? rowMatchesClass(r,state.filters.class) : false);
  renderGrid(filtered); renderFeed(grouped); updateSummary(grouped,filtered); renderChips();
  if(els.emptyState) els.emptyState.hidden = state.rows.length>0;
}
function renderGrid(rows){
  if(!els.gridView) return;
  const cls=normalizeClassFilter(state.filters.class);
  const bySlot=SLOT_ORDER.map(slot=>[slot,rows.filter(r=>r.Slot===slot)]).filter(([_,items])=>items.length);
  els.gridView.innerHTML=bySlot.map(([slot,items])=>{ const collapsed=collapsedSlots.has(slot); return `<section class="slot-section ${collapsed?'is-collapsed':''}" data-slot="${h(slot)}"><button type="button" class="slot-heading" data-collapse-slot="${h(slot)}" aria-expanded="${!collapsed}"><span class="slot-caret" aria-hidden="true">${caretIcon(collapsed)}</span><span>${h(cls)}</span><strong>${h(slot)}</strong><b>${items.length}</b></button><div class="card-grid">${items.map(renderCard).join('')}</div></section>`; }).join('');
}
function renderCard(row){
  const loc=locationText(row); const tag=row.Tag||''; const grade=gradeFor(row); const group=groupLabel(row); const name=displayName(row); const groupClass=groupColorClass(row);
  return `<article class="armor-card rarity-${rarityClass(row.Rarity)} ${groupClass}" data-id="${h(row.Id)}" data-group="${h(row.GroupActionKey||'')}">
    <div class="card-title"><img class="item-icon" src="${h(row.IconUrl||row.Icon||'')}" alt=""/><div class="tier-rail">${tierMarks(row).join('')}</div><div class="title-copy"><strong title="${h(name)}">${h(name)}</strong><div class="meta-line"><button type="button" class="tag-chip" data-tag-button data-id="${h(row.Id)}">${tag?tagLabel(tag):'+'}</button><span class="location-chip">${h(loc)}</span><span class="grade-chip grade-${grade.letter}">${grade.letter}</span></div></div>${row.Is_Dupe?`<button type="button" class="group-badge ${groupClass}" data-compare-group="${h(row.GroupActionKey)}" title="Compare group ${h(group)}">${h(group)}</button>`:''}<div class="power-badge">${h(row.Power||row.Light||'')}</div></div>
    <div class="card-body"><aside class="card-side"><div class="archetype"><span>${archetypeIcon(row)}</span><b>${h(row.Archetype||'—')}</b></div><button type="button" class="move-button" data-action="${h(row.Id)}">${row.IsInVault?'Pull':'Push'}</button>${row.Is_Dupe?`<button type="button" class="move-button subtle" data-action="group:${h(row.GroupActionKey)}">Pull Group</button>`:''}</aside><div class="stat-bars">${STAT_KEYS.map(k=>renderStat(row,k)).join('')}${renderTotal(row)}</div></div>
  </article>`;
}
function renderStat(row,key){ const base=n(row[`Base${key}`]??row[key]); const current=n(row[`Current${key}`]??row[key]); const bonus=Math.max(0,current-base); return `<div class="stat-row" title="${h(STAT_LABELS[key])}: base ${base}${bonus?`, +${bonus} bonus`:''}"><img src="${h(STAT_ICONS[key])}" alt="${h(STAT_LABELS[key])}"/><div class="bar"><span class="bar-base" style="width:${Math.min(100,base)}%"></span>${bonus?`<span class="bar-bonus bonus-${bonusClass(row,key)}" style="left:${Math.min(100,base)}%;width:${Math.min(100-base,bonus)}%"></span>`:''}</div><b>${pad(current)}</b></div>`; }
function renderTotal(row){ const base=n(row.BaseTotal??row.Total); const current=n(row.CurrentTotal??row.Total); const bonus=Math.max(0,current-base); return `<div class="stat-total" title="Total: base ${base}${bonus?`, +${bonus} bonus`:''}"><span class="total-label">Total</span><div class="total-value"><span class="base-total">${base}</span>${bonus?`<span class="mw-total">+${bonus}</span>`:''}</div></div>`; }
function renderFeed(rows){ const active=getActiveFeedRows(rows).map(addGrade); if(els.feedCount) els.feedCount.textContent=String(active.length); if(!els.feedList) return; els.feedList.innerHTML=active.map(row=>{ const group=groupLabel(row); const groupClass=groupColorClass(row); return `<article class="feed-card rarity-${rarityClass(row.Rarity)} ${groupClass}" data-id="${h(row.Id)}"><img src="${h(row.IconUrl||row.Icon||'')}" alt=""/><div><strong>${h(displayName(row))}</strong><span><button type="button" class="tag-chip" data-tag-button data-id="${h(row.Id)}">${row.Tag?tagLabel(row.Tag):'+'}</button> · ${h(locationText(row))} · <b class="grade-${gradeFor(row).letter}">${gradeFor(row).letter}</b></span><small>${h(row.Slot)} · ${h(row.Archetype||'—')} · ${h(row.Power||row.Light||'')}</small></div>${row.Is_Dupe?`<button type="button" class="group-badge ${groupClass}" data-compare-group="${h(row.GroupActionKey)}">${h(group)}</button>`:''}<button type="button" class="dismiss" data-dismiss="${h(row.Id)}">×</button></article>`; }).join(''); }
function handleDocumentClick(e){
  const close=e.target.closest('[data-close-compare]'); if(close){ closeCompareModal(); return; }
  const comparePull=e.target.closest('[data-compare-pull]'); if(comparePull){ handleAction(comparePull.dataset.comparePull, comparePull); return; }
  const collapse=e.target.closest('[data-collapse-slot]'); if(collapse){ const slot=collapse.dataset.collapseSlot; collapsedSlots.has(slot)?collapsedSlots.delete(slot):collapsedSlots.add(slot); render(); return; }
  const cmp=e.target.closest('[data-compare-group]'); if(cmp){ openGroupCompare(cmp.dataset.compareGroup); return; }
  const action=e.target.closest('[data-action]'); if(action){ handleAction(action.dataset.action,action); return; }
  const dismiss=e.target.closest('[data-dismiss]'); if(dismiss){ dismissRecent(dismiss.dataset.dismiss); return; }
}
async function handleAction(actionId,button){ if(actionId.startsWith('group:')) return pullGroup(actionId.slice(6),button); const row=lastGroupedRows.find(r=>String(r.Id)===String(actionId)); if(!row) return setState({status:'Could not find that item.'}); const old=button.textContent; button.textContent='Working'; try{ const result=await runItemAction(row); setState({status:result.message||'Action complete.'}); if(result.needsRefresh) requestRefresh('post-action-refresh'); }catch(err){ setState({status:err.message||String(err)}); } finally{ setTimeout(()=>button.textContent=old,1200); } }
function openGroupCompare(groupKey){ const rows=lastGroupedRows.filter(r=>r.Is_Dupe&&r.GroupActionKey===groupKey).map(addGrade); if(!rows.length) return setState({status:'No duplicate group found to compare.'}); renderInGameCompare(rows); }
function renderInGameCompare(rows){ closeCompareModal(); const overlay=document.createElement('div'); overlay.id='compareOverlay'; overlay.className='compare-overlay ingame-compare-modal'; overlay.innerHTML=`<div class="compare-backdrop" data-close-compare></div><section class="compare-panel"><header class="compare-head"><div><p>Duplicate Comparison</p><h2>${h(groupLabel(rows[0])||'Group')}</h2><span>${rows.length} items · ${h(rows[0]?.Slot||'Armor')}</span></div><button type="button" class="compare-close" data-close-compare>×</button></header><div class="compare-grid">${rows.map(renderFallbackCompareCard).join('')}</div></section>`; document.body.appendChild(overlay); document.body.classList.add('compare-open'); }
function closeCompareModal(){ document.getElementById('compareOverlay')?.remove(); document.body.classList.remove('compare-open','ingame-compare-ready'); document.querySelectorAll('.compare-overlay').forEach(el=>el.remove()); }
function renderFallbackCompareCard(row){ return `<article class="compare-card ${groupColorClass(row)}"><div class="compare-item-head"><img src="${h(row.IconUrl||row.Icon||'')}" alt=""><div><h3>${h(displayName(row))}</h3><p>${h(locationText(row))} · ${h(row.Rarity)} · ${h(row.Power||row.Light||'')}</p></div><strong class="grade-${gradeFor(row).letter}">${gradeFor(row).letter}</strong></div><div class="compare-stat-grid">${STAT_KEYS.map(k=>`<div class="compare-stat"><img src="${h(STAT_ICONS[k])}" alt="${h(STAT_LABELS[k])}"><strong>${pad(n(row[`Base${k}`]??row[k]))}</strong><span>${h(STAT_LABELS[k])}</span></div>`).join('')}${renderTotal(row)}</div><div class="compare-card-actions"><button type="button" class="tag-chip" data-tag-button data-id="${h(row.Id)}">${row.Tag?tagLabel(row.Tag):'+'}</button><button type="button" class="compare-pull-button" data-compare-pull="${h(row.Id)}">${row.IsInVault?'Pull':'Push'}</button></div></article>`; }
async function pullGroup(groupKey,button){ const rows=lastGroupedRows.filter(r=>r.Is_Dupe&&r.GroupActionKey===groupKey); if(!rows.length) return setState({status:'No group items found.'}); const old=button?.textContent||''; if(button) button.textContent='Pulling'; try{ const result=await runGroupPull(rows); setState({status:result.message||'Group action complete.'}); if(result.needsRefresh) requestRefresh('post-group-pull-refresh'); }catch(err){ setState({status:err.message||String(err)}); } finally{ if(button) setTimeout(()=>button.textContent=old,1200); } }
function requestRefresh(reason){ setTimeout(()=>window.dispatchEvent(new CustomEvent('d2aa:bungie-sync-request',{detail:{reason,background:true}})),1000); }
function getFilteredRowsFrom(rows){ const old=state.rows; state.rows=rows; const result=getFilteredRows(); state.rows=old; return result; }
function syncFilters(){ fill(els.classFilter,CLASS_ORDER,normalizeClassFilter(state.filters.class)); fill(els.slotFilter,['all',...SLOT_ORDER.filter(s=>state.rows.some(r=>r.Slot===s))],state.filters.slot); fill(els.rarityFilter,['all',...[...new Set(state.rows.map(r=>r.Rarity).filter(Boolean))].sort()],state.filters.rarity); }
function syncClassToggle(){ const active=normalizeClassFilter(state.filters.class); els.classToggle?.querySelectorAll('[data-class-filter]').forEach(btn=>{ const cls=normalizeClassFilter(btn.dataset.classFilter); btn.classList.toggle('is-active',cls===active); const b=btn.querySelector('b'); if(b) b.textContent=String(state.rows.filter(r=>rowMatchesClass(r,cls)).length); }); }
function updateSummary(all,shown){ if(els.summaryShown) els.summaryShown.textContent=shown.length; if(els.summaryCached) els.summaryCached.textContent=all.length; if(els.summaryGroups) els.summaryGroups.textContent=new Set(all.filter(r=>r.Is_Dupe).map(r=>r.GroupActionKey)).size; if(els.summaryRecent) els.summaryRecent.textContent=String(getActiveFeedRows(all).length); if(els.summaryClasses) els.summaryClasses.textContent=normalizeClassFilter(state.filters.class); }
function renderChips(){ const chips=[]; if(state.search) chips.push(`Search: ${state.search}`); if(state.filters.slot!=='all') chips.push(`Slot: ${state.filters.slot}`); if(state.filters.rarity!=='all') chips.push(`Rarity: ${state.filters.rarity}`); els.activeChips.innerHTML=chips.map(c=>`<span>${h(c)}</span>`).join(''); }
function fill(select,values,selected){ if(!select) return; select.innerHTML=values.map(v=>`<option value="${h(v)}">${v==='all'?'All':h(v)}</option>`).join(''); select.value=values.includes(selected)?selected:values[0]; }
function addGrade(row){ return {...row, Grade:gradeFor(row).letter, GradeScore:gradeFor(row).score}; }
function gradeFor(row){ const total=n(row.BaseTotal??row.Total); const top=Math.max(...STAT_KEYS.map(k=>n(row[`Base${k}`]??row[k]))); const score=Math.round(Math.min(100,total*1.15 + top*1.25 + (row.Is_Dupe?5:0))); const letter=score>=92?'S':score>=82?'A':score>=70?'B':score>=58?'C':score>=45?'D':'F'; return {letter,score}; }
function groupLabel(row){ return String(row.Group || row.Dupe_Group || row.SortGroup || '').match(/^[0-9]+[A-Z]+$/)?.[0] || ''; }
function groupColorClass(row){ return String(row.GroupColor || '').match(/^group-[1-6]$/)?.[0] || ''; }
function displayName(row){ const name=String(row.Name||'').trim(); return name && !name.includes('|') ? name : String(row.Type || row.Slot || 'Unknown Armor'); }
function bonusClass(row,key){ const source=String(row.StatSource||row[`${key}Source`]||'').toLowerCase(); if(source.includes('master')) return 'masterwork'; if(source.includes('mod')) return 'mod'; return 'other'; }
function tierMarks(row){ const max=Math.max(1,Math.min(5,n(row.TierMax||5))); const tier=Math.max(0,Math.min(max,n(row.Tier||row.GearTier||0))); return Array.from({length:max},(_,i)=>`<span class="tier-mark ${max-i<=tier?'is-on':''}">◆</span>`); }
function locationText(row){ return row.IsEquipped?'Equipped':row.IsInVault?'Vault':'Inventory'; }
function tagLabel(tag){ const found=TAGS.find(t=>t.value===tag); return h(found?.label||tag); }
function archetypeIcon(row){ const k=String(row.Archetype||'').toLowerCase(); if(k.includes('paragon')) return '☉'; if(k.includes('gren')) return '✹'; if(k.includes('special')) return '△'; if(k.includes('brawl')) return '✊'; if(k.includes('bulwark')) return '✚'; if(k.includes('gun')) return '✥'; return '◇'; }
function caretIcon(collapsed){ const path=collapsed?'M8 5l6 7-6 7':'M5 8l7 6 7-6'; return `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="${path}"/></svg>`; }
function rarityClass(r){ return String(r||'common').toLowerCase().replace(/[^a-z0-9]/g,''); }
function n(v){ const x=Number(String(v??'').replace(/[^0-9.-]/g,'')); return Number.isFinite(x)?x:0; }
function pad(v){ return String(n(v)).padStart(2,' '); }
function h(v){ return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
boot();