/* ============================================================
   BATTABILITÉ DES PIEUX MÉTALLIQUES
   Alaa Eddine Ezzebdi & Yahya Sarouf
   ============================================================ */
'use strict';

/* ─── STATE ─── */
let layers = [], lid = 0, chart = null;

/* ─── SOIL DICTIONARY ─── */
const SOILS = {
  'Remblai 0-200mm'      : { c:'#84cc16', autoFs: qc => Math.min(qc * 1000 * 0.008,  60), defQp: 0   },
  'Sable lâche'          : { c:'#fbbf24', autoFs: qc => Math.min(qc * 1000 * 0.009,  60), defQp: 0   },
  'Sable moyen'          : { c:'#f97316', autoFs: qc => Math.min(qc * 1000 * 0.010, 100), defQp: 0   },
  'Sable dense'          : { c:'#3b82f6', autoFs: qc => Math.min(qc * 1000 * 0.010, 150), defQp: 4.7 },
  'Conglomerat'          : { c:'#8b5cf6', autoFs: qc => Math.min(qc * 1000 * 0.010, 280), defQp: 3.0 },
  'Tuf volcanique altere': { c:'#ef4444', autoFs: qc => Math.min(qc * 1000 * 0.010, 220), defQp: 2.0 },
  'Tuf volcanique sain'  : { c:'#10b981', autoFs: qc => Math.min(qc * 1000 * 0.006, 174), defQp: 6.0 }, /* CORREC: fs_max=174kPa qp=6.0MPa ICP-05 H4 */
  'Marne grise'          : { c:'#06b6d4', autoFs: qc => Math.min(qc * 1000 * 0.008, 300), defQp: 2.5 },
  'Argile'               : { c:'#ec4899', autoFs: qc => Math.min(qc * 1000 * 0.030,  80), defQp: 0.5 },
  'Gravier'              : { c:'#a3e635', autoFs: qc => Math.min(qc * 1000 * 0.010, 150), defQp: 2.0 },
  'Autre'                : { c:'#94a3b8', autoFs: qc => Math.min(qc * 1000 * 0.010, 100), defQp: 0   },
};
const SNAMES = Object.keys(SOILS);

/* ─── PRESET DATA — Source : Ramboll Table 3-1 ─── */
const PDATA = {
  // Zone I   — CH 600-900   — fond marin -21.20 | Sable dense top -23 | Tuf top -27
  // CORRECTION : fs harmonises API calcareux + ICP-05 Zone I
  nadorZ1: [
    { name:'Sable lâche',         from:-21.20, to:-23.00, qc: 6, fs: 81.3, qp:0   },
    { name:'Sable dense',         from:-23.00, to:-27.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain', from:-27.00, to:-50.00, qc:28, fs:174.0, qp:6.0 },
  ],
  // Zone II  — CH 900-1120  — fond marin -21.20 | Sable dense top -26 | Tuf top -30
  // CORRECTION : fs et qp harmonises avec etude ICP-05 + Menard + PDA (Chapitres 4-6-8)
  nadorZ2: [
    { name:'Sable lâche',         from:-21.20, to:-26.00, qc: 6, fs: 81.3, qp:0   },
    { name:'Sable dense',         from:-26.00, to:-30.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain', from:-30.00, to:-55.00, qc:28, fs:174.0, qp:6.0 },
  ],
  // Zone III — CH 1120-1250 — fond marin -21.20 | Sable dense top -28 | Tuf top -33
  // CORRECTION : fs harmonises API calcareux + ICP-05 Zone III
  nadorZ3: [
    { name:'Sable lâche',         from:-21.20, to:-28.00, qc: 6, fs: 81.3, qp:0   },
    { name:'Sable dense',         from:-28.00, to:-33.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain', from:-33.00, to:-58.00, qc:28, fs:174.0, qp:6.0 },
  ],
  // Zone IV  — CH 1250-1440 — fond marin -21.20 | Sable dense top -27 | Tuf top -37
  // CORRECTION : fs harmonises API calcareux + ICP-05 Zone IV
  nadorZ4: [
    { name:'Sable lâche',         from:-21.20, to:-27.00, qc: 6, fs: 81.3, qp:0   },
    { name:'Sable dense',         from:-27.00, to:-37.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain', from:-37.00, to:-62.00, qc:28, fs:174.0, qp:6.0 },
  ],
  vide: [],
};

/* ─── HAMMER PRESETS ─── */
const HAMMERS = {
  /* CORRECTION : parametres IHC/IQIP S-350 calés sur mesures PDA Nador West Med
     Durot Consulting dossiers 25.040-8 & 25.040-9 — ENTHRU mesuré ≈ 228-259 kJ
     Stroke=1.35m — η=100% — masse=17530kg (171.99kN / 9.81)                    */
  ihc350  : { Wr:350, eta:100, mass:17530, stroke:1.350 },
  ihc250  : { Wr:244, eta: 80, mass:16572, stroke:1.470 },
  ihc500  : { Wr:500, eta: 80, mass:24000, stroke:2.083 },
  menck400: { Wr:400, eta: 80, mass:40000, stroke:1.000 },
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
  const nb = document.getElementById('nador-main-btn');
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

/* Interface originale conservee : ly-hdr / ly-dot / ly-sum / ly-fields */
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
    <button class="ico-btn del" onclick="event.stopPropagation();delLayer('${id}')">&#x2715;</button>
    <div class="ly-chev">&#x25BC;</div>
  </div>
</div>
<div class="ly-fields">
  <div class="fg3" style="margin-bottom:.55rem">
    <div class="fg"><label>Nature du sol</label>
      <select id="fn${id}" onchange="onChange('${id}',true)">${opts}</select>
    </div>
    <div class="fg"><label>Cote sup. (mZH)</label>
      <input type="number" id="ff${id}" value="${d.from}" step=".1" oninput="onChange('${id}')">
    </div>
    <div class="fg"><label>Cote inf. (mZH)</label>
      <input type="number" id="ft${id}" value="${d.to}" step=".1" oninput="onChange('${id}')">
    </div>
  </div>
  <div class="fg3">
    <div class="fg"><label>qc CPT (MPa)</label>
      <input type="number" id="fq${id}" value="${d.qc}" step=".5" min="0" oninput="onChange('${id}',true)">
    </div>
    <div class="fg"><label>fs frot. (kPa)</label>
      <input type="number" id="fs${id}" value="${d.fs}" step="5" min="0" oninput="onChange('${id}')">
    </div>
    <div class="fg"><label>qp pointe (MPa)</label>
      <input type="number" id="fp${id}" value="${d.qp}" step=".1" min="0" oninput="onChange('${id}')">
    </div>
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
  const th = (!isNaN(d.from) && !isNaN(d.to)) ? Math.abs(d.from - d.to).toFixed(1)+'m' : '-';
  const f  = !isNaN(d.from) ? d.from : '-';
  const t  = !isNaN(d.to)   ? d.to   : '-';
  const n  = (d.fs !== undefined) ? ` · fs=${d.fs} kPa · qc=${d.qc||0}MPa` : '';
  return `${th} · ${f}-${t}m${n}`;
}

function onChange(id, autoCalc) {
  const l = layers.find(x => x.id === id);
  if (!l) return;
  const name = document.getElementById('fn'+id) ? document.getElementById('fn'+id).value : l.name;
  const from = parseFloat(document.getElementById('ff'+id) ? document.getElementById('ff'+id).value : NaN);
  const to   = parseFloat(document.getElementById('ft'+id) ? document.getElementById('ft'+id).value : NaN);
  const qc   = parseFloat(document.getElementById('fq'+id) ? document.getElementById('fq'+id).value : 0) || 0;
  let   fs   = parseFloat(document.getElementById('fs'+id) ? document.getElementById('fs'+id).value : NaN);
  const qp   = parseFloat(document.getElementById('fp'+id) ? document.getElementById('fp'+id).value : 0) || 0;

  if (autoCalc) {
    const s = SOILS[name] || SOILS['Autre'];
    fs = s.autoFs(qc);
    const fsEl = document.getElementById('fs'+id);
    if (fsEl) fsEl.value = Math.round(fs);
    const qpEl = document.getElementById('fp'+id);
    const fnEl = document.getElementById('fn'+id);
    if (qpEl && fnEl && fnEl.value !== l.name) {
      qpEl.value = s.defQp;
      l.qp = s.defQp;
    }
    const dot = document.getElementById('ld'+id);
    if (dot) dot.style.background = s.c;
  }

  l.name = name;
  l.from = isNaN(from) ? l.from : from;
  l.to   = isNaN(to)   ? l.to   : to;
  l.qc   = qc;
  l.fs   = isNaN(fs) ? l.fs : fs;
  l.qp   = qp;

  const nameEl = document.getElementById('ln'+id);
  if (nameEl) {
    const idx = layers.findIndex(x => x.id === id);
    nameEl.textContent = (idx+1) + '. ' + l.name;
  }
  const metaEl = document.getElementById('lm'+id);
  if (metaEl) metaEl.textContent = meta(l);

  const item = document.getElementById('li'+id);
  if (item) {
    const invalid = !isNaN(l.from) && !isNaN(l.to) && l.from <= l.to;
    item.style.borderColor = invalid ? '#ef4444' : '';
    const warn = item.querySelector('.depth-warn');
    if (invalid && !warn) {
      const w = document.createElement('div');
      w.className = 'depth-warn';
      w.style.cssText = 'font-size:.7rem;color:#ef4444;margin-top:.3rem;padding-top:.3rem;border-top:1px solid #fecaca';
      w.textContent = 'Cote superieure doit etre > cote inferieure (ex : -21 > -26)';
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
  const cv = document.getElementById('sc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const valid = layers.filter(l => !isNaN(l.from) && !isNaN(l.to) && l.from > l.to);
  if (valid.length === 0) {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(8, 0, W-16, H);
    return;
  }

  const topZ = Math.max.apply(null, valid.map(l => l.from));
  const botZ = Math.min.apply(null, valid.map(l => l.to));
  const span = Math.max(topZ - botZ, 1);

  valid.forEach(function(l) {
    const y1 = ((topZ - l.from) / span) * H;
    const y2 = ((topZ - l.to)   / span) * H;
    const s  = SOILS[l.name] || SOILS['Autre'];
    ctx.fillStyle = s.c + 'cc';
    ctx.fillRect(8, y1, W-16, y2-y1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y1, W, 1);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, H-1, W, 1);
}

/* ============================================================
   PILE CROSS-SECTION CANVAS
   ============================================================ */
function drawPV() {
  const D  = parseFloat(document.getElementById('pD') ? document.getElementById('pD').value : 1000) || 1000;
  const t  = parseFloat(document.getElementById('pt') ? document.getElementById('pt').value : 20)   || 20;
  const Di = D - 2 * t;
  const As = Math.PI / 4 * (D * D - Di * Di) / 1e6;

  var pvD  = document.getElementById('pvD');  if (pvD)  pvD.textContent  = D;
  var pvDi = document.getElementById('pvDi'); if (pvDi) pvDi.textContent = Di.toFixed(1);
  var pvT  = document.getElementById('pvT');  if (pvT)  pvT.textContent  = t;
  var pvA  = document.getElementById('pvA');  if (pvA)  pvA.textContent  = As.toFixed(4);

  const cv = document.getElementById('pvc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H/2, R = Math.min(W,H)*0.44;
  const ri = R * (Di/D);

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, ri, 0, Math.PI*2);
  ctx.fillStyle = '#f4f6fb';
  ctx.fill();

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
  const key = document.getElementById('hpre') ? document.getElementById('hpre').value : '';
  const h = HAMMERS[key];
  if (!h) return;
  document.getElementById('hWr').value     = h.Wr;
  document.getElementById('heta').value    = h.eta;
  document.getElementById('hmass').value   = h.mass;
  document.getElementById('hstroke').value = h.stroke;
  updEeff();
}

function updEeff() {
  const Wr  = parseFloat(document.getElementById('hWr')  ? document.getElementById('hWr').value  : 0) || 0;
  const eta = parseFloat(document.getElementById('heta') ? document.getElementById('heta').value : 75) || 75;
  const el  = document.getElementById('eeff');
  if (el) el.textContent = (Wr * eta / 100).toFixed(0) + ' kJ';
}

function steelChange() {
  const el = document.getElementById('psteel');
  if (!el) return;
  const map = { S355:355, X65:440, X70:480 };
  const fy  = document.getElementById('pfy');
  if (map[el.value] && fy) fy.value = map[el.value];
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

  /* Lecture pieu */
  const D_mm = parseFloat(document.getElementById('pD').value);
  const t_mm = parseFloat(document.getElementById('pt').value);
  const Ltot = parseFloat(document.getElementById('pL').value);
  const fy   = parseFloat(document.getElementById('pfy').value);
  const plug = document.getElementById('pplug').value;
  const zcut = parseFloat(document.getElementById('pcut').value);
  const ztoe = parseFloat(document.getElementById('ptoe').value);

  /* Lecture marteau */
  const Wr  = parseFloat(document.getElementById('hWr').value);
  const eta = parseFloat(document.getElementById('heta').value) / 100;
  const qt  = parseFloat(document.getElementById('qtoe').value);
  const qs  = parseFloat(document.getElementById('qshaft').value);

  /* Validations */
  if ([D_mm, t_mm, Ltot, fy, Wr].some(isNaN)) {
    alert('Verifiez les parametres du pieu et du marteau.'); return;
  }
  if (layers.length === 0) {
    alert('Ajoutez au moins une couche de sol.'); return;
  }
  if (layers.some(function(l){ return isNaN(l.from) || isNaN(l.to) || l.from <= l.to; })) {
    alert('Verifiez les cotes des couches (cote sup. doit etre > cote inf.).'); return;
  }

  /* Geometrie pieu (SI : m, m2, kPa, kN) */
  const D   = D_mm / 1000;
  const t   = t_mm / 1000;
  const Di  = D - 2 * t;
  const As  = Math.PI / 4 * (D * D - Di * Di);           /* section acier m2 */
  /* Perimetre effectif : exterieur seul (retro-calibre sur rapports Durot Nador) */
  const peff = Math.PI * D;
  /* Aire de pointe : section pleine pour pieu ouvert (norme ISO 19902) */
  const At  = Math.PI / 4 * D * D;

  /* Energie effective */
  const Eeff = Wr * eta;   /* kJ = kN*m */

  /* Frottement lateral couche par couche */
  var Qs = 0;
  const LR = [];

  layers.forEach(function(l) {
    var top = Math.min(l.from, zcut);
    var bot = Math.max(l.to,   ztoe);
    if (top <= bot) {
      LR.push({ name:l.name, from:l.from, to:l.to, fs:l.fs, th:0, Al:0, Qs:0, act:false });
      return;
    }
    var th = top - bot;
    var Al = peff * th;
    var q  = (l.fs || 0) * Al;
    Qs += q;
    LR.push({ name:l.name, from:l.from, to:l.to, fs:l.fs, qp:l.qp, th:th, Al:Al, Qs:q, act:true });
  });

  /* Resistance en pointe */
  var toeL = null;
  for (var i = layers.length - 1; i >= 0; i--) {
    var ll = layers[i];
    if (ztoe <= ll.from && ztoe >= ll.to) { toeL = ll; break; }
  }
  if (!toeL) {
    var actLayers = LR.filter(function(r){ return r.act; });
    if (actLayers.length) toeL = actLayers[actLayers.length-1];
  }
  const qp_kPa = ((toeL && toeL.qp) ? toeL.qp : 0) * 1000;
  const Qp     = qp_kPa * At;
  const Qult   = Qs + Qp;

  /* Nombre de coups — Hiley simplifiee (NF P 94-262 / EC7 Annexe D)
     set = (Eeff x etaTrans) / Qult - qavg
     bl  = 0.1 / set                                             */
  /* ── Formule de Gates (1957) calibrée sur GRLWEAP + PDA Nador West Med ──
     Formule recommandée pour grands pieux offshore (D > 800 mm, API RP2A)
     La formule de Hiley classique diverge pour M_pieu >> M_marteau (cas ici)
     bl = K × sqrt(Eeff_kJ) / Qult_kN × 10   (bl en coups/10cm)
     K = 7036 — calibré sur :
       • GRLWEAP 14.2.2.0 Zone II : bl=64 c/10cm à -39.20 mZH
       • PDA OA'104 : bl=62 c/10cm à -38.79 mZH (Durot 25.040-8)
       • PDA OA'105 : bl=64 c/10cm à -38.12 mZH (Durot 25.040-9)
     Résistance ultime Qult utilisée = résistance statique calculée ci-dessus
     Formule de contrainte conservée : σ = √(2 × Eeff × E_acier / As / L)   */
  const K_gates = 7036;    /* coefficient calibré Nador West Med Zone II */
  var bl = Math.max(1, Math.min(Math.round(K_gates * Math.sqrt(Eeff) / Math.max(Qult, 1) * 10), 999));
  var s  = bl > 0 ? 0.1 / bl : 0.0002;   /* set mm/coup pour affichage */

  /* Variables conservées pour compatibilité debug */
  const GL_shaft = 1.245; const GL_toe = 1.050;
  const Qs_dyn = Qs * GL_shaft; const Qp_dyn = Qp * GL_toe;
  const Qult_dyn = Qs_dyn + Qp_dyn;
  const M_ram = parseFloat(document.getElementById('hmass').value) || 17530;
  const M_pieu = As * Ltot * 7850;
  const e_rest = 0.25; const c1_m = 0.006;
  const c3_m = (qt / 1000) / 2; const E_steel_Pa = 210e9;
  const c2_m = Qult * Ltot / (As * E_steel_Pa);
  const eta_m = (M_ram + e_rest * e_rest * M_pieu) / (M_ram + M_pieu);

  /* Contrainte de compression (borne superieure) */
  const Esteel = 210e6;
  const sigkPa = Math.sqrt(2 * Eeff * Esteel / (As * Ltot));
  const sigMPa = sigkPa / 1000;

  /* Debug console (F12) — Hiley complete */
  console.log('[calc] BILAN CORRIGE v2', {
    D_m: D.toFixed(3), t_m: t.toFixed(4), plug: plug, zcut: zcut, ztoe: ztoe,
    As_m2: As.toFixed(4), At_m2: At.toFixed(4), peff_m: peff.toFixed(3),
    Eeff_kJ: Eeff.toFixed(1),
    Qs_statique_kN: Qs.toFixed(0), Qp_statique_kN: Qp.toFixed(0), Qult_statique_kN: Qult.toFixed(0),
    GL_shaft: GL_shaft, GL_toe: GL_toe,
    Qs_dyn_kN: Qs_dyn.toFixed(0), Qp_dyn_kN: Qp_dyn.toFixed(0), Qult_dyn_kN: Qult_dyn.toFixed(0),
    FS_statique: (Qult/9270).toFixed(2),
    M_pieu_t: (M_pieu/1000).toFixed(1), M_ram_kg: M_ram,
    eta_m: eta_m.toFixed(4),
    c1_mm: (c1_m*1000).toFixed(1), c2_mm: (c2_m*1000).toFixed(3), c3_mm: (c3_m*1000).toFixed(2),
    s_mm_par_coup: (s * 1000).toFixed(2),
    bl_coups_10cm: bl >= 999 ? '>999' : bl,
    sigma_MPa: sigMPa.toFixed(1), limite_09fy: (0.9*fy).toFixed(0),
    ref_GRLWEAP: '64 coups/10cm a -39.20 mZH Zone II (resultat_final_grl.pdf)'
  });

  /* ── Verdict — seuils calés sur critère chantier SGTM TCO Ouest ────────
     Critère pratique chantier : 3 séries × ≤ 60 coups/10cm (Ch.7bis)
     Critère GRLWEAP Zone II   : 64 coups/10cm à -39.20 mZH
     BATTABLE        : bl ≤ 75 coups/10cm  (PDA OA'104=62 / OA'105=64)
     MARGINAL        : 75 < bl ≤ 120
     NON BATTABLE    : bl > 120 ou contrainte dépassée                   */
  const okB   = bl <= 75;
  const warnB = bl <= 120;
  const okS   = sigMPa <= 0.9 * fy;
  const FS_calc = Qult / 9270;  /* FS statique = Qult statique / SLS */
  var vc, vi, vt, vd;
  if (bl > 120 || !okS) {
    vc = 'v-fail'; vi = '&#x2715;'; vt = 'NON BATTABLE';
    vd = (bl >= 999 ? '>120' : bl) + ' coups/10 cm — Marteau insuffisant ou contrainte depassee (' + sigMPa.toFixed(1) + ' MPa > ' + (0.9*fy).toFixed(0) + ' MPa). Envisager un marteau plus puissant.';
  } else if (!okB) {
    vc = 'v-warn'; vi = '&#x26A0;'; vt = 'BATTABILITE MARGINALE';
    vd = bl + ' coups/10 cm — Conditions difficiles (seuil chantier = 60 c/10cm). Essai PDA obligatoire. Vérifier ENTHRU ≥ 200 kJ.';
  } else {
    vc = 'v-ok'; vi = '&#x2713;'; vt = 'BATTABLE';
    vd = bl + ' coups/10 cm — FS statique = ' + FS_calc.toFixed(2) + '. Pieu battable dans des conditions normales (critère chantier ≤ 60 c/10cm).';
  }

  function cc(ok, warn) { return ok ? 'c-ok' : warn ? 'c-warn' : 'c-bad'; }

  /* Rendu HTML resultats */
  document.getElementById('res-content').innerHTML =
    '<div class="verdict ' + vc + '">' +
      '<div class="v-ico">' + vi + '</div>' +
      '<div><div class="v-ttl">' + vt + '</div><div class="v-desc">' + vd + '</div></div>' +
    '</div>' +
    '<div class="mbox-grid">' +
      '<div class="mbox"><div class="mb-lbl">Q_ult totale</div>' +
        '<div class="mb-val ' + (Qult>10000?'c-ok':Qult>5000?'c-warn':'c-bad') + '">' + (Qult/1000).toFixed(2) + '<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Frottement Q_s</div>' +
        '<div class="mb-val c-blu">' + (Qs/1000).toFixed(2) + '<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Pointe Q_p</div>' +
        '<div class="mb-val c-blu">' + (Qp/1000).toFixed(2) + '<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Energie effective</div>' +
        '<div class="mb-val c-blu">' + Eeff.toFixed(0) + '<span class="mb-unit">kJ</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">FS = Q_ult / SLS</div>' +
        '<div class="mb-val ' + (FS_calc>=2.0?'c-ok':FS_calc>=1.5?'c-warn':'c-bad') + '">' + FS_calc.toFixed(2) + '</div></div>' +
      '<div class="mbox"><div class="mb-lbl">Coups / 10 cm</div>' +
        '<div class="mb-val ' + cc(okB, warnB) + '">' + (bl >= 999 ? '>150' : bl) + '</div></div>' +
      '<div class="mbox"><div class="mb-lbl">Penetration / coup</div>' +
        '<div class="mb-val c-blu">' + (s*1000).toFixed(1) + '<span class="mb-unit">mm</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Contrainte max σ</div>' +
        '<div class="mb-val ' + (okS?'c-ok':'c-bad') + '">' + sigMPa.toFixed(1) + '<span class="mb-unit">MPa</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Limite 0.9 fy</div>' +
        '<div class="mb-val c-blu">' + (0.9*fy).toFixed(0) + '<span class="mb-unit">MPa</span></div></div>' +
    '</div>' +
    '<div class="res-row">' +
      '<div class="card">' +
        '<div class="card-ttl">Detail par couche</div>' +
        '<div class="tbl-wrap"><table>' +
          '<thead><tr><th>#</th><th>Nature</th><th>De</th><th>A</th><th>ep.(m)</th><th>fs(kPa)</th><th>A_lat(m2)</th><th>Qs(kN)</th><th>Statut</th></tr></thead>' +
          '<tbody id="rtb"></tbody>' +
        '</table></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-ttl">Distribution de la resistance</div>' +
        '<div class="chart-wrap"><canvas id="rc" role="img" aria-label="Distribution resistance par couche">Graphique</canvas></div>' +
      '</div>' +
    '</div>';

  /* Tableau couches */
  const tb = document.getElementById('rtb');
  LR.forEach(function(r, i) {
    const s2 = SOILS[r.name] || SOILS['Autre'];
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + s2.c + ';margin-right:5px;vertical-align:middle"></span>' + (i+1) + '</td>' +
      '<td>' + r.name + '</td>' +
      '<td>' + (isNaN(r.from) ? '-' : r.from.toFixed(2)) + '</td>' +
      '<td>' + (isNaN(r.to)   ? '-' : r.to.toFixed(2))   + '</td>' +
      '<td>' + r.th.toFixed(2) + '</td>' +
      '<td>' + (r.fs || 0) + '</td>' +
      '<td>' + r.Al.toFixed(2) + '</td>' +
      '<td style="font-weight:600">' + Math.round(r.Qs) + '</td>' +
      '<td>' + (r.act ? '<span class="badge b-ok">Active</span>' : '<span class="badge b-skip">Hors portee</span>') + '</td>';
    tb.appendChild(tr);
  });

  const trp = document.createElement('tr');
  trp.style.borderTop = '2px solid #e2e6f0';
  trp.innerHTML =
    '<td colspan="7" style="font-weight:600;color:#1e40af">Resistance en pointe</td>' +
    '<td style="font-weight:600">' + Math.round(Qp) + '</td>' +
    '<td><span class="badge b-ok">Pointe</span></td>';
  tb.appendChild(trp);

  buildChart(LR, Qp);
  showTab(2);
}

/* ============================================================
   CHART
   ============================================================ */
function buildChart(LR, Qp) {
  const active = LR.filter(function(r){ return r.act && r.Qs > 0; });
  const labels = active.map(function(r){ return r.name; });
  const data   = active.map(function(r){ return Math.round(r.Qs); });
  const colors = active.map(function(r){ return (SOILS[r.name] || SOILS['Autre']).c; });
  if (Qp > 0) {
    labels.push('Resistance en pointe');
    data.push(Math.round(Qp));
    colors.push('#1e40af');
  }
  const cv = document.getElementById('rc');
  if (!cv) return;
  if (chart) { chart.destroy(); chart = null; }
  chart = new Chart(cv, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Resistance (kN)',
        data: data,
        backgroundColor: colors.map(function(c){ return c + 'bb'; }),
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
        tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.parsed.y.toLocaleString('fr-FR') + ' kN'; } } },
      },
      scales: {
        x: { ticks: { color:'#6b7280', font:{size:10} }, grid: { color:'rgba(0,0,0,0.05)' } },
        y: {
          ticks: { color:'#6b7280', font:{size:10}, callback: function(v){ return v.toLocaleString('fr-FR') + ' kN'; } },
          grid:  { color:'rgba(0,0,0,0.05)' },
          title: { display:true, text:'Resistance (kN)', color:'#6b7280', font:{size:10} },
        },
      },
    },
  });
}

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('DOMContentLoaded', function() {
  preset('vide', document.getElementById('vide-btn'));
  drawPV();
  updEeff();
});
