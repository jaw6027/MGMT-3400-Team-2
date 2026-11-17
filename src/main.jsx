import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Plus, Search, SlidersHorizontal, MapPin, Compass, Bookmark, LayoutGrid, ChevronDown, X, Check, Download, Building2, Dumbbell, WashingMachine, Warehouse, CarFront, Users, Leaf, CircleHelp, ChevronRight, ExternalLink, LoaderCircle, Trash2, PanelLeft, Send, RefreshCw, Menu } from 'lucide-react';
import { assess, categories, nextStep, serviceOptions, stages } from './model';
import { examples } from './demo';
import LocationMap from './Map';
import './styles.css';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';

async function api(path, options) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.');
  return body;
}
const icons = { 'Warehouse & industrial': Warehouse, 'Auto service': CarFront, Laundromat: WashingMachine, 'Fitness & recreation': Dumbbell, Office: Building2, 'Community & education': Users, Other: MapPin };
function CategoryIcon({ category, size = 20 }) { const Icon = icons[category] || MapPin; return <Icon size={size} strokeWidth={1.6} />; }
function Score({ candidate, small = false }) { const { score, label } = assess(candidate); return <div className={`score ${label === 'Worth a visit' ? 'good' : ''} ${small ? 'small' : ''}`} title={label}><strong>{score}</strong>{!small && <span>/ 100</span>}</div>; }

function Modal({ title, children, close, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const handle = event => { event.preventDefault(); closeRef.current(); };
    const dialog = ref.current;
    dialog.addEventListener('cancel', handle);
    return () => { dialog.removeEventListener('cancel', handle); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={wide ? 'modal wide' : 'modal'} onClick={event => { if (event.target === ref.current) close(); }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={21} /></button></div>{children}</dialog>;
}

const blank = { name: '', category: 'Other', address: '', lat: '', lng: '', dailyPeople: '', dwellMinutes: '', openHours: '', service: 'unknown', power: 'unknown', stage: 'To research', contact: '', owner: '', notes: '', evidence: '', starred: false };
function LocationForm({ candidate, onSave, close }) {
  const [form, setForm] = useState({ ...blank, ...candidate });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const field = (name, label, options = {}) => <label className={options.full ? 'full' : ''}>{label}<input value={form[name] ?? ''} onChange={e => setForm({ ...form, [name]: e.target.value })} {...options} full={undefined} /></label>;
  const select = (name, label, choices) => <label>{label}<select aria-label={label} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })}>{Object.entries(choices).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    const body = { ...form };
    for (const key of ['lat', 'lng', 'dailyPeople', 'dwellMinutes', 'openHours']) body[key] = form[key] === '' || form[key] == null ? null : Number(form[key]);
    try { await onSave(body); close(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal title={candidate ? 'Update location' : 'Add a location'} close={close} wide><form onSubmit={submit}>
    <p className="muted form-intro">Build a case from observations. Leave unknown values blank; they won’t earn points.</p>
    <div className="form-grid">
      {field('name', 'Location name *', { required: true, maxLength: 160, placeholder: 'Business or property name', full: true })}
      {select('category', 'Location type', Object.fromEntries(categories.map(c => [c, c])))}
      {select('stage', 'Outreach stage', Object.fromEntries(stages.map(c => [c, c])))}
      {field('address', 'Street address', { maxLength: 300, placeholder: 'Lancaster, CA', full: true })}
      {field('lat', 'Latitude (optional)', { type: 'number', step: 'any', min: 34.60, max: 34.80, placeholder: '34.6868' })}
      {field('lng', 'Longitude (optional)', { type: 'number', step: 'any', min: -118.36, max: -117.99, placeholder: '-118.1542' })}
      <p className="form-hint full">Pins are limited to the Lancaster search area. Leave both coordinates blank if you haven’t confirmed them.</p>
      <h3 className="full form-section">Opportunity signals</h3>
      {field('dailyPeople', 'Estimated people per day', { type: 'number', min: 0, max: 100000, step: 1, placeholder: 'Unknown' })}
      {field('dwellMinutes', 'Typical time on site (minutes)', { type: 'number', min: 0, max: 1440, placeholder: 'Unknown' })}
      {field('openHours', 'Open hours per day', { type: 'number', min: 0, max: 24, step: 0.5, placeholder: 'Unknown' })}
      {select('service', 'Existing vending service', serviceOptions)}
      {select('power', 'Power & space confirmed', { unknown: 'Not checked', yes: 'Yes', no: 'No' })}
      {field('owner', 'Student responsible', { maxLength: 100, placeholder: 'Team member' })}
      {field('evidence', 'Evidence & date', { maxLength: 1000, placeholder: 'e.g. Nov 16: manager estimates 80 visitors/day; no machines seen.', full: true })}
      {field('contact', 'Property decision-maker / contact', { maxLength: 300, full: true, placeholder: 'Name and business contact details' })}
      <label className="full">Visit notes & next action<textarea value={form.notes} maxLength={5000} rows={3} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Product fit, access hours, nearby food options, and what to check next…" /></label>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : candidate ? 'Save changes' : 'Add location'}<Check size={16} /></button></div>
  </form></Modal>;
}

function Details({ candidate, onEdit, onStar, onDelete, close }) {
  const result = assess(candidate);
  const demo = candidate.source.kind === 'example';
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Modal title="Location brief" close={close}>
    {demo && <div className="notice">Fictional example. All figures and the map pin are illustrative.</div>}
    <div className="detail-title"><div className="category-icon"><CategoryIcon category={candidate.category} /></div><div><span className="eyebrow">{candidate.category}</span><h2>{candidate.name}</h2></div></div>
    <p className="detail-address"><MapPin size={16} />{candidate.address || 'Address not recorded'}</p>
    <div className="detail-score"><Score candidate={candidate} /><div><strong>{result.label}</strong><p>Screening score · {result.coverage}% of signal fields filled</p></div></div>
    <div className="factor-list">{result.factors.map(f => <div className="factor" key={f.label}><div><span>{f.label}</span><strong>{f.known ? `${f.points} / ${f.max}` : `Unknown · 0 / ${f.max}`}</strong></div><div className="progress"><span style={{ width: `${f.points / f.max * 100}%` }} /></div></div>)}</div>
    <p className="form-hint">Scores reflect entered signals, not verified demand or expected revenue. Zero can mean unknown. Open the scoring guide for weights.</p>
    <div className="next-action"><span className="eyebrow">SUGGESTED NEXT STEP</span><p>{nextStep(candidate)}</p></div>
    <dl className="detail-facts"><div><dt>Existing service</dt><dd>{serviceOptions[candidate.service]}</dd></div><div><dt>Stage</dt><dd>{candidate.stage}</dd></div><div><dt>Assigned to</dt><dd>{candidate.owner || 'Unassigned'}</dd></div><div><dt>Contact</dt><dd>{candidate.contact || 'Not recorded'}</dd></div><div><dt>Evidence</dt><dd>{candidate.evidence || 'No field evidence yet'}</dd></div><div><dt>Notes</dt><dd>{candidate.notes || 'No visit notes yet'}</dd></div><div><dt>Source</dt><dd>{candidate.source.url ? <a target="_blank" rel="noreferrer" href={candidate.source.url}>OpenStreetMap listing <ExternalLink size={12} /></a> : candidate.source.label}{candidate.source.retrievedAt && <small>Retrieved {new Date(candidate.source.retrievedAt).toLocaleDateString()}</small>}</dd></div></dl>
    {!demo && <><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onStar(candidate); close(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}><Bookmark size={16} />{candidate.starred ? 'Remove from shortlist' : 'Shortlist'}</button><button className="button primary" onClick={() => onEdit(candidate)}>Update location<ArrowRight size={16} /></button></div>
      <div className="delete-row">{confirm ? <><span>Delete this shared location?</span><button disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(candidate); close(); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>Delete permanently</button><button onClick={() => setConfirm(false)}>Cancel</button></> : <button onClick={() => setConfirm(true)}><Trash2 size={13} /> Delete location</button>}</div></>}
    {error && <p className="error" role="alert">{error}</p>}
  </Modal>;
}

function Discovery({ onImport, close, saved }) {
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('');
  const [added, setAdded] = useState(new Set(saved.map(c => c.source.key)));
  useEffect(() => { let live = true; api('/discover').then(result => { if (live) setPlaces(result.places); }).catch(err => { if (live) setError(err.message); }); return () => { live = false; }; }, []);
  return <Modal title="Discover Lancaster locations" close={close} wide>
    <p className="muted">Search public OpenStreetMap listings for laundromats, auto services, gyms, offices, warehouses, and community centers in the Lancaster area.</p>
    <div className="notice">A listing is a lead, not proof of a vending gap. Coverage is incomplete; verify the address, city boundary, activity, existing machines, and host permission on site.</div>
    {places && <><div className="search-box discovery-search"><Search size={17} /><input aria-label="Filter public listings" value={filter} onChange={e => setFilter(e.target.value)} placeholder={`Search ${places.length} public listings…`} /></div><p className="form-hint">Up to 100 map objects per search · results cached for 15 minutes · © OpenStreetMap contributors</p></>}
    {!places && !error && <div className="loading"><LoaderCircle className="spin" /><p>Checking public map listings…</p><small>This may take up to 30 seconds.</small></div>}
    {error && <div className="error" role="alert">{error}<p>You can still add a location manually using observations from a field visit.</p></div>}
    <div className="discovery-results">{places?.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(filter.toLowerCase())).map(place => <div className="discovery-row" key={place.key}><div className="category-icon"><CategoryIcon category={place.category} /></div><div><strong>{place.name}</strong><p>{place.category} · {place.address}</p><a href={place.source.url} target="_blank" rel="noreferrer">View source <ExternalLink size={11} /></a></div><button className="button secondary" disabled={added.has(place.key) || !!busy} onClick={async () => { setBusy(place.key); setError(''); try { await onImport(place.key); setAdded(new Set([...added, place.key])); } catch (err) { setError(err.message); } finally { setBusy(''); } }}>{added.has(place.key) ? <><Check size={15} />Added</> : busy === place.key ? 'Adding…' : <><Plus size={15} />Add lead</>}</button></div>)}</div>
    {places?.length === 0 && <p className="empty">No public listings were returned. Field research can identify locations missing from the map.</p>}
    <div className="modal-actions"><button className="button primary" onClick={close}>Done<Check size={16} /></button></div>
  </Modal>;
}

function Guide({ close }) {
  return <Modal title="A better shortlist starts with evidence" close={close} wide><p className="muted">Use the score to prioritize research, then validate each location with its host. It is a screening rubric selected for this project, not a trained model or revenue forecast.</p>
    <div className="guide-steps">{[['01', 'Look for a captive audience', 'Prioritize places where people wait or work long shifts. Estimate daily people and typical time on site.'], ['02', 'Verify the vending gap', 'Look for existing machines, nearby food, operating hours, and whether current service meets the audience’s needs. “Not checked” earns no gap points.'], ['03', 'Talk to the decision-maker', 'Confirm power, indoor space, accessibility, security, restocking access, commission terms, and written permission before placement.']].map(([n,t,b]) => <div key={n}><span>{n}</span><section><h3>{t}</h3><p>{b}</p></section></div>)}</div>
    <h3>The 100-point rubric</h3><div className="rubric-table">{[['Daily audience', 'Up to 30', '1 point per 5 people/day; capped at 150 people.'], ['Time on site', 'Up to 20', '1 point per 3 minutes; capped at 60 minutes.'], ['Vending gap', 'Up to 25', 'No machines reported: 25. Limited service: 15. Well served or unknown: 0.'], ['Open hours', 'Up to 10', '1 point per 1.6 hours; capped at 16 hours/day.'], ['Power & space', '10', 'Awarded when the team confirms both.'], ['Host approval', '5', 'Awarded only at the Approved stage.']].map(([label,points,desc]) => <div key={label}><strong>{label}</strong><span>{points}</span><p>{desc}</p></div>)}</div>
    <p className="form-hint">Scores round once at the end; displayed factor rounding can differ by a point. 65+ means worth a visit only when a vending gap is reported and at least three signal fields are filled. Unknown service means verify the gap; well-served sites are labeled accordingly, regardless of score. Filled fields are not independently verified; add dated evidence to make them useful.</p>
    <div className="modal-actions"><button className="button primary" onClick={close}>Let’s scout<ArrowRight size={16} /></button></div></Modal>;
}

function exportCSV(candidates) {
  // Prefix formula-like cells so spreadsheet software treats team-entered text as data.
  const cell = value => { let text = String(value ?? ''); if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  const keys = ['name', 'category', 'address', 'lat', 'lng', 'stage', 'owner', 'dailyPeople', 'dwellMinutes', 'openHours', 'service', 'power', 'contact', 'evidence', 'notes'];
  const rows = [ [...keys, 'score', 'signalCoverage', 'source', 'sourceURL', 'updatedAt'], ...candidates.map(c => [...keys.map(k => c[k]), assess(c).score, assess(c).coverage, c.source.label, c.source.url || '', c.updatedAt || '']) ];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `vendwell-lancaster-${new Date().toISOString().slice(0,10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function App() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [page, setPage] = useState('Discover');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All types');
  const [sort, setSort] = useState('score');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  async function load(initial = false) {
    setError('');
    try { const data = await api('/candidates'); setCandidates(data); if (initial) setDemo(data.length === 0); }
    catch (err) { setError(`Could not load the shared workspace. ${err.message}`); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(true); }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4500); return () => clearTimeout(id); }, [toast]);
  const source = demo ? examples : candidates;
  const visible = useMemo(() => source.filter(c => {
    const matchesPage = page === 'Shortlist' ? c.starred : page === 'Outreach' ? !['To research', 'Not a fit'].includes(c.stage) : true;
    return matchesPage && (category === 'All types' || c.category === category) && `${c.name} ${c.address} ${c.category} ${c.owner}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'updated' ? (b.updatedAt || '').localeCompare(a.updatedAt || '') : assess(b).score - assess(a).score || a.name.localeCompare(b.name)), [source, page, category, query, sort]);
  async function save(body) {
    const saved = await api(body.id ? `/candidates/${body.id}` : '/candidates', { method: body.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    setCandidates(previous => body.id ? previous.map(c => c.id === saved.id ? saved : c) : [...previous, saved]);
    if (!body.id) { setPage('Discover'); setQuery(''); setCategory('All types'); }
    setDemo(false); setSelected(null); setToast(body.id ? 'Location updated for the team.' : 'Location added to your shared workspace.');
    return saved;
  }
  async function star(candidate) { await save({ ...candidate, starred: !candidate.starred }); }
  const showDetails = c => { setSelected(c); setModal({ kind: 'detail', candidate: c }); };
  const stats = [
    { label: 'Locations to explore', value: source.length.toString().padStart(2, '0'), icon: MapPin, note: 'Your scouting landscape' },
    { label: 'Worth a visit', value: source.filter(c => assess(c).label === 'Worth a visit' && c.stage !== 'Not a fit').length.toString().padStart(2, '0'), icon: Compass, note: '65+ · vending gap reported' },
    { label: 'On your shortlist', value: source.filter(c => c.starred).length.toString().padStart(2, '0'), icon: Bookmark, note: 'Keep the best leads close' },
    { label: 'Conversations started', value: source.filter(c => ['Contacted', 'In discussion', 'Approved'].includes(c.stage)).length.toString().padStart(2, '0'), icon: Users, note: 'From scouting to connections' },
  ];
  return <div className="app">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}><a className="brand" href="/" aria-label="Vendwell home"><span className="brand-symbol"><span/><span/><span/><span/><i/></span>vendwell<span className="brand-period">.</span></a><div className="workspace-tag"><span className="workspace-avatar">T2</span><div><strong>Team 2 workspace</strong><span>MGMT 3400</span></div><ChevronDown size={14} /></div>
      <span className="nav-label">YOUR WORKSPACE</span><nav>{[[Compass, 'Discover'], [Bookmark, 'Shortlist'], [Send, 'Outreach']].map(([Icon, label]) => <button className={page === label ? 'active' : ''} key={label} onClick={() => { setPage(label); setMobileNav(false); }}><Icon size={19} />{label}{label === 'Shortlist' && <span className="nav-count">{source.filter(c => c.starred).length}</span>}</button>)}</nav>
      <div className="sidebar-guide"><span className="guide-icon"><Leaf size={20} /></span><h3>Small footprint.<br/>Local opportunity.</h3><p>The right location makes all the difference.</p><button onClick={() => setModal({ kind: 'guide' })}>Your scouting guide<ArrowUpRight size={16} /></button></div>
      <div className="sidebar-bottom"><button onClick={() => setModal({ kind: 'guide' })}><CircleHelp size={18} />How scoring works<ArrowUpRight size={14} /></button><div className="team-profile"><span>T2</span><div><strong>Lancaster venture</strong><small>Student project</small></div><span className="online-dot" /></div></div>
    </aside>
    <main><header className="topbar"><div><button className="icon-button mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><span className="breadcrumb">Workspace<ChevronRight size={14} /><strong>{page}</strong></span></div><span className="location-label"><MapPin size={14} />Lancaster, California<span className="top-divider"/><span className="team-badge">T2</span></span></header>
      <div className="main-content"><section className="page-heading"><div><div className="eyebrow"><span className="tiny-line"/>A LITTLE LOCAL KNOWLEDGE. A LOT OF POTENTIAL.</div><h1>{page === 'Discover' ? <>Find your next <em>great spot.</em></> : page === 'Shortlist' ? <>Good leads, <em>kept close.</em></> : <>Turn a lead into <em>a conversation.</em></>}</h1><p>{page === 'Discover' ? 'Uncover overlooked places. Find the people who need a better snack break.' : page === 'Shortlist' ? 'Your most promising locations, ready for a closer look.' : 'Keep the team’s visits, conversations, and placement decisions moving.'}</p></div><button className="button primary add-button" onClick={() => setModal({ kind: 'form' })}><Plus size={17} />Add location</button></section>
      {error && <div className="error" role="alert">{error}<button className="text-button" onClick={() => load()}><RefreshCw size={14} />Retry</button></div>}
      {!loading && demo && <div className="example-banner"><span className="example-label">EXAMPLE WORKSPACE</span><p>Fictional locations and signals to show you around. Your real workspace is empty.</p><button onClick={() => { setDemo(false); setSelected(null); }}>Start scouting<ArrowRight size={15} /></button></div>}
      {!loading && !demo && !candidates.length && <div className="welcome-banner"><span><Leaf size={19} />Make room for local opportunity.</span><p>Add a field lead or search public listings to begin.</p><button onClick={() => setDemo(true)}>Explore an example<ArrowUpRight size={14} /></button></div>}
      <section className="stats" aria-label={demo ? 'Example workspace statistics' : 'Workspace statistics'}>{stats.map(({ label, value, icon: Icon, note }) => <div className="stat-card" key={label}><div><span>{label}</span><Icon size={18} strokeWidth={1.6} /></div><strong>{loading ? '—' : value}</strong><p>{note}</p></div>)}</section>
      <section className="workspace-section"><div className="section-heading"><div><h2>{page === 'Outreach' ? 'Your outreach board' : 'The opportunity landscape'}<span className="count-pill">{visible.length}</span></h2><p>{demo ? 'Explore sample scenarios, then gather evidence of your own.' : 'A good lead is a starting point. A site visit tells the real story.'}</p></div><div className="section-actions"><button className="text-button export-button" onClick={() => exportCSV(visible)} disabled={!visible.length || demo}><Download size={15} />Export</button><button className="button secondary discover-button" onClick={() => setModal({ kind: 'discover' })}><Search size={15} />Search public listings<ArrowUpRight size={14} /></button></div></div>
        <div className="filters"><div className="search-box"><Search size={17} /><input aria-label="Search locations" placeholder="Search name, area, or teammate…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={14}/></button>}</div><label className="select-filter"><SlidersHorizontal size={15} /><select aria-label="Location type" value={category} onChange={e => setCategory(e.target.value)}><option>All types</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="select-filter sort-filter"><span>Sort:</span><select aria-label="Sort locations" value={sort} onChange={e => setSort(e.target.value)}><option value="score">Highest score</option><option value="name">Name A–Z</option><option value="updated">Recently updated</option></select></label><button className="icon-button refresh-button" aria-label="Refresh shared workspace" onClick={() => load()}><RefreshCw size={15} /></button></div>
        {page === 'Outreach' ? <div className="pipeline">{stages.filter(s => !['To research', 'Not a fit'].includes(s)).map(stage => <div className="pipeline-column" key={stage}><h3><span className={`stage-dot ${stage.replaceAll(' ', '-')}`}/>{stage}<span>{visible.filter(c => c.stage === stage).length}</span></h3>{visible.filter(c => c.stage === stage).map(c => <button key={c.id} className="pipeline-card" onClick={() => showDetails(c)}><CategoryIcon category={c.category}/><strong>{c.name}</strong><span>{c.owner || 'Unassigned'}</span><p>{nextStep(c)}</p></button>)}{!visible.some(c => c.stage === stage) && <p className="pipeline-empty">No locations here yet.<br/>Update a location’s stage to move it here.</p>}</div>)}</div> : <div className="split-view"><div className="location-list"><div className="list-heading"><span>{demo ? 'EXAMPLE LOCATIONS' : 'YOUR LOCATIONS'}</span><span>SCREENING SCORE<CircleHelp size={12} /></span></div>{loading ? <div className="loading"><LoaderCircle className="spin"/><p>Loading your workspace…</p></div> : visible.length ? visible.map(c => <button className={`location-card ${selected?.id === c.id ? 'selected' : ''}`} key={c.id} onClick={() => showDetails(c)}><div className={`category-icon category-${categories.indexOf(c.category)}`}><CategoryIcon category={c.category}/></div><div className="location-info"><div className="location-name"><strong>{c.name}</strong>{c.starred && <Bookmark size={13} fill="currentColor"/>}</div><p>{c.address || 'Address to be confirmed'}</p><div className="location-tags"><span className="category-tag">{c.category}</span><span className="stage"><i className={`stage-dot ${c.stage.replaceAll(' ', '-')}`}/>{c.stage}</span></div></div><div className="location-rating"><Score candidate={c} small/><span>{assess(c).label === 'Worth a visit' ? 'Promising' : assess(c).label === 'Already well served' ? 'Well served' : assess(c).label === 'Verify vending gap' ? 'Verify gap' : 'Research'}</span></div></button>) : <div className="empty-state"><span className="empty-icon"><Compass size={30} strokeWidth={1.4}/></span><h3>{query || category !== 'All types' ? 'No matching locations' : page === 'Shortlist' ? 'Your best leads belong here' : 'Every great spot starts as a lead'}</h3><p>{query || category !== 'All types' ? 'Try another search or clear your filters.' : page === 'Shortlist' ? 'Open a location brief and save it to your shortlist.' : 'Add a location you know, or discover businesses in public map listings.'}</p><button className="button secondary" onClick={() => { if (query || category !== 'All types') { setQuery(''); setCategory('All types'); } else if (page === 'Shortlist') setPage('Discover'); else setModal({ kind: 'form' }); }}>{query || category !== 'All types' ? 'Clear filters' : page === 'Shortlist' ? 'Explore locations' : 'Add your first location'}<ArrowRight size={15}/></button></div>}<div className="list-footer"><span><span className="live-dot"/>{visible.length} {demo ? 'illustrative' : 'saved'} locations</span><span>{visible.filter(c => c.lat == null).length > 0 ? `${visible.filter(c => c.lat == null).length} without map pins` : 'Made for on-the-ground research'}</span></div></div><div className="map-column"><LocationMap candidates={visible} selected={selected} onSelect={showDetails}/><div className="map-legend"><span><i className="legend-dot green"/>Worth a visit</span><span><i className="legend-dot tan"/>Needs a closer look</span><button onClick={() => setModal({ kind: 'guide' })}>About the score<ArrowUpRight size={12}/></button></div></div></div>}
      </section>
      <section className="field-note"><div className="field-note-icon"><Leaf size={22} strokeWidth={1.5}/></div><div><span className="eyebrow">A GOOD SCOUT KNOWS</span><p>The best opportunities aren’t always on the busiest corner.</p><span>Think break rooms, waiting rooms, and places where a quick snack is a long walk away.</span></div><button onClick={() => setModal({ kind: 'guide' })}>What makes a great location?<ArrowUpRight size={16}/></button></section>
      <footer className="page-footer"><span>Local thinking. Better vending.</span><span>Built for Lancaster<span>·</span>MGMT 3400 / Team 2</span></footer>
      </div>
    </main>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modal?.kind === 'form' && <LocationForm candidate={modal.candidate} onSave={save} close={() => setModal(null)}/>}
    {modal?.kind === 'detail' && <Details candidate={modal.candidate} onEdit={candidate => setModal({ kind: 'form', candidate })} onStar={star} onDelete={async c => { await api(`/candidates/${c.id}`, { method: 'DELETE', body: JSON.stringify({ updatedAt: c.updatedAt }) }); setCandidates(previous => previous.filter(x => x.id !== c.id)); setSelected(null); setToast('Location deleted.'); }} close={() => setModal(null)}/>}
    {modal?.kind === 'discover' && <Discovery saved={candidates} onImport={async key => { const saved = await api('/candidates', { method: 'POST', body: JSON.stringify({ discoveryKey: key }) }); setCandidates(previous => [...previous, saved]); setDemo(false); setToast('Public listing added. Verify the vending gap on site.'); }} close={() => setModal(null)}/>}
    {modal?.kind === 'guide' && <Guide close={() => setModal(null)}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
