// ============================================================
// bilans.js — Bilans par secteur + bilan général de l'année
// ============================================================

var GROUPES_NIVEAU = [
  { id: "creche",     label: "Crèche",        sects: CRECHE_SECTS },
  { id: "garderie",   label: "Garderie midi", sects: ["garderie"] },
  { id: "maternelle", label: "Maternelle",    sects: MAT_SECTS },
  { id: "primaire",   label: "Primaire",      sects: PRIM_SECTS }
];

// Couleurs de graphiques validées (contraste + distinction daltonisme) —
// distinctes des couleurs de badges/texte pour rester lisibles en aplats.
var CHART_COLORS = {
  rose:     "#E5007D", // identité de l'école — Filles / tranches d'âge
  bleu:     "#2a78d6", // Garçons
  or:       "#D4AF37", // Non renseigné
  bon:      "#0ca30c", // Soldé
  alerte:   "#fab219", // Partiel
  critique: "#d03b3b"  // Impayé
};

var TRANCHES_AGE = [
  { label: "0-2 ans",  min: 0, max: 2 },
  { label: "3-4 ans",  min: 3, max: 4 },
  { label: "5-6 ans",  min: 5, max: 6 },
  { label: "7-8 ans",  min: 7, max: 8 },
  { label: "9-11 ans", min: 9, max: 11 }
];

// ============================================================
// ONGLET 5 — BILANS PAR SECTEUR
// ============================================================
function renderBilanParNiveau() {
  return GROUPES_NIVEAU.map(g => {
    const enfants = STATE.enfants.filter(e => g.sects.includes(e.sect));
    let du = 0, paye = 0, reste = 0;
    enfants.forEach(e => {
      const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
      du += tDu(postesEnfant);
      paye += tPaye(postesEnfant);
      reste += tReste(postesEnfant);
    });
    const taux = du > 0 ? Math.round((paye / du) * 100) : 0;
    return `
      <div class="card">
        <div class="card-title">${g.label} <span class="badge badge-navy">${enfants.length} élève${enfants.length > 1 ? "s" : ""}</span></div>
        <div class="poste-row"><div class="poste-label">Total dû</div><div class="poste-amounts">${fmtFCFA(du)}</div></div>
        <div class="poste-row"><div class="poste-label">Total payé</div><div class="poste-amounts">${fmtFCFA(paye)}</div></div>
        <div class="poste-row"><div class="poste-label">Reste à recouvrer</div><div class="poste-amounts"><strong>${fmtFCFA(reste)}</strong></div></div>
        <div class="poste-row"><div class="poste-label">Taux de recouvrement</div><div class="poste-amounts">${taux}%</div></div>
      </div>`;
  }).join("");
}

function renderBilanParCategorie() {
  const cats = {};
  STATE.postes.filter(p => !p.is_remise && p.key !== "avance").forEach(p => {
    if (!cats[p.cat]) cats[p.cat] = { du: 0, paye: 0 };
    cats[p.cat].du += p.du || 0;
    cats[p.cat].paye += p.paye || 0;
  });

  const rows = Object.keys(cats).sort().map(cat => {
    const c = cats[cat];
    const reste = Math.max(c.du - c.paye, 0);
    return `<tr><td>${escapeHtml(cat)}</td><td>${fmtFCFA(c.du)}</td><td>${fmtFCFA(c.paye)}</td><td><strong>${fmtFCFA(reste)}</strong></td></tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-title"><i class="bi bi-pie-chart-fill"></i> Répartition par catégorie financière</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Catégorie</th><th>Dû</th><th>Payé</th><th>Reste</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4" class="text-center text-muted">Aucune donnée pour le moment.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderBilans() {
  const root = document.getElementById("bilansSecteurs");
  if (!root) return;
  root.innerHTML = `${renderBilanParNiveau()}${renderBilanParCategorie()}`;
}

// ============================================================
// ONGLET 9 — BILAN GÉNÉRAL DE L'ANNÉE
// ============================================================
function renderBilanGeneral() {
  const root = document.getElementById("bilanGeneral");
  if (!root) return;

  const m = calculerMetriques();
  const totalSorties = STATE.sorties.reduce((s, x) => s + (Number(x.mt) || 0), 0);
  const soldeNet = m.totalEncaisse - totalSorties;

  const modeStats = {};
  STATE.entrees.forEach(e => { modeStats[e.mode] = (modeStats[e.mode] || 0) + (Number(e.mt) || 0); });

  const catSorties = {};
  STATE.sorties.forEach(s => { catSorties[s.cat] = (catSorties[s.cat] || 0) + (Number(s.mt) || 0); });

  root.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card metric-green"><div class="metric-label">Total encaissé</div><div class="metric-value">${fmtFCFA(m.totalEncaisse)}</div></div>
      <div class="metric-card metric-red"><div class="metric-label">Total dépensé</div><div class="metric-value">${fmtFCFA(totalSorties)}</div></div>
      <div class="metric-card ${soldeNet >= 0 ? "metric-lime" : "metric-red"}"><div class="metric-label">Solde net</div><div class="metric-value">${fmtFCFA(soldeNet)}</div></div>
      <div class="metric-card metric-gold"><div class="metric-label">Taux de recouvrement</div><div class="metric-value">${m.tauxRecouvrement}%</div></div>
    </div>

    <div class="charts-grid" id="bilanCharts"></div>

    <div class="card">
      <div class="card-title"><i class="bi bi-people-fill"></i> Effectifs de l'année 2026–2027</div>
      <div class="poste-row"><div class="poste-label">Total élèves inscrits</div><div class="poste-amounts">${STATE.enfants.length}</div></div>
      <div class="poste-row"><div class="poste-label">Total dû sur l'année</div><div class="poste-amounts">${fmtFCFA(m.totalDu)}</div></div>
      <div class="poste-row"><div class="poste-label">Reste à recouvrer</div><div class="poste-amounts"><strong>${fmtFCFA(m.totalReste)}</strong></div></div>
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-credit-card"></i> Encaissements par mode de paiement</div>
      ${Object.keys(modeStats).length === 0 ? '<p class="text-muted">Aucune donnée pour le moment.</p>' :
        Object.entries(modeStats).sort((a, b) => b[1] - a[1]).map(([mode, mt]) => `
          <div class="poste-row"><div class="poste-label">${escapeHtml(mode)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-wallet2"></i> Dépenses par catégorie</div>
      ${Object.keys(catSorties).length === 0 ? '<p class="text-muted">Aucune dépense enregistrée.</p>' :
        Object.entries(catSorties).sort((a, b) => b[1] - a[1]).map(([cat, mt]) => `
          <div class="poste-row"><div class="poste-label">${escapeHtml(cat)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
    </div>
  `;

  renderChartsBloc("bilanCharts");
}

// ============================================================
// GRAPHIQUES — répartition Filles/Garçons, tranches d'âge, statut
// de paiement. Visibles à la fois sur le Tableau de bord et sur le
// Bilan général (même bloc, appelé depuis les deux onglets).
// ============================================================

function calculerRepartitionSexe() {
  let f = 0, m = 0, nr = 0;
  STATE.enfants.forEach(e => {
    if (e.sexe === "F") f++;
    else if (e.sexe === "M") m++;
    else nr++;
  });
  return { f, m, nr };
}

function calculerRepartitionAges() {
  const tranches = TRANCHES_AGE.map(t => ({ label: t.label, min: t.min, max: t.max, count: 0 }));
  let nonRenseigne = 0;
  STATE.enfants.forEach(e => {
    const age = ageAns(e.ddn);
    if (age === null || age === undefined || isNaN(age)) { nonRenseigne++; return; }
    const bracket = tranches.find(t => age >= t.min && age <= t.max) || tranches[tranches.length - 1];
    bracket.count++;
  });
  return { tranches, nonRenseigne };
}

function calculerRepartitionStatuts() {
  let solde = 0, partiel = 0, impaye = 0;
  STATE.enfants.forEach(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const statut = statutPaiement(postesEnfant);
    if (statut === "solde") solde++;
    else if (statut === "partiel") partiel++;
    else impaye++;
  });
  return { solde, partiel, impaye };
}

// Diagramme circulaire (donut) en SVG pur — segments proportionnels tracés
// via stroke-dasharray, valeur totale au centre, légende avec pourcentages.
function construireDonut(segments, centreValeur, centreLabel) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const actifs = segments.filter(s => s.value > 0);

  if (total === 0) {
    return `<div class="chart-empty">Aucune donnée disponible pour le moment.</div>`;
  }

  let cumul = 0;
  const arcs = actifs.map(seg => {
    const pct = (seg.value / total) * 100;
    const offset = 25 - cumul;
    cumul += pct;
    return `<circle class="donut-arc" cx="21" cy="21" r="15.91549430918954" fill="transparent"
              stroke="${seg.color}" stroke-width="6.5"
              stroke-dasharray="${pct.toFixed(3)} ${(100 - pct).toFixed(3)}"
              stroke-dashoffset="${offset.toFixed(3)}">
              <title>${escapeHtml(seg.label)} : ${seg.value} (${pct.toFixed(1)}%)</title>
            </circle>`;
  }).join("");

  const legende = actifs.map(seg => {
    const pct = (seg.value / total) * 100;
    return `
      <div class="chart-legend-row">
        <span class="chart-swatch" style="background:${seg.color}"></span>
        <span class="chart-legend-label">${seg.icon ? `<i class="bi ${seg.icon}"></i> ` : ""}${escapeHtml(seg.label)}</span>
        <span class="chart-legend-value">${seg.value} <span class="text-muted">(${pct.toFixed(1)}%)</span></span>
      </div>`;
  }).join("");

  return `
    <div class="chart-donut-wrap">
      <svg class="chart-donut" viewBox="0 0 42 42" role="img" aria-label="${escapeHtml(centreLabel)}">
        ${arcs}
        <text x="21" y="19.5" class="chart-donut-value">${centreValeur}</text>
        <text x="21" y="26" class="chart-donut-label">${escapeHtml(centreLabel)}</text>
      </svg>
      <div class="chart-legend">${legende}</div>
    </div>`;
}

// Diagramme en bandes (colonnes) — une seule série, pas de légende requise ;
// valeur au sommet de chaque barre, catégorie en dessous.
function construireBarChart(categories, couleur) {
  const total = categories.reduce((s, c) => s + c.value, 0);
  if (total === 0) {
    return `<div class="chart-empty">Aucune date de naissance renseignée pour le moment.</div>`;
  }
  const max = Math.max(...categories.map(c => c.value), 1);

  const colonnes = categories.map(c => {
    const hauteur = c.value > 0 ? Math.max(Math.round((c.value / max) * 100), 6) : 0;
    return `
      <div class="bar-col">
        <div class="bar-value">${c.value}</div>
        <div class="bar-track"><div class="bar-fill" style="height:${hauteur}%; background:${couleur};" title="${escapeHtml(c.label)} : ${c.value}"></div></div>
        <div class="bar-label">${escapeHtml(c.label)}</div>
      </div>`;
  }).join("");

  return `<div class="bar-chart">${colonnes}</div>`;
}

function renderChartsBloc(containerId) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const { f, m, nr } = calculerRepartitionSexe();
  const donutSexe = construireDonut([
    { label: "Filles",          value: f,  color: CHART_COLORS.rose },
    { label: "Garçons",         value: m,  color: CHART_COLORS.bleu },
    { label: "Non renseigné",   value: nr, color: CHART_COLORS.or }
  ], f + m + nr, "élèves");

  const { tranches, nonRenseigne } = calculerRepartitionAges();
  const categoriesAge = tranches.map(t => ({ label: t.label, value: t.count }));
  if (nonRenseigne > 0) categoriesAge.push({ label: "Non renseigné", value: nonRenseigne });
  const barChartAges = construireBarChart(categoriesAge, CHART_COLORS.rose);

  const { solde, partiel, impaye } = calculerRepartitionStatuts();
  const donutStatuts = construireDonut([
    { label: "Soldé",   value: solde,   color: CHART_COLORS.bon,      icon: "bi-check-circle-fill" },
    { label: "Partiel", value: partiel, color: CHART_COLORS.alerte,   icon: "bi-exclamation-circle-fill" },
    { label: "Impayé",  value: impaye,  color: CHART_COLORS.critique, icon: "bi-x-circle-fill" }
  ], solde + partiel + impaye, "dossiers");

  root.innerHTML = `
    <div class="card chart-card">
      <div class="card-title"><i class="bi bi-people-fill"></i> Filles / Garçons</div>
      ${donutSexe}
    </div>
    <div class="card chart-card">
      <div class="card-title"><i class="bi bi-bar-chart-line-fill"></i> Tranches d'âge</div>
      ${barChartAges}
    </div>
    <div class="card chart-card">
      <div class="card-title"><i class="bi bi-pie-chart-fill"></i> Statut des paiements</div>
      ${donutStatuts}
    </div>
  `;
}
