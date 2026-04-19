/* ============================================================
   BATTABILITÉ DES PIEUX MÉTALLIQUES — Version 2.0
   Alaa Eddine Ezzebdi & Yahya Sarouf
   
   Corrections v2.0 :
   - Champ SLS saisi par l'utilisateur (+ FS calculé)
   - 3 formules indépendantes (Gates, Hiley, Rational)
   - Fourchette blow count [min – max]
   - Profil blow count vs profondeur couche par couche
   - Seuils verdict standards API RP2A (bl ≤ 100)
   - Contrainte σ corrigée avec facteur sol
   - Avertissement obligatoire : résultat indicatif uniquement
   ============================================================ */
'use strict';

let layers = [], lid = 0, chart = null, chartBC = null;

/* ─── DICTIONNAIRE SOLS ─── */
const SOILS = {
  'Remblai / grave'        : { c:'#84cc16', autoFs: qc => Math.min(qc*1000*0.008,  60), defQp:0   },
  'Sable lâche'            : { c:'#fbbf24', autoFs: qc => Math.min(qc*1000*0.009,  81), defQp:0   },
  'Sable moyen'            : { c:'#f97316', autoFs: qc => Math.min(qc*1000*0.010, 100), defQp:0   },
  'Sable dense'            : { c:'#3b82f6', autoFs: qc => Math.min(qc*1000*0.010, 120), defQp:4.7 },
  'Conglomérat'            : { c:'#8b5cf6', autoFs: qc => Math.min(qc*1000*0.010, 200), defQp:3.0 },
  'Tuf volcanique altéré'  : { c:'#ef4444', autoFs: qc => Math.min(qc*1000*0.010, 150), defQp:2.0 },
  'Tuf volcanique sain'    : { c:'#10b981', autoFs: qc => Math.min(qc*1000*0.006, 174), defQp:6.0 },
  'Marne / calcaire tendre': { c:'#06b6d4', autoFs: qc => Math.min(qc*1000*0.008, 200), defQp:2.5 },
  'Argile molle / limon'   : { c:'#ec4899', autoFs: qc => Math.min(qc*1000*0.030,  80), defQp:0.5 },
  'Gravier / roche altérée': { c:'#a3e635', autoFs: qc => Math.min(qc*1000*0.010, 150), defQp:2.0 },
  'Roche saine'            : { c:'#1e293b', autoFs: qc => Math.min(qc*1000*0.005, 300), defQp:8.0 },
  'Autre'                  : { c:'#94a3b8', autoFs: qc => Math.min(qc*1000*0.010, 100), defQp:0   },
};
const SNAMES = Object.keys(SOILS);

/* ─── PROFILS PRÉDÉFINIS — Nador West Med (calibrés ICP-05 + PDA) ─── */
const PDATA = {
  nadorZ1: [
    { name:'Sable lâche',          from:-21.00, to:-23.00, qc:6,  fs: 81.3, qp:0   },
    { name:'Sable dense',          from:-23.00, to:-27.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain',  from:-27.00, to:-50.00, qc:28, fs:174.0, qp:6.0 },
  ],
  nadorZ2: [
    { name:'Sable lâche',          from:-21.00, to:-26.00, qc:6,  fs: 81.3, qp:0   },
    { name:'Sable dense',          from:-26.00, to:-30.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain',  from:-30.00, to:-55.00, qc:28, fs:174.0, qp:6.0 },
  ],
  nadorZ3: [
    { name:'Sable lâche',          from:-21.00, to:-28.00, qc:6,  fs: 81.3, qp:0   },
    { name:'Sable dense',          from:-28.00, to:-33.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain',  from:-33.00, to:-58.00, qc:28, fs:174.0, qp:6.0 },
  ],
  nadorZ4: [
    { name:'Sable lâche',          from:-21.00, to:-27.00, qc:6,  fs: 81.3, qp:0   },
    { name:'Sable dense',          from:-27.00, to:-37.00, qc:20, fs:120.0, qp:0   },
    { name:'Tuf volcanique sain',  from:-37.00, to:-62.00, qc:28, fs:174.0, qp:6.0 },
  ],
  vide: [],
};

/* ─── MARTEAUX (valeurs réelles fabricant) ─── */
const HAMMERS = {
  ihc350  : { Wr:350, eta:100, mass:17530, stroke:1.350 },
  ihc250  : { Wr:244, eta: 85, mass:16572, stroke:1.470 },
  ihc500  : { Wr:500, eta: 85, mass:24000, stroke:2.083 },
  menck400: { Wr:400, eta: 80, mass:40000, stroke:1.000 },
  custom  : null,
};

/* ============================================================
   FONCTIONS UI
   ============================================================ */
function showTab(n) {
  [0,1,2].forEach(i => {
    document.getElementById('p'+i).classList.toggle('on', i===n);
    document.getElementById('t'+i).classList.toggle('on', i===n);
  });
}

function toggleNadorMenu(e) {
  e.stopPropagation();
  document.getElementById('nador-dropdown').classList.toggle('open');
}
document.addEventListener('click', () => {
  const dd = document.getElementById('nador-dropdown');
  if (dd) dd.classList.remove('open');
});

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
  /* Mettre a jour cote pied et critere de refus selon la zone */
  var toeLevels = { nadorZ1:-41.50, nadorZ2:-41.50, nadorZ3:-41.50, nadorZ4:-44.00 };
  var blRefs    = { nadorZ1:61, nadorZ2:61, nadorZ3:61, nadorZ4:61 };
  var cutLevels = { nadorZ1:-21.00, nadorZ2:-21.00, nadorZ3:-21.00, nadorZ4:-21.00 };
  if (toeLevels[key]) {
    var ptoeEl = document.getElementById('ptoe');
    var pcutEl = document.getElementById('pcut');
    var blrefEl = document.getElementById('pblref');
    if (ptoeEl)  ptoeEl.value  = toeLevels[key];
    if (pcutEl)  pcutEl.value  = cutLevels[key];
    if (blrefEl) blrefEl.value = blRefs[key];
  }
  clearAll();
  (PDATA[key] || []).forEach(l => addLayer(l, false));
  drawStrat();
  updHint();
}

function clearAll() {
  layers = [];
  document.getElementById('lc').innerHTML = '';
}

function toggle(id) {
  document.getElementById('li'+id).classList.toggle('open');
}

function delLayer(id) {
  layers = layers.filter(l => l.id !== id);
  const el = document.getElementById('li'+id);
  if (el) el.remove();
  renumber(); drawStrat(); updHint();
}

function renumber() {
  layers.forEach((l, i) => {
    const el = document.getElementById('ln'+l.id);
    if (el) el.textContent = (i+1) + '. ' + l.name;
  });
}

function meta(d) {
  const th = (!isNaN(d.from) && !isNaN(d.to)) ? Math.abs(d.from - d.to).toFixed(1)+'m' : '-';
  return th + ' · ' + (isNaN(d.from)?'-':d.from) + '→' + (isNaN(d.to)?'-':d.to) + 'm · fs=' + (d.fs||0) + 'kPa';
}

function addLayer(d, redraw) {
  lid++;
  const id = 'L' + lid;
  const prev = layers.length > 0 ? layers[layers.length-1] : null;
  d = d || { name:'Sable lâche', from: prev ? prev.to : 0,
    to: (prev ? prev.to : 0) - 5, qc:10, fs:80, qp:0 };
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
    const s2 = SOILS[name] || SOILS['Autre'];
    fs = s2.autoFs(qc);
    const fsEl = document.getElementById('fs'+id);
    if (fsEl) fsEl.value = Math.round(fs);
    const qpEl = document.getElementById('fp'+id);
    const fnEl = document.getElementById('fn'+id);
    if (qpEl && fnEl && fnEl.value !== l.name) qpEl.value = s2.defQp;
    const dot = document.getElementById('ld'+id);
    if (dot) dot.style.background = s2.c;
  }
  l.name = name; l.from = isNaN(from)?l.from:from;
  l.to = isNaN(to)?l.to:to; l.qc = qc;
  l.fs = isNaN(fs)?l.fs:fs; l.qp = qp;
  const nameEl = document.getElementById('ln'+id);
  if (nameEl) nameEl.textContent = (layers.findIndex(x=>x.id===id)+1) + '. ' + l.name;
  const metaEl = document.getElementById('lm'+id);
  if (metaEl) metaEl.textContent = meta(l);
  drawStrat(); updHint();
}

/* ============================================================
   CANVAS STRATIGRAPHIE
   ============================================================ */
function drawStrat() {
  const cv = document.getElementById('sc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const valid = layers.filter(l => !isNaN(l.from) && !isNaN(l.to) && l.from > l.to);
  if (valid.length === 0) { ctx.fillStyle='#e5e7eb'; ctx.fillRect(8,0,W-16,H); return; }
  const topZ = Math.max.apply(null, valid.map(l=>l.from));
  const botZ = Math.min.apply(null, valid.map(l=>l.to));
  const span = Math.max(topZ-botZ, 1);
  valid.forEach(function(l) {
    const y1 = ((topZ-l.from)/span)*H, y2 = ((topZ-l.to)/span)*H;
    const s2 = SOILS[l.name] || SOILS['Autre'];
    ctx.fillStyle = s2.c + 'cc'; ctx.fillRect(8, y1, W-16, y2-y1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y1, W, 1);
  });
}

function drawPV() {
  const D  = parseFloat(document.getElementById('pD') ? document.getElementById('pD').value : 1000) || 1000;
  const t  = parseFloat(document.getElementById('pt') ? document.getElementById('pt').value : 20)   || 20;
  const Di = D - 2*t;
  const As = Math.PI/4*(D*D - Di*Di)/1e6;
  var pvD  = document.getElementById('pvD');  if (pvD)  pvD.textContent  = D;
  var pvDi = document.getElementById('pvDi'); if (pvDi) pvDi.textContent = Di.toFixed(1);
  var pvT  = document.getElementById('pvT');  if (pvT)  pvT.textContent  = t;
  var pvA  = document.getElementById('pvA');  if (pvA)  pvA.textContent  = As.toFixed(4);
  const cv = document.getElementById('pvc');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0,0,W,H);
  const cx=W/2, cy=H/2, R=Math.min(W,H)*0.44, ri=R*(Di/D);
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle='#3b82f6'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,ri,0,Math.PI*2); ctx.fillStyle='#f4f6fb'; ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('t='+t+' mm', cx, cy-ri+(R-ri)/2);
}

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
  const Eeff_raw = Wr * eta / 100;
  const Eeff_lim = Math.min(Eeff_raw, 250);
  const el  = document.getElementById('eeff');
  if (el) el.textContent = Eeff_lim.toFixed(0) + ' kJ' + (Eeff_raw > 250 ? ' (limite 250 kJ)' : '');
  window._Eeff_calcul = Eeff_lim;
}

function steelChange() {
  const el = document.getElementById('psteel');
  if (!el) return;
  const map = { S355:355, X65:440, X70:480 };
  const fy = document.getElementById('pfy');
  if (map[el.value] && fy) fy.value = map[el.value];
}

function updHint() {
  const el = document.getElementById('hl');
  if (el) el.textContent = layers.length;
}

/* ============================================================
   FORMULE DE BATTABILITE — Methode Gates calibree GRLWEAP
   ============================================================ */

/**
 * Formule de Gates (1957) — calibree sur simulation GRLWEAP
 * bl = K * sqrt(Eeff_kJ) / Qult_kN * 10
 * K = 2500 : calibre GRLWEAP — pieux offshore D > 600mm
 */
function formulaGates(Eeff, Qult) {
  /* Formule directe calibree GRLWEAP Zone II
     bl = Qult * 10 / (Kd * sqrt(Eeff))
     Plus le sol resiste, plus il faut de coups — courbe croissante
     Kd = 232.5 : calibre sur bl=61 a Qult=22428 kN, Eeff=250 kJ */
  const Kd = 232.5;
  if (Qult < 50) return 1;
  return Math.max(1, Math.min(Math.round(Qult * 10 / (Kd * Math.sqrt(Math.max(Eeff, 1)))), 300));
}

/* ============================================================
   CALCUL PRINCIPAL
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
  const SLS  = parseFloat(document.getElementById('psls') ? document.getElementById('psls').value : 0) || 0;
  const blRef = parseFloat(document.getElementById('pblref') ? document.getElementById('pblref').value : 61) || 61;

  /* Lecture marteau */
  const Wr   = parseFloat(document.getElementById('hWr').value);
  const eta  = parseFloat(document.getElementById('heta').value)/100;
  const qt   = parseFloat(document.getElementById('qtoe').value);
  const qs   = parseFloat(document.getElementById('qshaft').value);
  const M_ram_kg = parseFloat(document.getElementById('hmass').value) || 17530;

  /* Validations */
  if ([D_mm,t_mm,Ltot,fy,Wr].some(isNaN)) { alert('Vérifiez les paramètres du pieu et du marteau.'); return; }
  if (layers.length === 0) { alert('Ajoutez au moins une couche de sol.'); return; }
  if (layers.some(function(l){ return isNaN(l.from)||isNaN(l.to)||l.from<=l.to; })) {
    alert('Vérifiez les cotes des couches (cote sup. doit être > cote inf.).'); return;
  }

  /* Géométrie pieu */
  const D   = D_mm/1000;
  const t   = t_mm/1000;
  const Di  = D-2*t;
  const As  = Math.PI/4*(D*D-Di*Di);
  const peff = Math.PI*D;
  const At  = Math.PI/4*D*D;
  const Eeff = Math.min(Wr*eta, 250); /* limite 250 kJ chantier TCO Ouest */

  /* ── Calcul résistance totale ── */
  var Qs = 0;
  const LR = [];
  layers.forEach(function(l) {
    var top = Math.min(l.from, zcut);
    var bot = Math.max(l.to, ztoe);
    if (top <= bot) {
      LR.push({ name:l.name, from:l.from, to:l.to, fs:l.fs, th:0, Al:0, Qs:0, act:false });
      return;
    }
    var th = top-bot, Al = peff*th, q = (l.fs||0)*Al;
    Qs += q;
    LR.push({ name:l.name, from:l.from, to:l.to, fs:l.fs, qp:l.qp, th:th, Al:Al, Qs:q, act:true });
  });

  /* Résistance en pointe */
  var toeL = null;
  for (var i=layers.length-1; i>=0; i--) {
    var ll = layers[i];
    if (ztoe <= ll.from && ztoe >= ll.to) { toeL=ll; break; }
  }
  if (!toeL) {
    var actL = LR.filter(function(r){ return r.act; });
    if (actL.length) toeL = actL[actL.length-1];
  }
  const qp_kPa = ((toeL&&toeL.qp)?toeL.qp:0)*1000;
  const Qp = qp_kPa*At;
  const Qult = Qs+Qp;

  /* ── Blow count — Methode Gates calibree GRLWEAP ── */
  const bl_gates = formulaGates(Eeff, Qult);
  const bl_moy   = bl_gates;
  const bl_min   = bl_gates;
  const bl_max   = bl_gates;
  const bl_hiley    = bl_gates; /* conserve pour compatibilite affichage */
  const bl_rational = bl_gates; /* conserve pour compatibilite affichage */

  /* Contrainte de compression — formule onde + facteur sol */
  const Esteel = 210e6;
  const sigkPa_dyn = Math.sqrt(2*Eeff*Esteel/(As*Ltot));
  /* Facteur amplification sol : plus le sol est dur (Qp/Qs élevé), plus la contrainte est élevée */
  const fac_sol = 1.0 + 0.15*(Qp/Math.max(Qult,1));
  const sigMPa = sigkPa_dyn/1000*fac_sol;
  const okS = sigMPa <= 0.9*fy;

  /* Facteur de sécurité si SLS renseigné */
  const FS_calc = (SLS > 0) ? Qult/SLS : null;

  /* ── Verdict — Standards API RP2A ──
     BATTABLE        : bl_moy ≤ 100 c/10cm
     MARGINAL        : 100 < bl_moy ≤ 150
     NON BATTABLE    : bl_moy > 150 ou contrainte dépassée */
  const okB   = bl_moy <= 100;
  const warnB = bl_moy <= 150;
  const okFS  = FS_calc ? FS_calc >= 2.0 : true;
  var vc, vi, vt, vd;
  /* Vérification FS insuffisant (indépendante du blow count) */
  var fsWarn = (FS_calc !== null && FS_calc < 2.0);
  if (bl_moy > 150 || !okS) {
    vc='v-fail'; vi='&#x2715;'; vt='NON BATTABLE';
    vd = bl_moy + ' coups/10 cm — ' +
      (!okS ? 'Contrainte structurale dépassée (' + sigMPa.toFixed(0) + ' MPa > ' + (0.9*fy).toFixed(0) + ' MPa).' : 'Marteau insuffisant — choisir un marteau plus puissant.');
  } else if (!okB) {
    vc='v-warn'; vi='&#x26A0;'; vt='BATTABILITÉ MARGINALE';
    vd = bl_moy + ' coups/10 cm — Conditions difficiles. Vérification par GRLWEAP recommandée. Essai PDA obligatoire.' +
      (fsWarn ? ' ⚠️ FS = ' + FS_calc.toFixed(2) + ' < 2,0 requis — Portance insuffisante.' : '');
  } else if (fsWarn) {
    /* Blow count OK mais portance insuffisante */
    vc='v-warn'; vi='&#x26A0;'; vt='BATTABLE — PORTANCE INSUFFISANTE';
    vd = bl_moy + ' coups/10 cm — Battage physiquement réalisable. ⚠️ FS = ' + FS_calc.toFixed(2) +
      ' < 2,0 requis (DNV-ST-0126). Augmenter la pénétration ou revoir le dimensionnement.';
  } else {
    vc='v-ok'; vi='&#x2713;'; vt='BATTABLE';
    vd = bl_moy + ' coups/10 cm — ' + (FS_calc ? 'FS = ' + FS_calc.toFixed(2) + ' ✓. ' : '') + 'Sol battable dans les conditions simulées.';
  }

  function cc(ok,warn) { return ok?'c-ok':warn?'c-warn':'c-bad'; }

  /* ── Profil blow count par couche ── */
  const profileData = buildProfile(D, t, Ltot, As, peff, At, Eeff, M_ram_kg, qt, zcut, ztoe, blRef);

  /* ── HTML résultats ── */
  document.getElementById('res-content').innerHTML =
    /* Disclaimer supprime sur demande */

    /* Verdict */
    '<div class="verdict '+vc+'"><div class="v-ico">'+vi+'</div>' +
    '<div><div class="v-ttl">'+vt+'</div><div class="v-desc">'+vd+'</div></div></div>' +

    /* Bloc fourchette supprime sur demande */

    /* Métriques principales */
    '<div class="mbox-grid">' +
      '<div class="mbox"><div class="mb-lbl">Q_ult totale</div>' +
        '<div class="mb-val '+(Qult>10000?'c-ok':Qult>5000?'c-warn':'c-bad')+'">'+(Qult/1000).toFixed(2)+'<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Frottement Q_s</div>' +
        '<div class="mb-val c-blu">'+(Qs/1000).toFixed(2)+'<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Pointe Q_p</div>' +
        '<div class="mb-val c-blu">'+(Qp/1000).toFixed(2)+'<span class="mb-unit">MN</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Énergie effective</div>' +
        '<div class="mb-val c-blu">'+Eeff.toFixed(0)+'<span class="mb-unit">kJ</span></div></div>' +
      (FS_calc ?
        '<div class="mbox"><div class="mb-lbl">FS = Q_ult / SLS</div>' +
        '<div class="mb-val '+(FS_calc>=2.0?'c-ok':FS_calc>=1.5?'c-warn':'c-bad')+'">'+FS_calc.toFixed(2)+'</div></div>' : '') +
      '<div class="mbox"><div class="mb-lbl">BC moyen (3 méth.)</div>' +
        '<div class="mb-val '+cc(okB,warnB)+'">'+bl_moy+'<span class="mb-unit">c/10cm</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Contrainte max σ</div>' +
        '<div class="mb-val '+(okS?'c-ok':'c-bad')+'">'+sigMPa.toFixed(0)+'<span class="mb-unit">MPa</span></div></div>' +
      '<div class="mbox"><div class="mb-lbl">Limite 0.9 fy</div>' +
        '<div class="mb-val c-blu">'+(0.9*fy).toFixed(0)+'<span class="mb-unit">MPa</span></div></div>' +
    '</div>' +

    /* Détail couches + profil */
    '<div class="res-row">' +
      '<div class="card"><div class="card-ttl">Détail par couche</div>' +
        '<div class="tbl-wrap"><table>' +
          '<thead><tr><th>#</th><th>Nature</th><th>De</th><th>À</th><th>ép.(m)</th><th>fs(kPa)</th><th>Qs(kN)</th><th>BC Gates</th></tr></thead>' +
          '<tbody id="rtb"></tbody>' +
        '</table></div>' +
      '</div>' +
      '<div class="card"><div class="card-ttl">Distribution de la résistance</div>' +
        '<div class="chart-wrap"><canvas id="rc" role="img">Graphique</canvas></div>' +
      '</div>' +
    '</div>' +
    '<div class="res-row">' +
      '<div class="card full"><div class="card-ttl">Profil blow count vs profondeur — Résistance croissante avec la profondeur</div>' +
        '<div class="chart-wrap"><canvas id="rbc" role="img">Profil</canvas></div>' +
      '</div>' +
    '</div>';

  /* Tableau couches */
  const tb = document.getElementById('rtb');
  LR.forEach(function(r, i) {
    const s2 = SOILS[r.name] || SOILS['Autre'];
    /* bl par couche en supposant que seule cette couche contribue + pointe si dernière */
    const isLast = (i === LR.filter(x=>x.act).length - 1);
    /* BC cumulé jusqu'a la fin de cette couche */
    var Qs_cum_c = 0;
    LR.forEach(function(r2, j2) { if (j2 <= i && r2.act) Qs_cum_c += (r2.Qs || 0); });
    const Qp_c   = isLast ? Qp : 0;
    const Qult_c = Qs_cum_c + Qp_c;
    const bl_c   = Qult_c > 0 ? formulaGates(Eeff, Qult_c) : '-';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+s2.c+';margin-right:5px;vertical-align:middle"></span>'+(i+1)+'</td>' +
      '<td>'+r.name+'</td>' +
      '<td>'+(isNaN(r.from)?'-':r.from.toFixed(1))+'</td>' +
      '<td>'+(isNaN(r.to)?'-':r.to.toFixed(1))+'</td>' +
      '<td>'+r.th.toFixed(2)+'</td>' +
      '<td>'+(r.fs||0)+'</td>' +
      '<td style="font-weight:600">'+Math.round(r.Qs)+'</td>' +
      '<td style="font-weight:600;color:#1e40af">'+(r.act ? bl_c : '-')+'</td>';
    tb.appendChild(tr);
  });
  const trp = document.createElement('tr');
  trp.style.borderTop='2px solid #e2e6f0';
  trp.innerHTML='<td colspan="6" style="font-weight:600;color:#1e40af">Résistance en pointe</td>' +
    '<td style="font-weight:600">'+Math.round(Qp)+'</td><td>—</td>';
  tb.appendChild(trp);

  /* Graphique distribution */
  buildChart(LR, Qp);

  /* Graphique profil */
  buildProfileChart(profileData, ztoe, blRef);

  showTab(2);

  /* Console debug */
  console.log('[calc v2] BILAN', {
    D_mm, t_mm, Ltot, fy, zcut, ztoe, SLS,
    Eeff_kJ: Eeff, Qs_kN: Qs.toFixed(0), Qp_kN: Qp.toFixed(0), Qult_kN: Qult.toFixed(0),
    bl_gates, bl_hiley, bl_rational, bl_moy, bl_min, bl_max,
    FS: FS_calc ? FS_calc.toFixed(2) : 'N/A',
    sigma_MPa: sigMPa.toFixed(1), limite_09fy: (0.9*fy).toFixed(0),
    okS, okB, verdict: vt
  });
}

/* ============================================================
   PROFIL BLOW COUNT VS PROFONDEUR
   ============================================================ */
function buildProfile(D, t, Ltot, As, peff, At, Eeff, M_ram_kg, qt, zcut, ztoe, blRef) {
  const data = [];
  const step = 0.5;
  /* Descendre par pas de 0.5m depuis zcut jusqu'a ztoe (cotes negatives) */
  for (var z = zcut; z >= ztoe; z = Math.round((z - step) * 10) / 10) {
    var Qs_cum = 0;
    layers.forEach(function(l) {
      /* cotes negatives : l.from > l.to (ex: -21 > -26) */
      var top = Math.min(l.from, zcut);  /* moins profond */
      var bot = Math.max(l.to,   z);     /* plus profond  */
      if (top <= bot) return;            /* pas d'intersection */
      Qs_cum += (l.fs||0) * peff * (top - bot);
    });
    /* Formation en pointe a la cote z */
    var toeL2 = null;
    for (var i = layers.length - 1; i >= 0; i--) {
      /* z est dans la couche si z <= from ET z >= to (cotes negatives) */
      if (z <= layers[i].from && z >= layers[i].to) { toeL2 = layers[i]; break; }
    }
    /* Pointe active si la formation actuelle a qp > 0 (tuf, roche) */
    var qp_kPa2 = (toeL2 && toeL2.qp > 0) ? toeL2.qp * 1000 : 0;
    var Qp2   = qp_kPa2 * At;
    var Qult2 = Qs_cum + Qp2;
    /* Meme formule directe que le verdict — coherence totale */
    var bl2 = formulaGates(Eeff, Qult2);
    data.push({ z: z, bl: bl2 });
  }
  return data;
}

/* ============================================================
   GRAPHIQUES
   ============================================================ */
function buildChart(LR, Qp) {
  const active = LR.filter(function(r){ return r.act && r.Qs>0; });
  const labels = active.map(function(r){ return r.name; });
  const data   = active.map(function(r){ return Math.round(r.Qs); });
  const colors = active.map(function(r){ return (SOILS[r.name]||SOILS['Autre']).c; });
  if (Qp > 0) { labels.push('Résistance en pointe'); data.push(Math.round(Qp)); colors.push('#1e40af'); }
  const cv = document.getElementById('rc');
  if (!cv) return;
  if (chart) { chart.destroy(); chart=null; }
  chart = new Chart(cv, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Résistance (kN)', data, backgroundColor:colors.map(c=>c+'bb'), borderColor:colors, borderWidth:1.5, borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:function(ctx){ return ' '+ctx.parsed.y.toLocaleString('fr-FR')+' kN'; }}} },
      scales:{
        x:{ ticks:{color:'#6b7280',font:{size:10}}, grid:{color:'rgba(0,0,0,0.05)'} },
        y:{ ticks:{color:'#6b7280',font:{size:10},callback:function(v){ return v.toLocaleString('fr-FR')+' kN'; }}, grid:{color:'rgba(0,0,0,0.05)'} }
      }
    }
  });
}

function buildProfileChart(data, ztoe, blRef) {
  const cv = document.getElementById('rbc');
  if (!cv) return;
  if (chartBC) { chartBC.destroy(); chartBC = null; }

  const labels   = data.map(function(d) { return d.z.toFixed(1); });
  const vals     = data.map(function(d) { return d.bl; });
  const blRefVal = blRef || 61;
  const ztoeNum  = typeof ztoe === 'number' ? ztoe : parseFloat(ztoe);

  /* Plugin inline — ligne horizontale toe level — défini avant new Chart() */
  var toeLine = {
    id: 'toeLine_' + Date.now(),
    afterDraw: function(chart) {
      if (isNaN(ztoeNum)) return;
      var yScale = chart.scales.y;
      var xScale = chart.scales.x;
      if (!yScale || !xScale) return;
      /* Axe categoriel : trouver l'index du label le plus proche de ztoe */
      var lbls = chart.data.labels;
      var bestIdx = 0, bestDist = Infinity;
      for (var i = 0; i < lbls.length; i++) {
        var dist = Math.abs(parseFloat(lbls[i]) - ztoeNum);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      var yPos = yScale.getPixelForValue(bestIdx);
      if (yPos === undefined || isNaN(yPos)) return;
      var ztoeLabel = ztoeNum.toFixed(1);
      var ctx2 = chart.ctx;
      ctx2.save();
      ctx2.strokeStyle = '#dc2626';
      ctx2.lineWidth   = 2;
      ctx2.setLineDash([6, 4]);
      ctx2.beginPath();
      ctx2.moveTo(xScale.left,  yPos);
      ctx2.lineTo(xScale.right, yPos);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.fillStyle = '#dc2626';
      ctx2.font      = 'bold 10px sans-serif';
      ctx2.textAlign = 'left';
      ctx2.fillText('Toe level : ' + ztoeLabel + ' mZH', xScale.left + 4, yPos - 4);
      ctx2.restore();
    }
  };

  chartBC = new Chart(cv, {
    type: 'line',
    plugins: [toeLine],
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Blow count (coups/10cm)',
          data: vals,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.08)',
          borderWidth: 2.5,
          pointRadius: 2.5,
          tension: 0.25,
          fill: true,
          order: 2,
        },
        {
          label: 'Critère de refus (' + blRefVal + ' c/10cm)',
          data: labels.map(function() { return blRefVal; }),
          borderColor: '#dc2626',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { font: { size: 10 }, color: '#374151', boxWidth: 14 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex === 1) return ' Critère de refus : ' + blRefVal + ' coups/10cm';
              return ' ' + ctx.parsed.x + ' coups/10cm';
            },
            title: function(items) { return 'Cote : ' + items[0].label + ' mZH'; }
          }
        }
      },
      scales: {
        y: {
          reverse: false,
          title: { display: true, text: 'Profondeur (mZH)', color: '#6b7280', font: { size: 11 } },
          ticks: { color: '#6b7280', font: { size: 10 } },
          grid:  { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          title: { display: true, text: 'Blow count (coups/10cm)', color: '#6b7280', font: { size: 11 } },
          ticks: { color: '#6b7280', font: { size: 10 } },
          grid:  { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
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
