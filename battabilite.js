/* ============================================================
   BATTABILITÉ DES PIEUX MÉTALLIQUES
   Alaa Eddine Ezzebdi & Yahya Sarouf
   ============================================================ */

'use strict';

/* ─── STATE ─── */
let layers = [], lid = 0, chart = null;

/* ─── SOIL DICTIONARY ─── */
const SOILS = {
  'Remblai 0-200mm'      : { c:'#84cc16', autoFs: qc => Math.min(qc*1000*0.008, 60 ), defQp: 0   },
  'Sable lâche'          : { c:'#fbbf24', autoFs: qc => Math.min(qc*1000*0.012, 100), defQp: 0   },
  'Sable moyen'          : { c:'#f97316', autoFs: qc => Math.min(qc*1000*0.012, 150), defQp: 0   },
  'Sable dense'          : { c:'#3b82f6', autoFs: qc => Math.min(qc*1000*0.012, 200), defQp: 3.1 },
  'Conglomérat'          : { c:'#8b5cf6', autoFs: qc => Math.min(qc*1000*0.010, 280), defQp: 3.0 },
  'Tuf volcanique altéré': { c:'#ef4444', autoFs: qc => Math.min(qc*1000*0.010, 220), defQp: 2.0 },
  'Tuf volcanique sain'  : { c:'#10b981', autoFs: qc => Math.min(qc*1000*0.008, 350), defQp: 3.1 },
  'Marne grise'          : { c:'#06b6d4', autoFs: qc => Math.min(qc*1000*0.008, 300), defQp: 2.5 },
  'Argile'               : { c:'#ec4899', autoFs: qc => Math.min(qc*1000*0.030,  80), defQp: 0.5 },
  'Gravier'              : { c:'#a3e635', autoFs: qc => Math.min(qc*1000*0.010, 150), defQp: 2.0 },
  'Autre'                : { c:'#94a3b8', autoFs: qc => Math.min(qc*1000*0.010, 100), defQp: 0   },
};
const SNAMES = Object.keys(SOILS);

/* ─── PRESET DATA ─── */
const PDATA = {
  nadorZ1: [
    { name:'Remblai 0-200mm',     from:-1,  to:-7,  qc:5,  fs:58,  qp:0   },
    { name:'Sable lâche',         from:-7,  to:-23, qc:34, fs:170, qp:0   },
    { name:'Sable dense',         from:-23, to:-27, qc:50, fs:250, qp:0   },
    { name:'Tuf volcanique sain', from:-27, to:-45, qc:53, fs:245, qp:3.1 },
  ],
  nadorZ2: [
    { name:'Remblai 0-200mm',     from:-7,  to:-21, qc:5,  fs:58,  qp:0   },
    { name:'Sable lâche',         from:-21, to:-26, qc:34, fs:170, qp:0   },
    { name:'Sable dense',         from:-26, to:-30, qc:50, fs:250, qp:0   },
    { name:'Tuf volcanique sain', from:-30, to:-48, qc:53, fs:245, qp:3.1 },
  ],
  nadorZ3: [
    { name:'Remblai 0-200mm',     from:-7,  to:-21, qc:5,  fs:58,  qp:0   },
    { name:'Sable lâche',         from:-21, to:-28, qc:34, fs:170, qp:0   },
    { name:'Sable dense',         from:-28, to:-33, qc:50, fs:250, qp:0   },
    { name:'Tuf volcanique sain', from:-33, to:-52, qc:53, fs:245, qp:3.1 },
  ],
  nadorZ4: [
    { name:'Remblai 0-200mm',     from:-10, to:-21, qc:5,  fs:58,  qp:0   },
    { name:'Sable lâche',         from:-21, to:-27, qc:34, fs:170, qp:0   },
    { name:'Sable dense',         from:-27, to:-37, qc:50, fs:250, qp:0   },
    { name:'Tuf volcanique sain', from:-37, to:-58, qc:53, fs:245, qp:3.1 },
  ],
  vide: [],
};

/* ─── HAMMER PRESETS ─── */
const HAMMERS = {
  ihc350  : { Wr:350,  eta:75, mass:16500, stroke:2.025 },
  ihc250  : { Wr:244,  eta:75, mass:16572, stroke:1.470 },
  ihc500  : { Wr:500,  eta:75, mass:24000, stroke:2.083 },
  menck400: { Wr:400,  eta:80, mass:40000, stroke:1.000 },
  custom  : null,
};

/* ============================================================
   TABS
   ============================================================ */
function showTab(n) {
  [0,1,2].forEach(i => {
    document.getElementById('p'+i).classList.toggle('on', i===n);
    document.getElementById('t'+i).classList.toggle('on', i===n);
  });
}

/* ============================================================
   NADOR DROPDOWN
   ============================================================ */
function toggleNadorMenu(e) {
  e.stopPropagation();
  document.getElementById('nador-dropdown').classList.toggle('open');
}
document.addEventListener('click', () => {
  const dd = document.getElementById('nador-dropdown');
  if (dd) dd.classList.remove('open');
});

/* ============================================================
   PRESETS
   ============================================================ */
function preset(key, btn) {
  document.querySelectorAll('.pset-chip').forEach(b => b.classList.remove('on'));
  const nb  = document.getElementById('nador-main-btn');
  const zoneLabels = { nadorZ1:'Zone I', nadorZ2:'Zone II', nadorZ3:'Zone III', nadorZ4:'Zone IV' };
  if (zoneLabels[key]) {
    nb.textContent = 'Nador West Med (' + zoneLabels[key] + ') ▾';
    nb.classList.add('on');
  } else {
    nb.textContent = 'Nador West Med ▾';
    nb.classList.remove('on');
    if (btn) btn.classList.add('on');
  }
  document.getElementById('nador-dropdown').classList.remove('open');
  clearAll();
  (PDATA[key] || []).forEach(l => addLayer(l, false));
  drawStrat();
  updHint();
}

/* ============================================================
   LAYER CRUD
   ============================================================ */
function clearAll() {
  layers = [];
  document.getElementById('lc').innerHTML = '';
}

function addLayer(d, redraw) {
  lid++;
  const id   = 'L' + lid;
  const prev = layers.length > 0 ? layers[layers.length-1] : null;
  d = d || {
    name : 'Sable lâche',
    from : prev ? prev.to : 0,
    to   : (prev ? prev.to : 0) - 5,
    qc   : 10,
    fs   : 120,
    qp   : 0,
  };
  layers.push({ id, ...d });
  buildItem(id, d, redraw !== false);
  if (redraw !== false) { drawStrat(); updHint(); }
}

function buildItem(id, d, expand) {
  const cont = document.getElementById('lc');
  const idx  = layers.findIndex(l => l.id === id);
  const s    = SOILS[d.name] || SOILS['Autre'];
  const opts = SNAMES.map(n => `<option value="${n}"${n===d.name?' selected':''}>${n}</option>`).join('');
  const div  = document.createElement('div');
  div.className = 'ly-item' + (expand ? ' open' : '');
  div.id = 'li' + id;
  div.innerHTML = `
<div class="ly-hdr" onclick="toggle('${id}')">
  <div class="ly-dot" id="ld${id}" style="background:${s.c}"></div>
  <div class="ly-sum">
    <div class="ly-name" id="ln${id}">${idx+1}. ${d.name}</div>
    <div class="ly-meta" id="lm${id}">${meta(d)}</div>
  </div>
  <div class="ly-acts">
    <button class="ico-btn del" onclick="event.stopPropagation();delLayer('${id}')">✕</button>
    <div class="ly-chev">▼</div>
  </div>
</div>
<div class="ly-fields">
  <div class="fg3" style="margin-bottom:.55rem">
    <div class="fg"><label>Nature du sol</label><select id="fn${id}" onchange="onChange('${id}',true)">${opts}</select></div>
    <div class="fg"><label>Cote sup. (mZH)</label><input type="number" id="ff${id}" value="${d.from}" step=".1" oninput="onChange('${id}')"></div>
    <div class="fg"><label>Cote inf. (mZH)</label><input type="number" id="ft${id}" value="${d.to}" step=".1" oninput="onChange('${id}')"></div>
  </div>
  <div class="fg3">
    <div class="fg"><label>qc CPT (MPa)</label><input type="number" id="fq${id}" value="${d.qc}" step=".5" min="0" oninput="onChange('${id}',true)"></div>
    <div class="fg"><label>fs frot. (kPa)</label><input type="number" id="fs${id}" value="${d.fs}" step="5" min="0" oninput="onChange('${id}')"></div>
    <div class="fg"><label>qp pointe (MPa)</label><input type="number" id="fp${id}" value="${d.qp}" step=".1" min="0" oninput="onChange('${id}')"></div>
  </div>
</div>`;
  cont.appendChild(div);
}

function toggle(id) {
  document.getElementById('li'+id).classList.toggle('open');
}

function delLayer(id) {
  layers = layers.filter(l => l.id !== id);
  const el = document.getElementById('li'+id);
  if (el) el.remove();
  renumber();
  drawStrat();
  updHint();
}

function renumber() {
  layers.forEach((l, i) => {
    const el = document.getElementById('ln'+l.id);
    if (el) el.textContent = (i+1) + '. ' + l.name;
  });
}

function meta(d) {
  const th = (!isNaN(d.from) && !isNaN(d.to)) ? Math.abs(d.from - d.to).toFixed(1)+'m' : '–';
  const f  = !isNaN(d.from) ? d.from : '–';
  const t  = !isNaN(d.to)   ? d.to   : '–';
  const n  = (d.fs !== undefined) ? ` · fs=${d.fs} kPa · qc=${d.qc||0}MPa` : '';
  return `${th} · ${f}–${t}m${n}`;
}

function onChange(id, autoCalc) {
  const l = layers.find(x => x.id === id);
  if (!l) return;
  const name = document.getElementById('fn'+id)?.value || l.name;
  const from = parseFloat(document.getElementById('ff'+id)?.value);
  const to   = parseFloat(document.getElementById('ft'+id)?.value);
  const qc   = parseFloat(document.getElementById('fq'+id)?.value) || 0;
  let   fs   = parseFloat(document.getElementById('fs'+id)?.value);
  const qp   = parseFloat(document.getElementById('fp'+id)?.value) || 0;

  // Auto-calc fs when name or qc changes
  if (autoCalc) {
    const s = SOILS[name] || SOILS['Autre'];
    fs = s.autoFs(qc);
    const fsEl = document.getElementById('fs'+id);
    if (fsEl) fsEl.value = Math.round(fs);
    const qpEl = document.getElementById('fp'+id);
    if (qpEl && document.getElementById('fn'+id)?.value !== l.name) {
      qpEl.value = s.defQp;
      l.qp = s.defQp;
    }
    // Update dot color
    const dot = document.getElementById('ld'+id);
    if (dot) dot.style.background = s.c;
  }

  l.name = name;
  l.from = isNaN(from) ? l.from : from;
  l.to   = isNaN(to)   ? l.to   : to;
  l.qc   = qc;
  l.fs   = isNaN(fs) ? l.fs : fs;
  l.qp   = qp;

  // Update displayed name & meta
  const nameEl = document.getElementById('ln'+id);
  if (nameEl) {
    const idx = layers.findIndex(x => x.id === id);
    nameEl.textContent = (idx+1) + '. ' + l.name;
  }
  const metaEl = document.getElementById('lm'+id);
  if (metaEl) metaEl.textContent = meta(l);

  // Warn if from <= to (invalid depth order)
  const item = document.getElementById('li'+id);
  if (item) {
    const invalid = !isNaN(l.from) && !isNaN(l.to) && l.from <= l.to;
    item.style.borderColor = invalid ? '#ef4444' : '';
    const warn = item.querySelector('.depth-warn');
    if (invalid && !warn) {
      const w = document.createElement('div');
      w.className = 'depth-warn';
      w.style.cssText = 'font-size:.7rem;color:#ef4444;margin-top:.3rem;padding-top:.3rem;border-top:1px solid #fecaca';
      w.textContent = '⚠ Cote supérieure doit être > cote inférieure (ex: −21 > −26)';
      item.querySelector('.ly-fields').appendChild(w);
    } else if (!invalid && warn) {
      warn.remove();
    }
  }

  drawStrat();
  updHint();
}

/* ============================================================
   STRATIGRAPHIC CANVAS
   ============================================================ */
function drawStrat() {
  const cv  = document.getElementById('sc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W   = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const valid = layers.filter(l => !isNaN(l.from) && !isNaN(l.to) && l.from > l.to);
  if (valid.length === 0) {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(8, 0, W-16, H);
    return;
  }

  const topZ = Math.max(...valid.map(l => l.from));
  const botZ = Math.min(...valid.map(l => l.to));
  const span = Math.max(topZ - botZ, 1);

  valid.forEach(l => {
    const y1 = ((topZ - l.from) / span) * H;
    const y2 = ((topZ - l.to)   / span) * H;
    const s  = SOILS[l.name] || SOILS['Autre'];
    ctx.fillStyle = s.c + 'cc';
    ctx.fillRect(8, y1, W-16, y2-y1);
    // depth tick
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y1, W, 1);
  });

  // Bottom line
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, H-1, W, 1);
}

/* ============================================================
   PILE CROSS-SECTION CANVAS
   ============================================================ */
function drawPV() {
  const D = parseFloat(document.getElementById('pD')?.value) || 1000;
  const t = parseFloat(document.getElementById('pt')?.value) || 20;
  const Di = D - 2*t;
  const As = Math.PI/4 * (D*D - Di*Di) / 1e6; // m²

  document.getElementById('pvD').textContent  = D;
  document.getElementById('pvDi').textContent = Di.toFixed(1);
  document.getElementById('pvT').textContent  = t;
  document.getElementById('pvA').textContent  = As.toFixed(4);

  const cv  = document.getElementById('pvc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0,0,W,H);
  const cx = W/2, cy = H/2, R = Math.min(W,H)*0.44;
  const ri = R * (Di/D);

  // Outer fill (steel)
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  // Inner void
  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = '#f4f6fb';
  ctx.fill();

  // Labels
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('t=' + t + ' mm', cx, cy - ri + (R-ri)/2);
}

/* ============================================================
   HAMMER PRESET
   ============================================================ */
function hPreset() {
  const key = document.getElementById('hpre')?.value;
  const h = HAMMERS[key];
  if (!h) return;
  document.getElementById('hWr').value     = h.Wr;
  document.getElementById('heta').value    = h.eta;
  document.getElementById('hmass').value   = h.mass;
  document.getElementById('hstroke').value = h.stroke;
  updEeff();
}

function updEeff() {
  const Wr  = parseFloat(document.getElementById('hWr')?.value) || 0;
  const eta = parseFloat(document.getElementById('heta')?.value) || 75;
  const Eeff = (Wr * eta / 100).toFixed(0);
  const el = document.getElementById('eeff');
  if (el) el.textContent = Eeff + ' kJ';
}

function steelChange() {
  const v = document.getElementById('psteel')?.value;
  const map = { S355:355, X65:440, X70:480 };
  if (map[v]) document.getElementById('pfy').value = map[v];
}

/* ============================================================
   HINT COUNTER
   ============================================================ */
function updHint() {
  const el = document.getElementById('hl');
  if (el) el.textContent = layers.length;
}

/* ============================================================
   MAIN CALCULATION
   ============================================================ */
function calc() {
  // ── READ PILE ──
  const D_mm  = parseFloat(document.getElementById('pD').value);
  const t_mm  = parseFloat(document.getElementById('pt').value);
  const Ltot  = parseFloat(document.getElementById('pL').value);
  const fy    = parseFloat(document.getElementById('pfy').value);
  const plug  = document.getElementById('pplug').value;
  const zcut  = parseFloat(document.getElementById('pcut').value);
  const ztoe  = parseFloat(document.getElementById('ptoe').value);

  // ── READ HAMMER ──
  const Wr  = parseFloat(document.getElementById('hWr').value);
  const eta = parseFloat(document.getElementById('heta').value) / 100;
  const qt  = parseFloat(document.getElementById('qtoe').value);
  const qs  = parseFloat(document.getElementById('qshaft').value);

  // ── VALIDATION ──
  if ([D_mm,t_mm,Ltot,fy,Wr].some(isNaN)) {
    alert('Vérifiez les paramètres du pieu et du marteau.'); return;
  }
  if (layers.length === 0) {
    alert('Ajoutez au moins une couche de sol.'); return;
  }
  if (layers.some(l => isNaN(l.from) || isNaN(l.to) || l.from <= l.to)) {
    alert('Vérifiez les cotes des couches (cote sup. doit être > cote inf.).'); return;
  }

  // ── PILE GEOMETRY (SI: m, m², kPa, kN) ──
  const D  = D_mm / 1000;
  const t  = t_mm / 1000;
  const Di = D - 2*t;

  const As  = Math.PI/4 * (D*D - Di*Di);      // m² steel cross-section
  const po  = Math.PI * D;                     // outer perimeter m
  const pi2 = Math.PI * Di;                    // inner perimeter m
  const peff = (plug === 'open') ? (po + pi2) : po;  // effective perimeter
  const At  = (plug === 'closed') ? (Math.PI/4*D*D) : As; // toe area m²

  // ── EFFECTIVE ENERGY ──
  const Eeff = Wr * eta;  // kJ = kN·m

  // ── SHAFT FRICTION (layer by layer) ──
  let Qs = 0;
  const LR = [];

  layers.forEach((l, idx) => {
    // Intersection of pile embedded zone [zcut … ztoe] with this layer [l.from … l.to]
    // Note: all elevations negative, from > to (e.g. from=-21, to=-26)
    const top = Math.min(l.from, zcut);   // upper bound of intersection
    const bot = Math.max(l.to,   ztoe);   // lower bound of intersection

    if (top <= bot) {
      // No overlap
      LR.push({ ...l, th:0, Al:0, Qs:0, act:false });
      return;
    }

    const th = top - bot;               // thickness [m], always > 0
    const Al = peff * th;               // lateral area [m²]
    const q  = (l.fs || 0) * Al;        // kPa × m² = kN ✓
    Qs += q;
    LR.push({ ...l, th, Al, Qs:q, act:true });
  });

  // ── POINT RESISTANCE ──
  // Find which layer contains the toe
  let toeL = null;
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (ztoe <= l.from && ztoe >= l.to) { toeL = l; break; }
  }
  if (!toeL) {
    const a = LR.filter(r => r.act);
    if (a.length) toeL = a[a.length-1];
  }
  const qp_kPa = (toeL?.qp || 0) * 1000;  // MPa → kPa ✓
  const Qp     = qp_kPa * At;              // kPa × m² = kN ✓

  const Qult = Qs + Qp;

  // ── BLOW COUNT (Hiley simplified) ──
  // E_eff = Q_ult × (set + q_avg)  →  set = E_eff/Q_ult - q_avg
  const qtm  = qt / 1000;  // mm → m
  const qsm  = qs / 1000;  // mm → m
  const qavg = Qult > 0 ? (Qs*qsm + Qp*qtm) / Qult : qtm;
  let s      = Eeff / Math.max(Qult, 1) - qavg;
  let bl;
  if (s <= 0.0002) {
    bl = 999; s = 0.0002;
  } else {
    bl = Math.max(1, Math.min(Math.round(0.1 / s), 999));
  }

  // ── COMPRESSION STRESS ──
  const Esteel  = 210e6;   // kPa
  const sigkPa  = Math.sqrt(2 * Eeff * Esteel / (As * Ltot));
  const sigMPa  = sigkPa / 1000;

  // ── VERDICT ──
  const okB   = bl <= 80;
  const warnB = bl <= 120;
  const okS   = sigMPa <= 0.9 * fy;
  let vc, vi, vt, vd;

  if (bl > 150 || !okS) {
    vc = 'v-fail'; vi = '✕'; vt = 'NON BATTABLE';
    vd = `${bl >= 999 ? '>150' : bl} coups/10 cm — Marteau insuffisant ou contrainte dépassée (${sigMPa.toFixed(1)} MPa > ${(0.9*fy).toFixed(0)} MPa).`;
  } else if (!okB) {
    vc = 'v-warn'; vi = '⚠'; vt = 'BATTABILITÉ MARGINALE';
    vd = `${bl} coups/10 cm — Conditions difficiles. Essai PDA recommandé.`;
  } else {
    vc = 'v-ok'; vi = '✓'; vt = 'BATTABLE';
    vd = `${bl} coups/10 cm — Le pieu est battable dans des conditions normales.`;
  }

  const cc = (v, ok, warn) => ok ? 'c-ok' : warn ? 'c-warn' : 'c-bad';

  // ── RENDER RESULTS ──
  document.getElementById('res-content').innerHTML = `
<div class="verdict ${vc}">
  <div class="v-ico">${vi}</div>
  <div><div class="v-ttl">${vt}</div><div class="v-desc">${vd}</div></div>
</div>
<div class="mbox-grid">
  <div class="mbox"><div class="mb-lbl">Q_ult totale</div>
    <div class="mb-val ${Qult>10000?'c-ok':Qult>5000?'c-warn':'c-bad'}">${(Qult/1000).toFixed(2)}<span class="mb-unit">MN</span></div></div>
  <div class="mbox"><div class="mb-lbl">Frottement Q_s</div>
    <div class="mb-val c-blu">${(Qs/1000).toFixed(2)}<span class="mb-unit">MN</span></div></div>
  <div class="mbox"><div class="mb-lbl">Pointe Q_p</div>
    <div class="mb-val c-blu">${(Qp/1000).toFixed(2)}<span class="mb-unit">MN</span></div></div>
  <div class="mbox"><div class="mb-lbl">Énergie effective</div>
    <div class="mb-val c-blu">${Eeff.toFixed(0)}<span class="mb-unit">kJ</span></div></div>
  <div class="mbox"><div class="mb-lbl">Coups / 10 cm</div>
    <div class="mb-val ${cc(bl,okB,warnB)}">${bl>=999?'>150':bl}</div></div>
  <div class="mbox"><div class="mb-lbl">Pénétration / coup</div>
    <div class="mb-val c-blu">${(s*1000).toFixed(1)}<span class="mb-unit">mm</span></div></div>
  <div class="mbox"><div class="mb-lbl">Contrainte max σ</div>
    <div class="mb-val ${okS?'c-ok':'c-bad'}">${sigMPa.toFixed(1)}<span class="mb-unit">MPa</span></div></div>
  <div class="mbox"><div class="mb-lbl">Limite 0.9 fy</div>
    <div class="mb-val c-blu">${(0.9*fy).toFixed(0)}<span class="mb-unit">MPa</span></div></div>
</div>
<div class="res-row">
  <div class="card">
    <div class="card-ttl">Détail par couche</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>#</th><th>Nature</th><th>De</th><th>À</th><th>ép.(m)</th><th>fs(kPa)</th><th>A_lat(m²)</th><th>Qs(kN)</th><th>Statut</th></tr></thead>
      <tbody id="rtb"></tbody>
    </table></div>
  </div>
  <div class="card">
    <div class="card-ttl">Distribution de la résistance</div>
    <div class="chart-wrap"><canvas id="rc" role="img" aria-label="Distribution résistance par couche">Graphique</canvas></div>
  </div>
</div>`;

  // ── TABLE ROWS ──
  const tb = document.getElementById('rtb');
  LR.forEach((r, i) => {
    const s2  = SOILS[r.name] || SOILS['Autre'];
    const tr  = document.createElement('tr');
    tr.innerHTML = `
<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${s2.c};margin-right:5px;vertical-align:middle"></span>${i+1}</td>
<td>${r.name}</td>
<td>${isNaN(r.from)?'–':r.from.toFixed(2)}</td>
<td>${isNaN(r.to)?'–':r.to.toFixed(2)}</td>
<td>${r.th.toFixed(2)}</td>
<td>${r.fs||0}</td>
<td>${r.Al.toFixed(2)}</td>
<td style="font-weight:600">${Math.round(r.Qs)}</td>
<td>${r.act ? '<span class="badge b-ok">Active</span>' : '<span class="badge b-skip">Hors portée</span>'}</td>`;
    tb.appendChild(tr);
  });

  // Toe row
  const trp = document.createElement('tr');
  trp.style.borderTop = '2px solid #e2e6f0';
  trp.innerHTML = `
<td colspan="7" style="font-weight:600;color:#1e40af">Résistance en pointe</td>
<td style="font-weight:600">${Math.round(Qp)}</td>
<td><span class="badge b-ok">Pointe</span></td>`;
  tb.appendChild(trp);

  buildChart(LR, Qp);
  showTab(2);
}

/* ============================================================
   CHART
   ============================================================ */
function buildChart(LR, Qp) {
  const active = LR.filter(r => r.act && r.Qs > 0);
  const labels = active.map(r => r.name);
  const data   = active.map(r => Math.round(r.Qs));
  const colors = active.map(r => (SOILS[r.name] || SOILS['Autre']).c);
  if (Qp > 0) {
    labels.push('Résistance en pointe');
    data.push(Math.round(Qp));
    colors.push('#1e40af');
  }
  const cv = document.getElementById('rc');
  if (!cv) return;
  if (chart) { chart.destroy(); chart = null; }
  chart = new Chart(cv, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Résistance (kN)',
        data,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString('fr-FR')} kN` } },
      },
      scales: {
        x: { ticks: { color:'#6b7280', font:{size:10} }, grid: { color:'rgba(0,0,0,0.05)' } },
        y: {
          ticks: { color:'#6b7280', font:{size:10}, callback: v => v.toLocaleString('fr-FR')+' kN' },
          grid:  { color:'rgba(0,0,0,0.05)' },
          title: { display:true, text:'Résistance (kN)', color:'#6b7280', font:{size:10} },
        },
      },
    },
  });
}

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  preset('vide', document.getElementById('vide-btn'));
  drawPV();
  updEeff();
});
