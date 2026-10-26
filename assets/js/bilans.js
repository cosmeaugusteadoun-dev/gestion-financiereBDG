// ============================================================
// bilans.js — Bilans par secteur + bilan général de l'année
// ============================================================

// Couleurs de graphiques validées (contraste + distinction daltonisme) —
// distinctes des couleurs de badges/texte pour rester lisibles en aplats.
var CHART_COLORS = {
  rose:     "#E5007D", // identité de l'école — Filles / tranches d'âge
  bleu:     "#2a78d6", // Garçons
  or:       "#D4AF37", // Non renseigné
  bon:      "#0ca30c", // À jour / Soldé
  orange:   "#e8710a", // Retard de crèche
  alerte:   "#fab219", // Retard de cantine
  critique: "#d03b3b"  // Retard de scolarité
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
// sans rapport avec les couleurs de statut (à jour / retards).
var BILAN_SECTEUR_COULEURS = ["pink", "navy", "green", "gold", "blue", "orange", "red"];

// Filtre par statut du Tableau de bord (liste « Alertes de retard » et
// « Parents à relancer ») — conservé entre les rendus, voir renderChartsBloc.
var filtreStatutDashActif = "";

// Liste fixe et complète des secteurs — toujours affichés, même à 0 F,
// pour un bilan lisible d'un coup d'œil. Maternelle et Primaire partagent
// la même catégorie de poste ("Scolarité") : on les sépare ici en
// retrouvant la section de l'enfant propriétaire de chaque poste.
// Secteurs sans "dû" fiable : soit la fréquentation varie mois par mois au
// gré des familles (Crèche, Cantine, Cantine crèche, Goûter — un enfant peut
// y être inscrit un mois et pas le suivant), soit le montant dépend d'achats
// ponctuels et variables (Uniformes, Fournitures, Garderie, Halte-Garderie).
// Dans les deux cas, le "dû" généré ne représente pas une vraie créance : la
// carte n'affiche que les montants réels (encaissé / sorties / solde net),
// sans "Total attendu" ni "Reste à recouvrer" ni "Taux de recouvrement".
var BILAN_SECTEURS_AU_CHOIX = [
  "Crèche", "Cantine", "Cantine crèche", "Goûter",
  "Uniformes", "Fournitures", "Garderie", "Halte-Garderie"
];

// Le goûter est une carte à part ici (Bilan par secteur) et dans
// Entrées/Sorties, même s'il reste affiché regroupé avec la Cantine dans
// le dossier de l'enfant (voir enfants.js, catAffichage) — deux vues
// différentes, deux granularités différentes, par choix explicite.
var BILAN_CATEGORIES_FIXES = [
  { label: "Crèche",                    match: (p, ef) => p.cat === "Crèche" || ((p.key === "inscr" || p.cat === "Inscription") && ef && ef.sect === "creche") },
  { label: "Maternelle",                match: (p, ef) => (p.cat === "Scolarité" || p.cat === "Inscription") && ef && MAT_SECTS.includes(ef.sect) },
  { label: "Primaire",                  match: (p, ef) => (p.cat === "Scolarité" || p.cat === "Inscription") && ef && PRIM_SECTS.includes(ef.sect) },
  { label: "Activités parascolaires",   match: (p) => p.cat === "Activités parascolaires" },
  { label: "Fêtes scolaires",           match: (p) => p.cat === "Fêtes scolaires" },
  { label: "Assurance",                 match: (p) => p.cat === "Assurance" },
  { label: "APE",                       match: (p) => p.cat === "APE" },
  { label: "Cantine",                   match: (p) => p.cat === "Cantine" },
  { label: "Cantine crèche",            match: (p) => p.cat === "Cantine crèche" },
  { label: "Goûter",                    match: (p) => p.cat === "Goûter" },
  { label: "Garderie",                  match: (p, ef) => p.cat === "Garderie" || ((p.key === "inscr" || p.cat === "Inscription") && ef && ef.sect === "garderie") },
  { label: "Uniformes",                 match: (p) => p.cat === "Uniformes" },
  { label: "Fournitures",               match: (p) => p.cat === "Fournitures" },
  { label: "Halte-Garderie",            match: (p) => PONCTUEL_CRECHE_CATS.includes(p.cat) }
];

// Une carte détaillée par secteur : encaissé, total attendu, reste à
// recouvrer, sorties imputées à ce secteur, taux de recouvrement, et un
// bandeau "Solde net" (encaissé − sorties) coloré pour repérer la carte
// d'un coup d'œil dans la liste. Les secteurs "au choix" (voir
// BILAN_SECTEURS_AU_CHOIX) omettent les lignes basées sur le "dû".
// `paye` = somme des postes réellement crédités (sert au dû/reste/taux),
// `encaisse` = argent réellement reçu pour ce secteur (peut être supérieur si
// une partie est en avance) — c'est ce montant qui doit apparaître à l'écran.
function libelleSecteurFinance(label) {
  return label === "Garderie" ? "Garderie midi" : label;
}

function renderBilanSecteurCard(label, du, paye, encaisse, sortiesImputees, couleur) {
  const auChoix = BILAN_SECTEURS_AU_CHOIX.includes(label);
  const reste = Math.max(du - paye, 0);
  const taux = du > 0 ? Math.round((paye / du) * 100) : 0;
  const soldeNet = encaisse - sortiesImputees;

  const lignesAttendu = auChoix ? "" : `
      <div class="poste-row"><div class="poste-label">Total attendu (familles)</div><div class="poste-amounts text-pink">${fmtFCFA(du)}</div></div>
      <div class="poste-row"><div class="poste-label">Reste à recouvrer</div><div class="poste-amounts text-orange">${fmtFCFA(reste)}</div></div>`;
  const ligneTaux = auChoix ? "" : `
      <div class="poste-row"><div class="poste-label">Taux de recouvrement</div><div class="poste-amounts">${taux}%</div></div>`;

  return `
    <div class="card secteur-card">
      <div class="secteur-card-header">
        <span class="secteur-card-titre">${escapeHtml(libelleSecteurFinance(label))}</span>
        <span class="secteur-card-total text-${couleur}">${fmtFCFA(encaisse)}</span>
      </div>
      <div class="poste-row"><div class="poste-label">Encaissé</div><div class="poste-amounts text-green">${fmtFCFA(encaisse)}</div></div>${lignesAttendu}
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
  majCompteurListe(root, BILAN_CATEGORIES_FIXES.length);

  const enfantParId = {};
  STATE.enfants.forEach(e => { enfantParId[e.id] = e; });

  const sortiesParSecteur = {};
  STATE.sorties.forEach(s => {
    const sect = carteBilanPourSecteur(s.secteur, null) || s.secteur || "Administratif / Divers";
    sortiesParSecteur[sect] = (sortiesParSecteur[sect] || 0) + (Number(s.mt) || 0);
  });

  const encaisseParEntree = calculerEncaisseParSecteurDepuisEntrees();

  const categories = [...BILAN_CATEGORIES_FIXES];
  new Set([...Object.keys(encaisseParEntree), ...Object.keys(sortiesParSecteur)]).forEach(label => {
    if (!categories.some(e => e.label === label)) categories.push({ label, match: () => false });
  });
  majCompteurListe(root, categories.length);
  root.innerHTML = categories.map((entry, idx) => {
    let du = 0, payePostes = 0, avance = 0;
    STATE.postes.forEach(p => {
      if (p.is_remise) return;
      if (!entry.match(p, enfantParId[p.enfant_id])) return;
      // Le poste « Avance / Trop-perçu » ne porte aucun dû, mais l'argent est
      // bien reçu : il compte dans l'encaissé du secteur.
      if (p.key === "avance") avance += Number(p.paye) || 0;
      else {
        du += Number(p.du) || 0;
        payePostes += Number(p.paye) || 0;
      }
    });

    // La caisse provient uniquement des entrées. Les crédits des dossiers
    // servent au suivi des créances et peuvent inclure des remises.
    const paye = payePostes;
    const encaisse = encaisseParEntree[entry.label] || 0;

    const sortiesImputees = sortiesParSecteur[entry.label] || 0;
    const couleur = BILAN_SECTEUR_COULEURS[idx % BILAN_SECTEUR_COULEURS.length];
    return renderBilanSecteurCard(entry.label, du, paye, encaisse, sortiesImputees, couleur);
  }).join("");
}
// ============================================================
// ENCAISSEMENTS PAR SECTEUR — source : les entrées réellement reçues
// ============================================================
// Une entrée peut viser un secteur sans poste correspondant (service souscrit
// après la création du dossier, montant supérieur au dû, ou entrée saisie avant
// l'imputation automatique) : l'argent est bien encaissé mais il n'apparaît
// sur AUCUNE carte du bilan. On reconstitue donc le total encaissé par secteur
// directement à partir des paiements reçus :
//   1) via les allocations — chaque versement est rangé dans la carte du poste
//      qu'il a réellement crédité (source la plus fidèle) ;
//   2) à défaut (entrée ancienne sans allocations), via les secteurs cochés à la
//      saisie, répartis à parts égales lorsqu'il y en a plusieurs.
// L'inscription n'a pas de carte dédiée : elle rejoint la carte de scolarité de
// la section de l'enfant, comme dans son dossier.
var SECTEUR_ENTREE_VERS_CARTE = {
  "Scolarité Maternelle": "Maternelle",
  "Scolarité Primaire": "Primaire",
  "Crèche": "Crèche",
  "Cantine": "Cantine",
  // Le Petit-déjeuner et le Déjeuner sont saisis séparément dans le
  // formulaire d'enregistrement mais restent regroupés sous la carte
  // « Cantine » du bilan général (voir plus bas, calculerRecettesParSecteur).
  "Petit-déjeuner": "Cantine",
  "Déjeuner": "Cantine",
  "Cantine crèche": "Cantine crèche",
  "Goûter": "Goûter",
  "Garderie": "Garderie",
  "Halte-Garderie": "Halte-Garderie",
  "Uniformes": "Uniformes",
  "Fournitures": "Fournitures",
  "Activités parascolaires": "Activités parascolaires",
  "Fêtes scolaires": "Fêtes scolaires",
  "Assurance": "Assurance",
  "APE": "APE"
};

// Normaliser les anciens libellés, sans confondre crèche et garderie midi.
function normaliserSecteurBilan(secteur) {
  return String(secteur || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}

function carteBilanPourSecteur(secteur, enfant) {
  const cle = normaliserSecteurBilan(secteur);
  if (cle === "inscription") {
    if (!enfant) return null;
    if (MAT_SECTS.includes(enfant.sect)) return "Maternelle";
    if (PRIM_SECTS.includes(enfant.sect)) return "Primaire";
    if (enfant.sect === "garderie") return "Garderie";
    if (enfant.sect === "creche") return "Crèche";
    return null;
  }
  if (["creche (garderie)", "creche / garderie"].includes(cle)) return "Crèche";
  if (cle === "garderie midi") return "Garderie";
  const secteurConnu = Object.keys(SECTEUR_ENTREE_VERS_CARTE)
    .find(s => normaliserSecteurBilan(s) === cle);
  return secteurConnu ? SECTEUR_ENTREE_VERS_CARTE[secteurConnu] : null;
}

// L'inscription suit le service auquel appartient le dossier.
function carteBilanPourPoste(p, enfant) {
  if (!p) return null;
  if (p.key === "inscr" || p.cat === "Inscription") {
    return carteBilanPourSecteur("Inscription", enfant);
  }
  const entry = BILAN_CATEGORIES_FIXES.find(e => e.match(p, enfant));
  return entry ? entry.label : carteBilanPourSecteur(p.cat, enfant);
}

// Ne compter chaque franc qu'une fois, même si une partie des postes a disparu.
// Ventilation commune : chaque montant de caisse n'est compté qu'une fois.
function ventilerEncaissements() {
  const enfants = new Map(STATE.enfants.map(e => [e.id, e]));
  const postes = new Map(STATE.postes.map(p => [p.id, p]));
  const lignes = [];
  let paiementsEstimes = 0;
  const noms = [...Object.keys(SECTEUR_ENTREE_VERS_CARTE), "Inscription"];
  const normaliser = nom => {
    const cle = normaliserSecteurBilan(nom);
    if (["creche (garderie)", "creche / garderie"].includes(cle)) return "Crèche";
    if (cle === "garderie midi") return "Garderie";
    return noms.find(s => normaliserSecteurBilan(s) === cle) || String(nom || "").trim() || "Non classé";
  };
  for (const en of STATE.entrees) {
    const montant = Number(en.mt);
    if (!Number.isFinite(montant) || montant <= 0) continue;
    const enfant = enfants.get(en.enfant_id);
    const declares = [...new Set(String(en.sect || "").split(",").map(s => s.trim()).filter(Boolean).map(normaliser))];
    let impute = 0, estime = false;
    for (const a of (Array.isArray(en.allocations) ? en.allocations : [])) {
      const valeur = Number(a.montant);
      if (!Number.isFinite(valeur) || valeur <= 0) continue;
      const poste = postes.get(a.poste_id) || (a.poste?.id === a.poste_id ? a.poste : null);
      const dossier = (poste && enfants.get(poste.enfant_id)) || enfant;
      const secteur = a.secteur ? normaliser(a.secteur)
        : poste ? normaliser(secteurEnregistrementPoste(poste, dossier))
        : declares.length === 1 ? declares[0] : null;
      if (!secteur) continue;
      const part = Math.min(valeur, montant - impute);
      if (part <= 0) continue;
      lignes.push({ secteur, enfant: dossier, montant: part, estime: false });
      impute += part;
    }
    const reste = montant - impute;
    if (reste > 0) {
      const cibles = declares.length ? declares : ["Non classé"];
      const base = Math.floor(reste / cibles.length);
      let supplement = reste - base * cibles.length;
      cibles.forEach(secteur => {
        const ajout = Math.min(1, supplement); supplement -= ajout;
        const part = base + ajout;
        if (part > 0) lignes.push({ secteur, enfant, montant: part, estime: cibles.length > 1 });
      });
      estime = cibles.length > 1;
    }
    if (estime) paiementsEstimes++;
  }
  return { lignes, paiementsEstimes };
}
function calculerEncaisseParSecteurDepuisEntrees() {
  const total = {};
  ventilerEncaissements().lignes.forEach(l => {
    const carte = carteBilanPourSecteur(l.secteur, l.enfant) || "Non classé";
    total[carte] = (total[carte] || 0) + l.montant;
  });
  return total;
}
function calculerEncaisseParSecteurBilan() {
  return calculerEncaisseParSecteurDepuisEntrees();
}

// Recettes réellement ventilées, réutilisées par le Bilan général et les
// Entrées. separerRepas garde les services de cantine distincts à la saisie.
function secteurEnregistrementPoste(p, enfant) {
  if (p.key === "inscr") return "Inscription";
  if (String(p.key || "").indexOf("ptdej_") === 0) return "Petit-déjeuner";
  if (String(p.key || "").indexOf("dej_") === 0) return "Déjeuner";
  if (p.cat === "Scolarité") return enfant && PRIM_SECTS.includes(enfant.sect) ? "Scolarité Primaire" : "Scolarité Maternelle";
  return p.cat;
}

function calculerRecettesParSecteur(separerRepas = false) {
  const total = {};
  ventilerEncaissements().lignes.forEach(l => {
    const cle = !separerRepas && ["Petit-déjeuner", "Déjeuner"].includes(l.secteur) ? "Cantine" : l.secteur;
    total[cle] = (total[cle] || 0) + l.montant;
  });
  return total;
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
    const sect = carteBilanPourSecteur(s.secteur, null) || s.secteur || "Administratif / Divers";
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
        <div class="card-title"><i class="bi bi-graph-up-arrow"></i> Recettes par secteur <span class="badge badge-gray">${Object.keys(recettesParSecteur).length}</span></div>
        ${Object.keys(recettesParSecteur).length === 0 ? '<p class="text-muted">Aucune recette pour le moment.</p>' :
          Object.entries(recettesParSecteur).sort((a, b) => b[1] - a[1]).map(([sect, mt]) => `
            <div class="poste-row"><div class="poste-label">${escapeHtml(sect)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
      </div>
      <div class="card">
        <div class="card-title"><i class="bi bi-wallet2"></i> Dépenses par secteur <span class="badge badge-gray">${Object.keys(depensesParSecteur).length}</span></div>
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
      <div class="card-title"><i class="bi bi-credit-card"></i> Encaissements par mode de paiement <span class="badge badge-gray">${Object.keys(modeStats).length}</span></div>
      ${Object.keys(modeStats).length === 0 ? '<p class="text-muted">Aucune donnée pour le moment.</p>' :
        Object.entries(modeStats).sort((a, b) => b[1] - a[1]).map(([mode, mt]) => `
          <div class="poste-row"><div class="poste-label">${escapeHtml(mode)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")}
    </div>

    <div class="card">
      <div class="card-title"><i class="bi bi-people-fill"></i> Synthèse par enfant <span class="badge badge-gray">${syntheseEnfants.length}</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Enfant</th><th>Section</th><th>Total dû</th><th>Payé</th><th>Reste</th><th>%</th><th>Statut</th></tr></thead>
          <tbody>
            ${syntheseEnfants.length === 0 ? '<tr><td colspan="7" class="text-center text-muted">Aucun dossier pour le moment.</td></tr>' :
              syntheseEnfants.map(x => {
                const info = STATUT_INFO[x.statut] || STATUT_INFO.a_jour;
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

// Répartition des dossiers par statut de paiement — les 4 statuts de suivi
// (les dossiers « Soldé » sont comptés avec « À jour », ils n'ont aucun
// retard non plus). Voir postes.js, statutPaiement.
function calculerRepartitionStatuts() {
  let aJour = 0, retardScol = 0, retardCreche = 0, retardCantine = 0;
  STATE.enfants.forEach(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const statut = statutPaiement(postesEnfant);
    if (statut === "solde" || statut === "a_jour") aJour++;
    else if (statut === "retard_creche") retardCreche++;
    else if (statut === "retard_cantine") retardCantine++;
    else retardScol++;
  });
  return { aJour, retardScol, retardCreche, retardCantine };
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

  const { aJour, retardScol, retardCreche, retardCantine } = calculerRepartitionStatuts();
  const donutStatuts = construireDonut([
    { label: "À jour",             value: aJour,         color: CHART_COLORS.bon,      icon: "bi-check-circle-fill" },
    { label: "Retard de scolarité", value: retardScol,    color: CHART_COLORS.critique, icon: "bi-exclamation-triangle-fill" },
    { label: "Retard de crèche",    value: retardCreche,  color: CHART_COLORS.orange,   icon: "bi-exclamation-circle-fill" },
    { label: "Retard de cantine",   value: retardCantine, color: CHART_COLORS.alerte,   icon: "bi-cup-hot-fill" }
  ], aJour + retardScol + retardCreche + retardCantine, "dossiers");

  // Sur le Tableau de bord uniquement : filtre par statut appliqué aux
  // listes « Alertes de retard » et « Parents à relancer ». La valeur est
  // conservée entre les rendus (filtreStatutDashActif).
  const optionStatut = (valeur, libelle) => `<option value="${valeur}"${filtreStatutDashActif === valeur ? " selected" : ""}>${libelle}</option>`;
  const filtreStatut = containerId === "dashCharts" ? `
    <div class="field" style="margin:10px 0 0;">
      <label for="filtreStatutDash" style="font-size:11.5px;">Filtrer les listes par statut</label>
      <select id="filtreStatutDash">
        <option value=""${filtreStatutDashActif === "" ? " selected" : ""}>Tous les statuts</option>
        ${optionStatut("a_jour", "À jour")}
        ${optionStatut("retard_scol", "Retard de scolarité")}
        ${optionStatut("retard_creche", "Retard de crèche")}
        ${optionStatut("retard_cantine", "Retard de cantine")}
        ${optionStatut("solde", "Soldé")}
      </select>
    </div>` : "";

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
      ${filtreStatut}
      ${containerId === "dashCharts" ? '<div id="dashStatutListe"></div>' : ""}
    </div>
  `;

  root.querySelector("#filtreStatutDash")?.addEventListener("change", (ev) => {
    filtreStatutDashActif = ev.target.value;
    renderAlertesRetard();
    renderParentsARelancer();
    renderListeStatutDashboard();
  });
  if (containerId === "dashCharts") renderListeStatutDashboard();
}

function renderListeStatutDashboard() {
  const root = document.getElementById("dashStatutListe");
  if (!root) return;
  if (!filtreStatutDashActif) { root.innerHTML = ""; return; }
  const liste = STATE.enfants.filter(e => correspondStatut(
    statutPaiement(STATE.postes.filter(p => p.enfant_id === e.id)), filtreStatutDashActif));
  root.innerHTML = `<p class="text-muted">${liste.length} dossier${liste.length > 1 ? "s" : ""}</p>` + liste.map(e =>
    `<div class="poste-row"><span>${escapeHtml(e.nom)}</span><button type="button" class="btn btn-ghost btn-sm" data-statut-dossier="${escapeHtml(e.id)}">Dossier</button></div>`).join("");
  root.querySelectorAll("[data-statut-dossier]").forEach(btn => btn.addEventListener("click", () => verFicheEnfant(btn.dataset.statutDossier)));
}
