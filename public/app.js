const $ = id => document.getElementById(id);
let locations = [];
let records = {};
try { records = JSON.parse(localStorage.getItem('vending-scout-v1') || '{}') || {}; } catch { $('status').textContent = 'Saved notes could not be read. You can still research locations.'; }
if (typeof records !== 'object' || Array.isArray(records)) records = {};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function persist() {
  try { localStorage.setItem('vending-scout-v1', JSON.stringify(records)); }
  catch { $('status').textContent = 'Browser storage is unavailable or full. Export your notes before closing this page.'; }
}
function visible() {
  const term = $('filter').value.toLowerCase();
  return locations.filter(p => ($('category').value === 'All categories' || p.category === $('category').value) &&
    `${p.name} ${p.address}`.toLowerCase().includes(term) && (!$('savedOnly').checked || records[p.id]?.saved));
}
const stages = ['Not contacted', 'Visit planned', 'Contacted', 'Interested', 'Not a fit'];
function render() {
  const list = visible();
  $('count').textContent = locations.length;
  $('priority').textContent = locations.filter(p => p.score >= 65).length;
  $('saved').textContent = Object.values(records).filter(r => r.saved).length;
  $('results').innerHTML = list.length ? list.map(p => {
    const record = records[p.id] || {};
    let website = '';
    try { const url = new URL(p.website); if (['https:', 'http:'].includes(url.protocol)) website = `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">Website ↗</a>`; } catch {}
    return `<article class="card" data-id="${escape(p.id)}"><div class="card-top"><div><span class="type">${escape(p.category)}</span><h3>${escape(p.name)}</h3></div><div class="score" title="Category fit score">${p.score}<small> /100</small></div></div><div class="meta">${escape(p.address)} · ${p.distance} km from central Lancaster<br>${escape(p.hours)}${p.phone ? '<br>Phone: ' + escape(p.phone) : ''}</div><ul>${p.reasons.map(reason => `<li>${escape(reason)}</li>`).join('')}</ul><div class="unknown">${escape(p.vending)}</div><div class="links"><a href="https://www.openstreetmap.org/${escape(p.id)}" target="_blank" rel="noopener noreferrer">Map &amp; source ↗</a>${website}</div><div class="tracking"><button class="save" aria-pressed="${Boolean(record.saved)}">${record.saved ? '✓ Saved' : '+ Save lead'}</button><select class="stage" aria-label="Outreach status for ${escape(p.name)}">${stages.map(s => `<option${s === record.stage ? ' selected' : ''}>${s}</option>`).join('')}</select></div><textarea aria-label="Research notes for ${escape(p.name)}" placeholder="Visit notes: existing vending, decision-maker, daily traffic…">${escape(record.notes || '')}</textarea><details><summary>How this score works</summary><p>${escape(p.scoreDetails)}. This is a research heuristic, not measured demand. Verify current vending, daily visitors, permission, contracts, access, security, and power before proposing a machine.</p></details></article>`;
  }).join('') : '<div class="empty">No matching prospects. Discover locations or adjust your filters. Map data may not include every local business.</div>';
}
$('search').addEventListener('submit', async event => {
  event.preventDefault();
  $('discover').disabled = true;
  $('status').textContent = 'Searching public map records around Lancaster… This can take up to 35 seconds.';
  try {
    const response = await fetch(`/api/prospects?radius=${$('radius').value}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed. Please try again.');
    locations = data.prospects;
    render();
    $('status').textContent = `${locations.length} prospects within ${data.radius} km of central Lancaster · OpenStreetMap retrieved ${new Date(data.fetchedAt).toLocaleString()} · Scores are estimates. Some unnamed records may overlap other sites.`;
  } catch (error) { $('status').textContent = error.message + (locations.length ? ' Previous results remain below.' : ''); }
  finally { $('discover').disabled = false; }
});
for (const id of ['filter', 'category', 'savedOnly']) $(id).addEventListener('input', render);
$('results').addEventListener('click', event => {
  if (!event.target.matches('.save')) return;
  const id = event.target.closest('.card').dataset.id;
  records[id] = {...records[id], saved: !records[id]?.saved};
  persist(); render();
});
$('results').addEventListener('input', event => {
  if (!event.target.matches('textarea, .stage')) return;
  const id = event.target.closest('.card').dataset.id;
  records[id] = {...records[id], [event.target.matches('textarea') ? 'notes' : 'stage']: event.target.value};
  persist();
});
$('export').addEventListener('click', () => {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['Name','Category','Address','Score','Distance km','Vending status','Outreach','Notes','Source'], ...visible().map(p => [p.name,p.category,p.address,p.score,p.distance,p.vending,records[p.id]?.stage || stages[0],records[p.id]?.notes || '',`https://www.openstreetmap.org/${p.id}`])];
  const url = URL.createObjectURL(new Blob([rows.map(row => row.map(cell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'lancaster-vending-prospects.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('saved').textContent = Object.values(records).filter(r => r.saved).length;
