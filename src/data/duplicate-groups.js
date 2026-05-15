(() => {
  const COLORS = ['#b57cff','#66d9ff','#ffcf66','#77ffb0','#ff7ca8','#ffa66b','#9cfffb','#d5ff6b'];
  const norm = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
  function groupRows(rows) {
    const buckets = new Map();
    for (const row of rows || []) {
      const key = [row.Equippable,row.Slot,norm(row.Name)].join('|');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(row);
    }
    let groupIndex = 0;
    const out = (rows || []).map((row) => ({ ...row, Is_Dupe:false, Same_Name_Dupe:false, Dupe_Group:'', GroupKey:'', GroupColor:'' }));
    const byId = new Map(out.map((row) => [String(row.Id), row]));
    for (const [key, group] of buckets.entries()) {
      if (group.length < 2) continue;
      groupIndex += 1;
      const color = COLORS[(groupIndex - 1) % COLORS.length];
      group.forEach((source, index) => {
        const row = byId.get(String(source.Id));
        if (!row) return;
        row.Is_Dupe = true;
        row.Same_Name_Dupe = true;
        row.GroupKey = key;
        row.Dupe_Group = `${groupIndex}${String.fromCharCode(65 + index)}`;
        row.GroupColor = color;
      });
    }
    return out;
  }
  window.D2AA_GROUPS = { groupRows };
})();
