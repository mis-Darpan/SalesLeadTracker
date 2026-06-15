const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHRH4whSlic0Oe2Gc4AQAPjBC5T9oa6_PkBPzEPx-kud-Dl-YR_6AoXUNIFslYBOU/exec';

// ── ROLES CONFIG ──
const ROLES = {
  admin: { password: 'litpax@admin', label: 'Admin', fullAccess: true }
};

const MAIN_STAGES = ['New Lead', 'Quotation Sent', 'Follow-up', 'Order Confirmed'];
const NEXT_STAGE  = { 'New Lead': 'Quotation Sent', 'Quotation Sent': 'Follow-up', 'Follow-up': 'Order Confirmed' };
const S_EMOJI     = { 'New Lead': '🆕', 'Quotation Sent': '📄', 'Follow-up': '📞', 'Order Confirmed': '✅', 'Lost': '❌' };
const S_SHORT     = { 'New Lead': 'New Lead', 'Quotation Sent': 'Quotation', 'Follow-up': 'Follow-up', 'Order Confirmed': 'Won', 'Lost': 'Lost' };
const S_COLOR     = {
  'New Lead':        { badge: 'background:#e0f5fd;color:#0891c2' },
  'Quotation Sent':  { badge: 'background:#f3effe;color:#6d3be8' },
  'Follow-up':       { badge: 'background:#fff8eb;color:#c97a00' },
  'Order Confirmed': { badge: 'background:#edfaf5;color:#0d9e6e' },
  'Lost':            { badge: 'background:#fff0f0;color:#d43b3b' },
};
const GS_HEADERS = [
  'Lead ID','Date Added','Customer Name','Phone','Email',
  'Company','City','State','Application Type','Voltage',
  'Capacity','No. of Batteries','Existing Brand','Budget Range',
  'Lead Source','Stage','Next Follow-up','Assigned To','Notes','Last Updated'
];

let FILTER = 'All', SORT = 'date';
let ALL_LEADS = []; // in-memory only, no localStorage

// ── AUTH ──
function getSession() {
  try { return JSON.parse(sessionStorage.getItem('ltx_session') || 'null'); } catch { return null; }
}
function setSession(role) {
  sessionStorage.setItem('ltx_session', JSON.stringify({ role, time: Date.now() }));
}
function logout() {
  sessionStorage.removeItem('ltx_session');
  showLogin();
}

function showLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-password').value = '';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const session = getSession();
  document.getElementById('tb-role-badge').textContent = session?.role?.toUpperCase() || 'ADMIN';
  fetchLeads();
}

function doLogin() {
  const pass = document.getElementById('login-password').value.trim();
  const btn  = document.getElementById('login-btn');
  let matched = null;
  for (const [role, cfg] of Object.entries(ROLES)) {
    if (cfg.password === pass) { matched = role; break; }
  }
  if (!matched) {
    document.getElementById('login-error').textContent = '❌ Galat password — dobara try karo';
    document.getElementById('login-password').focus();
    return;
  }
  btn.textContent = '⏳ Logging in...'; btn.disabled = true;
  setSession(matched);
  setTimeout(() => {
    btn.textContent = 'Login →'; btn.disabled = false;
    showApp();
  }, 400);
}

// Enter key on password field
function loginKeydown(e) { if (e.key === 'Enter') doLogin(); }

// ── TOAST ──
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function td() { return new Date().toISOString().slice(0, 10); }

// ── FETCH FROM SHEET (real-time) ──
async function fetchLeads() {
  document.getElementById('lt-body').innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">Sheet se data load ho raha hai...</div></div>`;
  try {
    const r = await fetch(SCRIPT_URL + '?action=getLeads&stage=All');
    const d = await r.json();
    if (d.ok && d.leads) {
      ALL_LEADS = d.leads;
      renderTable();
      updateStats();
    } else {
      ALL_LEADS = [];
      renderTable();
      updateStats();
      toast('Sheet mein koi data nahi mila', 'err');
    }
  } catch (e) {
    ALL_LEADS = [];
    renderTable();
    updateStats();
    toast('❌ Sheet se connect nahi hua — Script check karo', 'err');
  }
}

// ── FORM ──
function selStage(el) {
  document.querySelectorAll('#modal-add .sp').forEach(p => p.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('f-stage').value = el.dataset.s;
}
function openAddModal()  { document.getElementById('modal-add').classList.add('open'); }
function closeAddModal() { document.getElementById('modal-add').classList.remove('open'); }

function addLead() {
  const name  = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const oem   = document.getElementById('f-oem').value;
  const stage = document.getElementById('f-stage').value;
  if (!name || !phone || !oem || !stage) { toast('Name, Phone aur Application required hai', 'err'); return; }

  const btn = document.getElementById('add-btn');
  btn.disabled = true; btn.textContent = '⏳ Adding...';

  const lead = {
    id: 'LD' + Date.now(), date: td(), name, phone,
    email:    document.getElementById('f-email').value.trim(),
    company:  document.getElementById('f-company').value.trim(),
    city:     document.getElementById('f-city').value.trim(),
    state:    document.getElementById('f-state').value.trim(),
    oem,
    voltage:  document.getElementById('f-voltage').value,
    capacity: document.getElementById('f-capacity').value,
    fleet:    document.getElementById('f-fleet').value,
    model:    document.getElementById('f-model').value,
    source:   document.getElementById('f-source').value,
    amount:   document.getElementById('f-amount').value,
    stage,
    followup: document.getElementById('f-followup').value,
    notes:    document.getElementById('f-notes').value.trim(),
    assigned: document.getElementById('f-assigned').value,
    history:  [{ stage, date: td(), note: 'Lead added' }],
    updatedAt: td()
  };

  syncToSheets('addLead', lead).then(ok => {
    if (ok) {
      toast('✅ Lead added & synced!', 'ok');
      fetchLeads(); // refresh from sheet
    } else {
      toast('❌ Sheet sync nahi hua — check karo', 'err');
    }
    resetForm(); closeAddModal();
    btn.disabled = false; btn.textContent = '⚡ Add to Pipeline';
  });
}

function resetForm() {
  ['f-name','f-phone','f-email','f-company','f-city','f-state','f-fleet','f-notes','f-followup']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['f-oem','f-voltage','f-capacity','f-model','f-source','f-assigned','f-amount']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.querySelectorAll('#modal-add .sp').forEach(p => p.classList.remove('sel'));
  document.querySelector('#modal-add .sp[data-s="New Lead"]').classList.add('sel');
  document.getElementById('f-stage').value = 'New Lead';
}

// ── FILTER / SORT ──
function setFilter(f, el) {
  FILTER = f;
  document.querySelectorAll('.kpi').forEach(k => k.classList.remove('active-kpi'));
  el.classList.add('active-kpi');
  renderTable();
}
function setSort(s, el) {
  SORT = s;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  renderTable();
}

// ── FOLLOW-UP HTML ──
function fuHtml(followup) {
  if (!followup) return '<span class="fu-none">—</span>';
  const diff = Math.round((new Date(followup) - new Date(td())) / 86400000);
  if (diff < 0)   return `<span class="fu-over">⚠️ Overdue ${Math.abs(diff)}d</span>`;
  if (diff === 0) return `<span class="fu-due">📞 Aaj!</span>`;
  if (diff <= 2)  return `<span class="fu-due">📞 ${diff}d baad</span>`;
  return `<span class="fu-ok">📅 ${followup}</span>`;
}

// ── RENDER TABLE ──
function renderTable() {
  let leads = [...ALL_LEADS];
  const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
  leads = leads.filter(l => {
    const mf = FILTER === 'All' || l.stage === FILTER;
    const ms = !q || l.name.toLowerCase().includes(q) || (l.company || '').toLowerCase().includes(q) || (l.phone || '').includes(q);
    return mf && ms;
  });

  if (SORT === 'name')          leads.sort((a, b) => a.name.localeCompare(b.name));
  else if (SORT === 'followup') leads.sort((a, b) => (a.followup || '9999') > (b.followup || '9999') ? 1 : -1);
  else if (SORT === 'stage')    leads.sort((a, b) => MAIN_STAGES.indexOf(a.stage) - MAIN_STAGES.indexOf(b.stage));
  else leads.sort((a, b) => b.id > a.id ? 1 : -1);

  const body = document.getElementById('lt-body');
  if (!leads.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-title">Koi lead nahi</div><div style="font-size:.7rem;color:var(--muted);margin-top:.14rem">Upar filter click karo ya naya lead add karo</div></div>`;
    return;
  }

  const sc = l => S_COLOR[l.stage] || S_COLOR['New Lead'];
  const ns = l => NEXT_STAGE[l.stage];

  body.innerHTML = leads.map(l => `
    <div class="lt-row" onclick="openDetail('${l.id}')">
      <div>
        <div class="lt-name">${l.name}</div>
        <div class="lt-co">${[l.company, l.city].filter(Boolean).join(' · ') || '—'}</div>
        <div class="lt-phone">${l.phone}</div>
      </div>
      <div class="lt-app">${l.oem || '—'}<br><span style="font-size:.62rem;color:var(--muted)">${[l.voltage, l.capacity].filter(Boolean).join(' ') || ''}</span></div>
      <div><span class="badge" style="${sc(l).badge}">${S_EMOJI[l.stage]} ${l.stage}</span></div>
      <div>${fuHtml(l.followup)}</div>
      <div class="lt-asgn">${l.assigned || '—'}</div>
      <div class="row-actions" onclick="event.stopPropagation()">
        ${ns(l) ? `<button class="ra" onclick="quickStage('${l.id}','${ns(l)}')">→ ${S_SHORT[ns(l)]}</button>` : ''}
        <button class="ra won"  onclick="quickStage('${l.id}','Order Confirmed')">✅</button>
        <button class="ra lost" onclick="quickStage('${l.id}','Lost')">❌</button>
      </div>
    </div>`).join('');
}

// ── QUICK STAGE ──
function quickStage(id, stage) {
  syncToSheets('updateLead', { id, stage, followup: '', notes: '' }).then(ok => {
    if (ok) { toast(S_EMOJI[stage] + ' ' + stage, 'ok'); fetchLeads(); }
    else toast('❌ Update nahi hua', 'err');
  });
}

// ── STATS ──
function updateStats() {
  const leads = ALL_LEADS;
  const c = s => leads.filter(l => l.stage === s).length;
  document.getElementById('k-total').textContent = leads.length;
  document.getElementById('k-new').textContent   = c('New Lead');
  document.getElementById('k-quot').textContent  = c('Quotation Sent');
  document.getElementById('k-fol').textContent   = c('Follow-up');
  document.getElementById('k-won').textContent   = c('Order Confirmed');
  document.getElementById('k-lost').textContent  = c('Lost');
  const won = c('Order Confirmed');
  document.getElementById('t-total').textContent = leads.length;
  document.getElementById('t-won').textContent   = won;
  document.getElementById('t-rate').textContent  = (leads.length ? Math.round(won / leads.length * 100) : 0) + '%';
  document.getElementById('t-due').textContent   = leads.filter(l => l.followup === td()).length;
  const stages = ['New Lead','Quotation Sent','Follow-up','Order Confirmed','Lost'];
  const colors = ['#0891c2','#6d3be8','#c97a00','#0d9e6e','#d43b3b'];
  const total  = leads.length || 1;
  document.getElementById('pipe-bar').innerHTML = stages.map((s, i) => {
    const pct = Math.max((c(s) / total) * 100, 1.5);
    return `<div class="pb-s" style="flex:${pct};background:${colors[i]}" title="${s}: ${c(s)}"></div>`;
  }).join('');
}

// ── JOURNEY HTML ──
function buildJourney(lead) {
  const isLost = lead.stage === 'Lost';
  const curIdx = MAIN_STAGES.indexOf(lead.stage);
  let html = '<div class="journey">';
  MAIN_STAGES.forEach((s, i) => {
    const isDone   = !isLost && i < curIdx;
    const isActive = !isLost && i === curIdx;
    const dotColors = { 'New Lead': '#0891c2', 'Quotation Sent': '#6d3be8', 'Follow-up': '#c97a00', 'Order Confirmed': '#0d9e6e' };
    let dc = '', ds = '', dl = '';
    if (isDone)   { dc = 'done'; dl = '✓'; }
    if (isActive) { dc = 'active'; dl = '●'; ds = `border-color:${dotColors[s]};background:${dotColors[s]};color:#fff;`; }
    html += `<div class="jstep${isDone ? ' done' : ''}" onclick="setDetailStage('${s}')" title="Move to: ${s}">
      <div class="jdot ${dc}" style="${ds}">${dl}</div>
      <div class="jlbl${isActive ? ' active' : ''}">${S_SHORT[s]}</div>
    </div>`;
  });
  if (isLost) html += `<div class="jstep" style="flex:0;margin-left:8px"><div class="jdot jlost">✕</div><div class="jlbl" style="color:var(--red)">Lost</div></div>`;
  return html + '</div>';
}

// ── SHEET ROW ──
function buildSheetRow(l) {
  return [
    l.id, l.date, l.name, l.phone, l.email || '',
    l.company || '', l.city || '', l.state || '',
    l.oem || '', l.voltage || '', l.capacity || '', l.fleet || '',
    l.model || '', l.amount || '', l.source || '',
    l.stage, l.followup || '', l.assigned || '', l.notes || '',
    l.updatedAt || l.date
  ];
}

// ── DETAIL MODAL ──
function openDetail(id) {
  const l = ALL_LEADS.find(x => x.id === id);
  if (!l) return;
  const sc  = S_COLOR[l.stage] || S_COLOR['New Lead'];
  const ROW = buildSheetRow(l);

  document.getElementById('detail-title').textContent = l.name + (l.company ? ' · ' + l.company : '');
  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.7rem;flex-wrap:wrap">
      <span class="badge" style="${sc.badge};font-size:.68rem;padding:.22rem .7rem">${S_EMOJI[l.stage]} ${l.stage}</span>
      <span style="font-size:.65rem;color:var(--muted)">Added: ${l.date}</span>
      <span style="font-size:.65rem;color:var(--muted)">· Updated: ${l.updatedAt || l.date}</span>
    </div>
    <div class="sec-title">Pipeline Journey</div>
    ${buildJourney(l)}
    <div class="sec-title">Customer Details</div>
    <div class="dgrid">
      <div class="ditem"><div class="dlbl">Phone</div><div class="dval">${l.phone}</div></div>
      <div class="ditem"><div class="dlbl">Email</div><div class="dval">${l.email || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Company</div><div class="dval">${l.company || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Location</div><div class="dval">${[l.city, l.state].filter(Boolean).join(', ') || '—'}</div></div>
    </div>
    <div class="sec-title">Battery Requirement</div>
    <div class="dgrid">
      <div class="ditem"><div class="dlbl">Application</div><div class="dval">${l.oem || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Voltage / Capacity</div><div class="dval">${[l.voltage, l.capacity].filter(Boolean).join(' / ') || '—'}</div></div>
      <div class="ditem"><div class="dlbl">No. of Batteries</div><div class="dval">${l.fleet || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Existing Brand</div><div class="dval">${l.model || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Budget</div><div class="dval">${l.amount || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Lead Source</div><div class="dval">${l.source || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Assigned To</div><div class="dval">${l.assigned || '—'}</div></div>
      <div class="ditem"><div class="dlbl">Follow-up Date</div><div class="dval">${fuHtml(l.followup)}</div></div>
    </div>
    ${l.notes ? `<div style="background:var(--amber-l);border:1px solid var(--amber-m);border-radius:7px;padding:.55rem .8rem;font-size:.76rem;color:var(--ink3);margin-bottom:.85rem">💬 ${l.notes}</div>` : ''}
    <div class="sec-title">Update Stage</div>
    <div class="stage-btns">
      ${['New Lead','Quotation Sent','Follow-up','Order Confirmed','Lost'].map(s => `
        <button class="sb2 ${l.stage === s ? 'cur' : ''}" data-s="${s}" onclick="setDetailStage('${s}')">${S_EMOJI[s]} ${s}</button>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin-bottom:.85rem">
      <div><div class="mlbl">Follow-up Date</div>
        <input type="date" id="d-followup" value="${l.followup || ''}" style="background:var(--bg);border:1.5px solid var(--border);border-radius:6px;color:var(--ink);font-family:'DM Sans',sans-serif;font-size:.8rem;padding:.42rem .65rem;width:100%">
      </div>
      <div><div class="mlbl">Quick Note</div>
        <input type="text" id="d-note" placeholder="Note daalo..." style="background:var(--bg);border:1.5px solid var(--border);border-radius:6px;color:var(--ink);font-family:'DM Sans',sans-serif;font-size:.8rem;padding:.42rem .65rem;width:100%">
      </div>
    </div>
    <div class="sec-title">History</div>
    <div class="hist-list">
      ${(l.history || []).slice().reverse().map(h => `
        <div class="hist-row">
          <span class="hist-date">${h.date}</span>
          <span class="hist-stage">${h.stage}</span>
          ${h.note ? `<span class="hist-note">— ${h.note}</span>` : ''}
        </div>`).join('')}
    </div>
    <div class="copy-wrap">
      <div class="copy-head">
        <div class="copy-head-title">📋 Google Sheet — Copy &amp; Paste</div>
        <div class="cbtns">
          <button class="cbtn cbtn-row"  onclick="copySheet('row')">Copy Data Row</button>
          <button class="cbtn cbtn-full" onclick="copySheet('full')">Header + Row</button>
        </div>
      </div>
      <table class="ctable">
        ${GS_HEADERS.map((h, i) => `
        <tr>
          <td class="ct-h">${String.fromCharCode(65 + i)} · ${h}</td>
          <td class="ct-v ${ROW[i] ? '' : 'ct-mt'}">${ROW[i] || '(empty)'}</td>
        </tr>`).join('')}
      </table>
    </div>`;

  window._detailId = id;
  window._sheetData = {
    row:  ROW.map(v => String(v).replace(/\t/g, ' ')).join('\t'),
    full: GS_HEADERS.join('\t') + '\n' + ROW.map(v => String(v).replace(/\t/g, ' ')).join('\t')
  };

  document.getElementById('detail-footer').innerHTML = `
    <button class="btn-danger" onclick="deleteLead('${l.id}')">🗑 Delete</button>
    <button class="btn-save"   onclick="saveDetail('${l.id}')">💾 Save Update</button>`;

  document.getElementById('modal-detail').classList.add('open');
}

function setDetailStage(s) {
  document.querySelectorAll('.sb2').forEach(b => b.classList.remove('cur'));
  document.querySelector(`.sb2[data-s="${s}"]`)?.classList.add('cur');
}

function saveDetail(id) {
  const l = ALL_LEADS.find(x => x.id === id);
  if (!l) return;
  const ns   = document.querySelector('.sb2.cur')?.dataset.s || l.stage;
  const nf   = document.getElementById('d-followup').value;
  const note = document.getElementById('d-note').value.trim();
  syncToSheets('updateLead', { id, stage: ns, followup: nf, notes: note }).then(ok => {
    if (ok) { toast('✅ Updated & synced!', 'ok'); closeDetail(); fetchLeads(); }
    else toast('❌ Update nahi hua', 'err');
  });
}

function deleteLead(id) {
  if (!confirm('Delete karna hai?')) return;
  syncToSheets('deleteLead', { id }).then(ok => {
    if (ok) { toast('Lead deleted', 'ok'); closeDetail(); fetchLeads(); }
    else toast('❌ Delete nahi hua', 'err');
  });
}

function closeDetail() { document.getElementById('modal-detail').classList.remove('open'); }

function copySheet(type) {
  const text = type === 'full' ? window._sheetData.full : window._sheetData.row;
  navigator.clipboard.writeText(text)
    .then(() => toast('✅ Copied! Sheet mein Ctrl+V karo', 'ok'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      toast('✅ Copied! Sheet mein Ctrl+V karo', 'ok');
    });
}

// ── SYNC TO SHEETS ──
async function syncToSheets(action, payload) {
  if (!SCRIPT_URL) return false;
  try {
    const r = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action, payload }) });
    return (await r.json()).ok;
  } catch {
    try {
      const r = await fetch(SCRIPT_URL + '?data=' + encodeURIComponent(JSON.stringify({ action, payload })));
      return (await r.json()).ok;
    } catch { return false; }
  }
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (session) { showApp(); }
  else { showLogin(); }
});
