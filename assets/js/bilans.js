// ============================================================
// bilans.js — Bilans par secteur + bilan général de l'année
// ============================================================

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

// Couleur décorative attribuée à chaque carte secteur, dans l'ordre —
// purement visuelle (distinguer les cartes d'un coup d'œil dans la liste),
// sans rapport avec les couleurs de statut (soldé/partiel/impayé).
var BILAN_SECTEUR_COULEURS = ["pink", "navy", "green", "gold", "blue", "orange", "red"];

// Liste fixe et complète des secteurs — toujours affichés, même à 0 F,
// pour un bilan lisible d'un coup d'œil. Maternelle et Primaire partagent
// la même catégorie de poste ("Scolarité") : on les sépare ici en
// retrouvant la section de l'enfant propriétaire de chaque poste.
// Secteurs "au choix" : la fréquentation varie mois par mois au gré des
// familles (un enfant peut être inscrit à la crèche ou à la cantine un
// mois et pas le suivant) — le "dû" généré pour tous les mois de l'année
// ne représente donc pas une vraie créance. Pour ces secteurs, la carte
// n'affiche que les montants réels (encaissé / sorties / solde net), sans
// "Total attendu" ni "Reste à recouvrer" ni "Taux de recouvrement".
var BILAN_SECTEURS_AU_CHOIX = ["Crèche", "Cantine", "Cantine crèche"];

var BILAN_CATEGORIES_FIXES = [
  { label: "Crèche",                    match: (p, ef) => p.cat === "Crèche" },
  { label: "Maternelle",                match: (p, ef) => p.cat === "Scolarité" && ef && MAT_SECTS.includes(ef.sect) },
  { label: "Primaire",                  match: (p, ef) => p.cat === "Scolarité" && ef && PRIM_SECTS.includes(ef.sect) },
  { label: "Activités parascolaires",   match: (p) => p.cat === "Activités parascolaires" },
  { label: "Fêtes scolaires",           match: (p) => p.cat === "Fêtes scolaires" },
  { label: "Assurance",                 match: (p) => p.cat === "Assurance" },
  { label: "APE",                       match: (p) => p.cat === "APE" },
  { label: "Cantine",                   match: (p) => p.cat === "Cantine" },
  { label: "Cantine crèche",            match: (p) => p.cat === "Cantine crèche" },
  { label: "Goûter & Garderie",         match: (p) => p.cat === "Goûter" || p.cat === "Garderie" },
  { label: "Uniformes",                 match: (p) => p.cat === "Uniformes" },
  { label: "Fournitures",               match: (p) => p.cat === "Fournitures" },
  { label: "Halte-Garderie",            match: (p) => PONCTUEL_CRECHE_CATS.includes(p.cat) }
];

// Une carte détaillée par secteur : encaissé, total attendu, reste à
// recouvrer, sorties imputées à ce secteur, taux de recouvrement, et un
// bandeau "Solde net" (encaissé − sorties) coloré pour repérer la carte
// d'un coup d'œil dans la liste. Les secteurs "au choix" (voir
// BILAN_SECTEURS_AU_CHOIX) omettent les lignes basées sur le "dû".
function renderBilanSecteurCard(label, du, paye, sortiesImputees, couleur) {
  const auChoix = BILAN_SECTEURS_AU_CHOIX.includes(label);
  const reste = Math.max(du - paye, 0);
  const taux = du > 0 ? Math.round((paye / du) * 100) : 0;
  const soldeNet = paye - sortiesImputees;

  const lignesAttendu = auChoix ? "" : `
      <div class="poste-row"><div class="poste-label">Total attendu (familles)</div><div class="poste-amounts text-pink">${fmtFCFA(du)}</div></div>
      <div class="poste-row"><div class="poste-label">Reste à recouvrer</div><div class="poste-amounts text-orange">${fmtFCFA(reste)}</div></div>`;
  const ligneTaux = auChoix ? "" : `
      <div class="poste-row"><div class="poste-label">Taux de recouvrement</div><div class="poste-amounts">${taux}%</div></div>`;

  return `
    <div class="card secteur-card">
      <div class="secteur-card-header">
        <span class="secteur-card-titre">${escapeHtml(label)}</span>
        <span class="secteur-card-total text-${couleur}">${fmtFCFA(paye)}</span>
      </div>
      <div class="poste-row"><div class="poste-label">Encaissé</div><div class="poste-amounts text-green">${fmtFCFA(paye)}</div></div>${lignesAttendu}
      <div class="poste-row"><div class="poste-label">Sorties imputées</div><div class="poste-amounts">− ${fmtFCFA(sortiesImputees)}</div></div>${ligneTaux}
      <div class="secteur-card-solde secteur-solde-${couleur}">
        <span>Solde net</span>
        <strong>${fmtFCFA(soldeNet)}</strong>
      </div>
    </div>`;
}

function renderBilans() {
  const root = document.getElementById("bilansSecteurs");
  if (!root) return;

  const enfantParId = {};
  STATE.enfants.forEach(e => { enfantParId[e.id] = e; });

  const sortiesParSecteur = {};
  STATE.sorties.forEach(s => {
    const sect = s.secteur || "Administratif / Divers";
    sortiesParSecteur[sect] = (sortiesParSecteur[sect] || 0) + (Number(s.mt) || 0);
  });

  root.innerHTML = BILAN_CATEGORIES_FIXES.map((entry, idx) => {
    let du = 0, paye = 0;
    STATE.postes.forEach(p => {
      if (p.is_remise || p.key === "avance") return;
      if (entry.match(p, enfantParId[p.enfant_id])) {
        du += p.du || 0;
        paye += p.paye || 0;
      }
    });
    const sortiesImputees = sortiesParSecteur[entry.label] || 0;
    const couleur = BILAN_SECTEUR_COULEURS[idx % BILAN_SECTEUR_COULEURS.length];
    return renderBilanSecteurCard(entry.label, du, paye, sortiesImputees, couleur);
  }).join("");
}

// Recettes déclarées par secteur (d'après le(s) secteur(s) coché(s) sur
// chaque entrée) — un paiement multi-secteurs compte dans chacun d'eux.
// Réutilisée par le Bilan général, le mini-bilan des Entrées et le
// Tableau de bord.
function calculerRecettesParSecteur() {
  const recettesParSecteur = {};
  STATE.entrees.forEach(e => {
    const secteurs = (e.sect || "").split(",").map(s => s.trim()).filter(Boolean);
    if (secteurs.length === 0) secteurs.push("Non classé");
    secteurs.forEach(sect => { recettesParSecteur[sect] = (recettesParSecteur[sect] || 0) + (Number(e.mt) || 0); });
  });
  return recettesParSecteur;
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
  const resultatPrevisionnel = soldeNet + m.totalReste;

  const modeStats = {};
  STATE.entrees.forEach(e => { modeStats[e.mode] = (modeStats[e.mode] || 0) + (Number(e.mt) || 0); });

  const catSorties = {};
  STATE.sorties.forEach(s => { catSorties[s.cat] = (catSorties[s.cat] || 0) + (Number(s.mt) || 0); });

  const recettesParSecteur = calculerRecettesParSecteur();

  // Dépenses par secteur imputé (nouveau champ des Sorties)
  const depensesParSecteur = {};
  STATE.sorties.forEach(s => {
    const sect = s.secteur || "Administratif / Divers";
    depensesParSecteur[sect] = (depensesParSecteur[sect] || 0) + (Number(s.mt) || 0);
  });

  // Synthèse par enfant — même logique que l'export CSV, affichée à l'écran
  const syntheseEnfants = STATE.enfants.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const du = tDu(postesEnfant), paye = tPaye(postesEnfant), reste = tReste(postesEnfant);
    const pct = du > 0 ? Math.round((paye / du) * 100) : 0;
    return { nom: e.nom, sect: SECT_LABELS[e.sect] || e.sect, du, paye, reste, pct, statut: statutPaiement(postesEnfant) };
  });

  root.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card metric-green"><div class="metric-label">Total entrées caisse</div><div class="metric-value">${fmtFCFA(m.totalEncaisse)}</div></div>
      <div class="metric-card metric-red"><div class="metric-label">Total dépenses</div><div class="metric-value">${fmtFCFA(totalSorties)}</div></div>
      <div class="metric-card ${soldeNet >= 0 ? "metric-lime" : "metric-red"}"><div class="metric-label">Résultat net</div><div class="metric-value">${fmtFCFA(soldeNet)}</div></div>
      <div class="metric-card metric-navy"><div class="metric-label">Perçu (dossiers)</div><div class="metric-value">${fmtFCFA(m.totalPaye)}</div></div>
      <div class="metric-card metric-gold"><div class="metric-label">Créances familles</div><div class="metric-value">${fmtFCFA(m.totalReste)}</div></div>
      <div class="metric-card metric-lime"><div class="metric-label">Taux de recouvrement</div><div class="metric-value">${m.tauxRecouvrement}%</div></div>
    </div>

    <div class="charts-grid" id="bilanCharts"></div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-title"><i class="bi bi-graph-up-arrow"></i> Recettes par secteur</div>
        ${Object.keys(recettesParSecteur).length === 0 ? '<p class="text-muted">Aucune recette pour le moment.</p>' :
          Object.entries(recettesParSecteur).sort((a, b) => b[1] - a[1]).map(([sect, mt]) => `
            <div class="poste-row"><div class="poste-label">${escapeHtml(sect)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
      </div>
      <div class="card">
        <div class="card-title"><i class="bi bi-wallet2"></i> Dépenses par secteur</div>
        ${Object.keys(depensesParSecteur).length === 0 ? '<p class="text-muted">Aucune dépense enregistrée.</p>' :
          Object.entries(depensesParSecteur).sort((a, b) => b[1] - a[1]).map(([sect, mt]) => `
            <div class="poste-row"><div class="poste-label">${escapeHtml(sect)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-journal-text"></i> Récapitulatif comptable</div>
      <div class="poste-row"><div class="poste-label">Total entrées encaissées</div><div class="poste-amounts">${fmtFCFA(m.totalEncaisse)}</div></div>
      <div class="poste-row"><div class="poste-label">Total dépenses</div><div class="poste-amounts text-red">− ${fmtFCFA(totalSorties)}</div></div>
      <div class="poste-row" style="background:var(--navy); color:#fff; border-radius:8px; margin-top:6px;">
        <div class="poste-label" style="color:#fff;"><i class="bi bi-cash-coin"></i> Résultat net</div>
        <div class="poste-amounts" style="color:#fff;"><strong>${fmtFCFA(soldeNet)}</strong></div>
      </div>
      <div class="poste-row"><div class="poste-label">Créances familles (impayés)</div><div class="poste-amounts text-orange">+ ${fmtFCFA(m.totalReste)}</div></div>
      <div class="poste-row" style="background:var(--pink); color:#fff; border-radius:8px; margin-top:6px;">
        <div class="poste-label" style="color:#fff;"><i class="bi bi-trophy-fill"></i> Résultat prévisionnel</div>
        <div class="poste-amounts" style="color:#fff;"><strong>${fmtFCFA(resultatPrevisionnel)}</strong></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-credit-card"></i> Encaissements par mode de paiement</div>
      ${Object.keys(modeStats).length === 0 ? '<p class="text-muted">Aucune donnée pour le moment.</p>' :
        Object.entries(modeStats).sort((a, b) => b[1] - a[1]).map(([mode, mt]) => `
          <div class="poste-row"><div class="poste-label">${escapeHtml(mode)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-people-fill"></i> Synthèse par enfant</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Enfant</th><th>Section</th><th>Total dû</th><th>Payé</th><th>Reste</th><th>%</th><th>Statut</th></tr></thead>
          <tbody>
            ${syntheseEnfants.length === 0 ? '<tr><td colspan="7" class="text-center text-muted">Aucun dossier pour le moment.</td></tr>' :
              syntheseEnfants.map(x => {
                const info = STATUT_INFO[x.statut];
                return `<tr>
                  <td>${escapeHtml(x.nom)}</td>
                  <td>${escapeHtml(x.sect)}</td>
                  <td>${fmtFCFA(x.du)}</td>
                  <td>${fmtFCFA(x.paye)}</td>
                  <td>${fmtFCFA(x.reste)}</td>
                  <td>${x.pct}%</td>
                  <td><span class="badge ${info.badge}"><i class="bi ${info.icon}"></i> ${info.texte}</span></td>
                </tr>`;
              }).join("")}
            ${syntheseEnfants.length > 0 ? `<tr style="font-weight:800;">
              <td>Total général</td><td></td>
              <td>${fmtFCFA(syntheseEnfants.reduce((s,x)=>s+x.du,0))}</td>
              <td>${fmtFCFA(syntheseEnfants.reduce((s,x)=>s+x.paye,0))}</td>
              <td>${fmtFCFA(syntheseEnfants.reduce((s,x)=>s+x.reste,0))}</td>
              <td></td><td></td>
            </tr>` : ""}
          </tbody>
        </table>
      </div>
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
