// ============================================================
// entrees.js — Saisie des paiements reçus + synchro des dossiers
// ============================================================

var selectedEnfantId = null;
var enregistrementEntreeEnCours = false;
var correctionEntreeEnCours = false;
var TRANCHE_LABELS_ENTREE = { t1: "1ère tranche", t2: "2ème tranche", t3: "3ème tranche" };

// ============================================================
// INITIALISATION DU MODULE
// ============================================================
function initEntrees() {
  document.getElementById("eDate").value = new Date().toISOString().slice(0, 10);

  document.getElementById("eNom").addEventListener("input", handleNomInput);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#eNomSuggestions") && e.target.id !== "eNom") {
      document.getElementById("eNomSuggestions").style.display = "none";
    }
  });

  document.getElementById("formEntree").addEventListener("submit", handleCreateEntree);
  document.getElementById("btnResetEntree").addEventListener("click", resetEntreeForm);

  document.querySelectorAll('input[name="eSect"]').forEach(cb => {
    cb.addEventListener("change", () => {
      cb.closest(".checkbox-item").classList.toggle("checked", cb.checked);
      renderRepartitionEntree();
    });
  });
  renderRepartitionEntree();
}

function renderRepartitionEntree() {
  const root = document.getElementById("eRepartition");
  if (!root) return;
  const anciens = {};
  root.querySelectorAll("[data-montant-secteur]").forEach(input => { anciens[input.dataset.montantSecteur] = input.value; });
  const secteurs = Array.from(document.querySelectorAll('input[name="eSect"]:checked')).map(cb => cb.value);
  root.innerHTML = secteurs.length > 1 ? `
    <label>Répartition précise (facultative)</label>
    <p class="field-hint">Laissez les champs vides pour la répartition automatique. Sinon, renseignez chaque secteur ; leur somme doit correspondre au montant du paiement.</p>
    <div class="form-grid">${secteurs.map(s => `<div class="field"><label>${escapeHtml(s)} (F CFA)</label><input type="number" min="0" step="1" data-montant-secteur="${escapeHtml(s)}" value="${escapeHtml(anciens[s] || "")}" placeholder="Automatique"></div>`).join("")}</div>` : "";
}

// ============================================================
// AUTOCOMPLÉTION DU NOM (recherche dans les dossiers enfants)
// ============================================================
function handleNomInput() {
  selectedEnfantId = null;
  reinitialiserFiltreSecteurs();
  renderRepartitionEntree();
  const valeur = document.getElementById("eNom").value.trim().toLowerCase();
  const box = document.getElementById("eNomSuggestions");

  if (valeur.length < 1) { box.style.display = "none"; return; }

  const correspondances = STATE.enfants
    .filter(e => e.nom.toLowerCase().includes(valeur))
    .slice(0, 8);

  if (correspondances.length === 0) { box.style.display = "none"; return; }

  box.innerHTML = correspondances.map(e => `
    <div class="checkbox-item" style="cursor:pointer; margin-bottom:4px;" data-pick="${e.id}">
      <strong>${escapeHtml(e.nom)}</strong>&nbsp;<span class="text-muted">— ${SECT_LABELS[e.sect] || e.sect}</span>
    </div>`).join("");
  box.style.display = "block";

  box.querySelectorAll("[data-pick]").forEach(el => {
    el.addEventListener("click", () => {
      const enfant = STATE.enfants.find(x => x.id === el.dataset.pick);
      document.getElementById("eNom").value = enfant.nom;
      selectedEnfantId = enfant.id;
      box.style.display = "none";
      document.getElementById("eNomHint").textContent = `Section : ${SECT_LABELS[enfant.sect] || enfant.sect}`;
      filtrerSecteursSelonEnfant(enfant);
    });
  });
}

// ============================================================
// SECTEURS DU FORMULAIRE — TOUJOURS CLIQUABLES
// ============================================================
// On ne grise plus aucun secteur selon la classe de l'enfant : un service
// peut être souscrit ou payé en cours d'année, et un secteur sans poste
// correspondant reçoit un poste à montant libre créé à la volée au moment
// du paiement (voir crediterPosteLibre). C'est ce filtrage qui laissait
// uniquement « Inscription » cliquable pour certains élèves, alors que les
// frais généraux (activités, fêtes, assurance, APE…) sont payables par tous.
function filtrerSecteursSelonEnfant() {
  document.querySelectorAll("#eSecteurs .checkbox-item").forEach(item => {
    const input = item.querySelector("input");
    input.disabled = false;
    item.classList.remove("disabled");
  });
}

// ============================================================
// ORDRE D'IMPUTATION DES SECTEURS COCHÉS
// ============================================================
// Règle métier : d'abord les FRAIS GÉNÉRAUX (fêtes, activités parascolaires,
// APE, inscription, assurance), ENSUITE la scolarité ; quand ceux-ci sont
// réglés seulement ensuite on passe au reste — « ainsi de suite ».
var SECTEURS_PHASE1_FRAIS_GENERAUX = [
  "Fêtes scolaires", "Activités parascolaires", "APE", "Inscription", "Assurance",
  "Scolarité Maternelle", "Scolarité Primaire"
];

// Mensualités : solder les services cochés du mois avant le mois suivant.
// Si le montant est insuffisant, répartir uniquement entre les reliquats
// de ce mois. Petit-déjeuner et déjeuner restent des cibles distinctes.
var SECTEURS_MENSUALITES = [
  "Crèche", "Cantine", "Petit-déjeuner", "Déjeuner", "Cantine crèche", "Goûter", "Garderie"
];

var ORDRE_SECTEURS_ENTREE = [].concat(
  SECTEURS_PHASE1_FRAIS_GENERAUX,
  SECTEURS_MENSUALITES,
  ["Halte-Garderie", "Uniformes", "Fournitures"]
);

// Catégorie de postes ciblée par chaque secteur (postes créés à la volée
// compris, pour les avoir dans le dossier et au bilan).
var SECTEUR_CAT_ALLOCATION = {
  "Fêtes scolaires": "Fêtes scolaires",
  "Activités parascolaires": "Activités parascolaires",
  "APE": "APE",
  "Inscription": "Inscription",
  "Assurance": "Assurance",
  "Scolarité Maternelle": "Scolarité",
  "Scolarité Primaire": "Scolarité",
  "Crèche": "Crèche",
  "Cantine": "Cantine",
  "Petit-déjeuner": "Cantine",
  "Déjeuner": "Cantine",
  "Cantine crèche": "Cantine crèche",
  "Goûter": "Goûter",
  "Garderie": "Garderie",
  "Halte-Garderie": "Halte-Garderie",
  "Uniformes": "Uniformes",
  "Fournitures": "Fournitures"
};

// ============================================================
// SÉLECTION DES POSTES CIBLÉS PAR UN SECTEUR
// ============================================================
// Le Petit-déjeuner et le Déjeuner sont deux secteurs DISTINCTS : un enfant
// peut payer l'un sans l'autre. Ils ciblent les postes `ptdej_*` / `dej_*`
// de la catégorie Cantine ; les mois à effectif réduit (poste fusionné
// `cantine_reduit_*`) sont partagés par les deux services.
function postesDuSecteur(postes, secteur) {
  const ok = p => !p.is_remise && !p.is_var && p.key !== "avance";

  if (secteur === "Petit-déjeuner") {
    return postes.filter(p => ok(p) && p.cat === "Cantine" && (p.key.indexOf("ptdej_") === 0 ||
      (p.key.indexOf("cantine_reduit_") === 0 && !postes.some(x => x.key === `ptdej_reduit_${p.mois}`))));
  }
  if (secteur === "Déjeuner") {
    return postes.filter(p => ok(p) && p.cat === "Cantine" && (p.key.indexOf("dej_") === 0 ||
      (p.key.indexOf("cantine_reduit_") === 0 && !postes.some(x => x.key === `dej_reduit_${p.mois}`))));
  }
  if (secteur === "Cantine") {
    return postes.filter(p => ok(p) && p.cat === "Cantine");
  }
  if (SECT_TO_KEY[secteur]) {
    return postes.filter(p => ok(p) && p.key === SECT_TO_KEY[secteur]);
  }
  const cats = SECT_TO_CAT[secteur];
  if (cats) {
    // Pour la Crèche, Inscription et Assurance ont leurs propres secteurs :
    // un versement « Crèche » ne doit jamais les solder.
    return postes.filter(p => ok(p) && cats.includes(p.cat) && !(p.cat === "Crèche" && (p.key === "inscr" || p.key === "assur")));
  }
  return [];
}

// Poids d'un lot de mensualités pour la répartition proportionnelle :
// somme des montants encore dus sur les postes éligibles, plus le tarif de
// référence d'un mois à effectif réduit non défini que le mois choisi cible.
function poidsMensualite(postes, idxDepart, moisDepart) {
  const MOIS_ORD = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
  let poids = 0;
  postes.forEach(p => {
    if (posteEstAbsent(p)) return;
    if (p.mois && MOIS_ORD.indexOf(p.mois) < idxDepart) return;
    poids += Math.max((p.du || 0) - (p.paye || 0), 0);
    if (p.is_reduit && !(p.du > 0) && moisDepart && moisDepart === p.mois) {
      poids += refPosteReduit(p, postes);
    }
  });
  return poids;
}

// Poste à montant libre du secteur (créé à la volée si absent) : le
// versement y est crédité directement, il n'y a pas de « dû » à solder.
function crediterPosteLibre(postes, secteur, montant, allocations) {
  const cat = SECTEUR_CAT_ALLOCATION[secteur] || secteur;
  const key = `var_${secteur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "")}`;
  let libre = postes.find(p => p.is_var && !p.is_remise && p.cat === cat &&
    (p.key === key || (p.key !== "avance" && p.label === secteur)));
  if (!libre) {
    libre = { key, cat, label: secteur, du: 0, paye: 0, is_var: true };
    postes.push(libre);
  }
  libre.paye = (libre.paye || 0) + montant;
  allocations.push({ poste: libre, montant });
  return montant;
}

function reinitialiserFiltreSecteurs() {
  document.getElementById("eNomHint").textContent = "";
  document.querySelectorAll("#eSecteurs .checkbox-item").forEach(item => {
    item.querySelector("input").disabled = false;
    item.classList.remove("disabled");
  });
}

function resetEntreeForm() {
  document.getElementById("formEntree").reset();
  document.getElementById("eDate").value = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[name="eSect"]').forEach(cb => cb.closest(".checkbox-item").classList.remove("checked"));
  document.getElementById("eNomSuggestions").style.display = "none";
  selectedEnfantId = null;
  reinitialiserFiltreSecteurs();
  renderRepartitionEntree();
}

// ============================================================
// IMPUTATION D'UN PAIEMENT CIBLÉ SUR UNE TRANCHE DE SCOLARITÉ
// Contrairement à la règle générale du "premier poste non soldé", un
// paiement par tranche crédite directement la tranche demandée. Le
// surplus éventuel ne progresse que vers la tranche SUIVANTE (jamais en
// arrière vers une tranche déjà passée) — puis vers l'avance si les 3
// tranches sont soldées.
// ============================================================
function imputerPaiementTranche(postes, montant, trancheDepart) {
  const ORDRE_TRANCHES = ["t1", "t2", "t3"];
  const idxDepart = ORDRE_TRANCHES.indexOf(trancheDepart);
  const allocations = [];
  let reste = montant;

  ORDRE_TRANCHES.forEach((key, i) => {
    if (i < idxDepart || reste <= 0) return;
    const poste = postes.find(p => p.key === key && p.cat === "Scolarité");
    if (!poste) return;
    const manque = Math.max((poste.du || 0) - (poste.paye || 0), 0);
    const versement = Math.min(reste, manque);
    if (versement > 0) {
      poste.paye = (poste.paye || 0) + versement;
      allocations.push({ poste, montant: versement });
      reste -= versement;
    }
  });

  if (reste > 0) {
    let avance = postes.find(p => p.key === "avance" && p.cat === "Scolarité");
    if (!avance) {
      avance = { key: "avance", cat: "Scolarité", label: "Avance / Trop-perçu", du: 0, paye: 0, is_var: true };
      postes.push(avance);
    }
    avance.paye = (avance.paye || 0) + reste;
    allocations.push({ poste: avance, montant: reste });
  }

  return allocations;
}

// ============================================================
// IMPUTATION D'UN PAIEMENT SUR PLUSIEURS SECTEURS
// ============================================================
// Priorité stricte :
//   1. les frais généraux (fêtes → activités → APE → inscription →
//      assurance), puis la scolarité — on ne touche à la scolarité que
//      quand les frais généraux du paiement sont réglés ;
//   2. les mensualités cochées (crèche, cantine, goûter, garderie…)
//      sont soldées mois par mois, à partir du mois choisi ;
//   3. les postes à montant libre (uniformes, fournitures, halte…)
//      partagent ce qui reste à parts égales ;
//   4. le surplus finit en « Avance / Trop-perçu ».
// Retourne la liste des versements effectués : [{ poste, montant }, ...]
// Nécessaire pour pouvoir annuler précisément ce paiement si l'entrée est
// supprimée plus tard (voir openDeleteEntreeModal).
function imputerPaiementMultiSecteur(postes, secteurs, montantTotal, moisDepart, repartition, cibleExplicite = false) {
  if (!Number.isSafeInteger(montantTotal) || montantTotal <= 0) throw new Error("Le montant doit être un nombre entier positif de francs CFA.");
  secteurs = [...new Set(secteurs)];
  postes.forEach(p => { p.du = Number(p.du) || 0; p.paye = Number(p.paye) || 0; });
  if (repartition) {
    if (secteurs.some(s => !Number.isSafeInteger(repartition[s]) || repartition[s] < 0) ||
        Math.abs(secteurs.reduce((s, sect) => s + repartition[sect], 0) - montantTotal) > 0.001) {
      throw new Error("La somme des montants par secteur doit correspondre au paiement.");
    }
    return secteurs.flatMap(sect => repartition[sect] > 0
      ? imputerPaiementMultiSecteur(postes, [sect], repartition[sect], moisDepart, null, true).map(a => ({ ...a, secteur: sect })) : []);
  }
  // Un versement global de scolarité régularise d'abord tous les frais
  // généraux du dossier. Une tranche ou une ventilation explicite reste ciblée.
  if (!cibleExplicite && !["t1", "t2", "t3"].includes(moisDepart) &&
      secteurs.some(s => ["Scolarité Maternelle", "Scolarité Primaire"].includes(s))) {
    secteurs = [...new Set(secteurs.concat(Object.keys(SECT_TO_KEY).filter(s => postesDuSecteur(postes, s).length)))];
  }
  const MOIS_ORD = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
  const idxDepart = (moisDepart && MOIS_ORD.includes(moisDepart)) ? MOIS_ORD.indexOf(moisDepart) : 0;
  let reste = montantTotal;
  const allocations = [];

  const rang = s => { const i = ORDRE_SECTEURS_ENTREE.indexOf(s); return i === -1 ? 999 : i; };
  const tries = secteurs.slice().sort((a, b) => rang(a) - rang(b));

  // Secteurs sans aucun poste « à dû » → traités comme montant libre (étape 3)
  const avecDette = [], sansDette = [];
  tries.forEach(s => (postesDuSecteur(postes, s).length > 0 ? avecDette : sansDette).push(s));

  // ── Étape 1 — frais généraux puis scolarité (priorité stricte) ──
  avecDette.filter(s => SECTEURS_PHASE1_FRAIS_GENERAUX.includes(s)).forEach(sect => {
    if (reste <= 0) return;
    const cibles = postesDuSecteur(postes, sect);

    // Secteur ciblé sur une clé unique (Inscription, Fêtes, Activités, APE,
    // Assurance) : on crédite directement ce poste.
    if (SECT_TO_KEY[sect]) {
      const poste = cibles[0];
      const manque = Math.max((poste.du || 0) - (poste.paye || 0), 0);
      const versement = Math.min(reste, manque);
      if (versement > 0) {
        poste.paye = (poste.paye || 0) + versement;
        allocations.push({ poste, montant: versement });
        reste -= versement;
      }
      return;
    }

    // Scolarité : inscription puis tranches (imputerPaiement), ou paiement
    // ciblé sur une tranche précise (t1/t2/t3).
    const cat = SECTEUR_CAT_ALLOCATION[sect] || sect;
    const manque = cibles.reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
    const allouer = Math.min(reste, manque);
    if (allouer <= 0) return;

    const allocs = (moisDepart === "t1" || moisDepart === "t2" || moisDepart === "t3")
      ? imputerPaiementTranche(postes, allouer, moisDepart)
      : imputerPaiement(postes, cat, allouer, moisDepart);
    allocs.forEach(a => allocations.push(a));
    reste -= allouer;
  });

  // ── Étape 2 — solder les services d'un mois avant le mois suivant ──
  const groupesParCat = {};
  avecDette.filter(s => SECTEURS_MENSUALITES.includes(s)).forEach(sect => {
    const cat = SECTEUR_CAT_ALLOCATION[sect] || sect;
    const cle = sect;
    if (!groupesParCat[cle]) groupesParCat[cle] = { cat, secteur: sect, postes: [] };
    postesDuSecteur(postes, sect).forEach(p => {
      if (!Object.values(groupesParCat).some(g => g.postes.includes(p))) groupesParCat[cle].postes.push(p);
    });
  });
  const groupes = Object.keys(groupesParCat).map(k => groupesParCat[k]);

  // Les anciens postes sans mois conservent leur priorité historique.
  [null, ...MOIS_ORD.slice(idxDepart)].forEach(mois => {
    if (reste <= 0 || groupes.length === 0) return;
    const lots = groupes.map(g => ({ ...g, postes: g.postes.filter(p => (p.mois || null) === mois && !posteEstAbsent(p)) }));
    lots.forEach(g => { g.poids = poidsMensualite(g.postes, idxDepart, moisDepart); });
    const totalPoids = lots.reduce((s, g) => s + g.poids, 0);
    let alloues;

    if (totalPoids <= 0) {
      alloues = lots.map(() => 0);
    } else if (reste >= totalPoids) {
      // Assez pour tout solder : chaque lot reçoit le montant de sa dette.
      alloues = lots.map(g => g.poids);
      reste -= totalPoids;
    } else {
      // Solder un service avant le suivant, sans ventilation proportionnelle.
      // Les montants saisis par secteur restent prioritaires via `repartition`.
      alloues = lots.map(g => { const part = Math.min(reste, g.poids); reste -= part; return part; });
    }

    lots.forEach((g, i) => {
      if (alloues[i] <= 0) return;
      imputerPaiement(postes, g.cat, alloues[i], moisDepart, g.postes)
        .forEach(a => allocations.push({ ...a, secteur: g.secteur }));
    });
  });

  // ── Étape 3 — postes restants : d'abord les dettes fixes, puis le
  // montant libre (parts égales entre les secteurs concernés) ──
  const resteAVirer = tries.filter(s => {
    if (postesDuSecteur(postes, s).length === 0) return true;
    return !SECTEURS_PHASE1_FRAIS_GENERAUX.includes(s) && !SECTEURS_MENSUALITES.includes(s);
  });

  // Dettes fixes non couvertes par les étapes 1 et 2 (ex. uniforme à
  // montant fixe saisi à la création du dossier)
  resteAVirer.forEach(sect => {
    if (reste <= 0) return;
    const cibles = postesDuSecteur(postes, sect);
    if (cibles.length === 0) return;
    const manque = cibles.reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
    const allouer = Math.min(reste, manque);
    if (allouer <= 0) return;
    imputerPaiement(postes, SECTEUR_CAT_ALLOCATION[sect] || sect, allouer, moisDepart)
      .forEach(a => allocations.push(a));
    reste -= allouer;
  });

  // Montant libre (uniformes, fournitures, halte-garderie, secteur sans
  // poste…) : pas de « dû » à répartir, on partage ce qui reste à parts
  // égales entre les secteurs cochés.
  const secteursLibres = resteAVirer.filter(s => postesDuSecteur(postes, s).length === 0);
  if (reste > 0 && secteursLibres.length > 0) {
    const part = Math.floor(reste / secteursLibres.length);
    let ecart = reste - part * secteursLibres.length;
    secteursLibres.forEach(sect => {
      const montantPart = part + (ecart > 0 ? 1 : 0);
      if (ecart > 0) ecart--;
      if (montantPart > 0) crediterPosteLibre(postes, sect, montantPart, allocations);
    });
    reste = 0;
  }

  // Surplus final (aucune dette restante dans les secteurs sélectionnés)
  if (reste > 0) {
    const sectCible = tries[0] || secteurs[0] || "Général";
    const catAvance = SECTEUR_CAT_ALLOCATION[sectCible] || sectCible;
    let avance = postes.find(p => p.key === "avance" && p.cat === catAvance);
    if (!avance) {
      avance = { key: "avance", cat: catAvance, label: "Avance / Trop-perçu", du: 0, paye: 0, is_var: true };
      postes.push(avance);
    }
    avance.paye = (avance.paye || 0) + reste;
    allocations.push({ poste: avance, montant: reste });
  }

  return allocations;
}

// ============================================================
// CORRECTION DES ANCIENNES RÉPARTITIONS MENSUELLES
// ============================================================
// Correction contrôlée d'un ancien paiement couvrant plusieurs services.
function correctionMensuelleEnAttente(enfantId) {
  return STATE.entrees.some(en => en.enfant_id === enfantId && en.allocations?.[0]?.correction?.etat === "a_appliquer");
}

function entreeRepartitionCorrigeable(entree) {
  const secteurs = (entree.sect || "").split(",").map(s => s.trim()).filter(Boolean);
  return !!entree.enfant_id && secteurs.length > 0 &&
    Array.isArray(entree.allocations) && entree.allocations.length > 0 &&
    !entree.allocations.some(a => a.correction?.etat === "a_appliquer");
}

function preparerCorrectionMensuelle(entree, mois, repartition = null) {
  if (!entreeRepartitionCorrigeable(entree)) throw new Error("Ce paiement ne peut pas être corrigé par cette répartition automatique.");
  if (![...MOIS_CRECHE, "t1", "t2", "t3"].includes(mois)) throw new Error("Choisissez le mois ou la tranche réellement payé.");
  const enfant = STATE.enfants.find(e => e.id === entree.enfant_id);
  if (!enfant) throw new Error("Dossier introuvable.");
  if (correctionMensuelleEnAttente(enfant.id)) throw new Error("Une correction attend sa synchronisation. Rechargez la page avant de corriger un autre paiement.");
  const avant = STATE.postes.filter(p => p.enfant_id === enfant.id).map(p => ({ ...p }));
  const postes = avant.map(p => ({ ...p }));
  const montant = Number(entree.mt);
  if (repartition && Object.values(repartition).some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error("Les montants par secteur doivent être des entiers positifs ou nuls.");
  if (entree.allocations.reduce((s, a) => s + Number(a.montant), 0) !== montant) throw new Error("L'historique n'explique pas la totalité du paiement. Une vérification manuelle est nécessaire.");
  entree.allocations.forEach(a => {
    const p = postes.find(p => p.id === a.poste_id);
    const montantAllocation = Number(a.montant);
    if (!p || !Number.isSafeInteger(montantAllocation) || montantAllocation <= 0 || (Number(p.paye) || 0) < montantAllocation) throw new Error("L'historique de ce paiement est incomplet ou incohérent. Aucun montant n'a été modifié.");
    p.paye = Number(p.paye) - montantAllocation;
  });
  const secteurs = repartition ? Object.keys(repartition).filter(s => repartition[s] > 0) : entree.sect.split(",").map(s => s.trim()).filter(Boolean);
  if (!secteurs.length) throw new Error("Indiquez les secteurs et montants réellement payés.");
  const nouvelle = imputerPaiementMultiSecteur(postes, secteurs, montant, mois, repartition);
  postes.forEach(p => { if (!p.id) { p.id = `${enfant.id}_${p.key}_${p.cat}`; p.enfant_id = enfant.id; } });
  const allocations = nouvelle.map(a => ({ poste_id: a.poste.id, montant: a.montant,
    secteur: a.secteur || secteurEnregistrementPoste(a.poste, enfant), poste: { ...a.poste }, methode: "mensuel_v2" }));
  if (allocations.reduce((s, a) => s + a.montant, 0) !== montant) throw new Error("Le montant total doit rester inchangé.");
  const changements = postes.filter(p => {
    const ancien = avant.find(x => x.id === p.id);
    return !ancien || ancien.paye !== p.paye || ancien.du !== p.du;
  }).map(p => ({ avant: avant.find(x => x.id === p.id) || null, apres: { ...p } }));
  if (!changements.length && mois === entree.mois && secteurs.join(", ") === entree.sect) throw new Error("La répartition de ce paiement est déjà correcte pour ce mois.");
  allocations[0].correction = { etat: "a_appliquer", mois_avant: entree.mois,
    allocations_avant: entree.allocations.map(({ correction, ...a }) => a), postes: changements };
  return { mois, sect: secteurs.join(", "), allocations, changements };
}

// Journal durable dans le JSON des allocations : si une écriture échoue,
// le prochain chargement termine la correction sans recréer de paiement.
async function appliquerCorrectionMensuelle(entree) {
  const journal = entree.allocations?.[0]?.correction;
  if (journal?.etat !== "a_appliquer") return;
  const aSauver = journal.postes.map(ch => {
    const p = STATE.postes.find(p => p.id === ch.apres.id);
    const identique = attendu => attendu && p && Number(p.du) === Number(attendu.du) && Number(p.paye) === Number(attendu.paye);
    if (!(identique(ch.avant) || identique(ch.apres) || (!p && !ch.avant))) throw new Error("Un montant a changé pendant la correction. Vérification nécessaire avant de poursuivre.");
    return { ...ch.apres };
  });
  await dbUpsertPostes(aSauver);
  aSauver.forEach(p => {
    const i = STATE.postes.findIndex(x => x.id === p.id);
    if (i < 0) STATE.postes.push(p); else STATE.postes[i] = p;
  });
  const allocations = JSON.parse(JSON.stringify(entree.allocations));
  allocations[0].correction.etat = "appliquee";
  await dbUpdateEntree(entree.id, { allocations });
  entree.allocations = allocations;
}

function openCorrectionMensuelleModal(entreeId) {
  const entree = STATE.entrees.find(en => en.id === entreeId);
  if (!entree) return;
  const moisDate = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][Number((entree.date || "").slice(5, 7)) - 1];
  const choixEcheances = [...MOIS_CRECHE, "t1", "t2", "t3"];
  const moisInitial = choixEcheances.includes(entree.mois) ? entree.mois : (moisDate || "Oct");
  openModal(`
    <div class="modal-title">Corriger la répartition — ${escapeHtml(entree.nom)}</div>
    <p class="modal-text">Paiement du ${formatDateFR(entree.date)} : ${fmtFCFA(entree.mt)}. Vérifiez le mois et les montants proposés. Les paiements saisis séparément sont conservés.</p>
    <div class="field"><label>Mois / tranche réellement payé</label><select id="correctionMois">${choixEcheances.map(m => `<option value="${m}" ${m === moisInitial ? "selected" : ""}>${TRANCHE_LABELS_ENTREE[m] || m}</option>`).join("")}</select></div>
    <details><summary>Ajuster les montants par secteur</summary><p>Laissez tout vide pour la répartition automatique. Sinon, renseignez les montants réellement payés (total : ${fmtFCFA(entree.mt)}). Les secteurs laissés vides reçoivent zéro.</p>${ORDRE_SECTEURS_ENTREE.map(s => `<div class="field"><label>${escapeHtml(s)}</label><input type="number" min="0" step="1" data-correction-secteur="${escapeHtml(s)}" placeholder="0"></div>`).join("")}</details>
    <div id="correctionApercu"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="correctionAnnuler">Annuler</button><button class="btn btn-primary" id="correctionValider">Appliquer la correction</button></div>
  `);
  let proposition;
  const lireRepartition = () => {
    const champs = Array.from(document.querySelectorAll("[data-correction-secteur]"));
    return champs.some(el => el.value !== "") ? Object.fromEntries(champs.map(el => [el.dataset.correctionSecteur, el.value === "" ? 0 : Number(el.value)])) : null;
  };
  const apercu = () => {
    const bouton = document.getElementById("correctionValider");
    try {
      proposition = preparerCorrectionMensuelle(entree, document.getElementById("correctionMois").value, lireRepartition());
      document.getElementById("correctionApercu").innerHTML = `<div style="max-height:40vh;overflow:auto">${proposition.changements.map(ch => `<p><strong>${escapeHtml(ch.apres.label)}</strong><br>Versé : ${fmtFCFA(ch.avant?.paye || 0)} → ${fmtFCFA(ch.apres.paye)}</p>`).join("")}</div><p>Total encaissé conservé : <strong>${fmtFCFA(entree.mt)}</strong>.</p>`;
      bouton.disabled = false;
    } catch (err) { proposition = null; bouton.disabled = true; document.getElementById("correctionApercu").textContent = err.message; }
  };
  apercu();
  document.getElementById("correctionMois").addEventListener("change", apercu);
  document.querySelectorAll("[data-correction-secteur]").forEach(el => el.addEventListener("input", apercu));
  document.getElementById("correctionAnnuler").addEventListener("click", closeModal);
  document.getElementById("correctionValider").addEventListener("click", async ev => {
    if (!proposition || correctionEntreeEnCours || enregistrementEntreeEnCours) return;
    ev.currentTarget.disabled = true;
    correctionEntreeEnCours = true;
    try {
      // Recalculer au dernier moment pour ne pas écraser une saisie récente.
      proposition = preparerCorrectionMensuelle(entree, document.getElementById("correctionMois").value, lireRepartition());
      await dbUpdateEntree(entree.id, { mois: proposition.mois, sect: proposition.sect, allocations: proposition.allocations });
      entree.sect = proposition.sect;
      entree.mois = proposition.mois;
      entree.allocations = proposition.allocations;
      await appliquerCorrectionMensuelle(entree);
      closeModal(); refreshAllTabs(); showToast("Répartition corrigée, montant encaissé inchangé.", "success");
    } catch (err) {
      closeModal(); refreshAllTabs();
      showToast(`${err.message}${correctionMensuelleEnAttente(entree.enfant_id) ? " Correction enregistrée mais synchronisation incomplète : rechargez la page, sans ressaisir le paiement." : " Aucun paiement supplémentaire n'a été enregistré."}`, "error");
    } finally { correctionEntreeEnCours = false; }
  });
}

// Dossiers anciens : recréer les postes standards manquants à partir de
// buildPostes, sans toucher aux montants déjà payés. Le paiement en cours
// les persiste ensuite avec dbUpsertPostes.
function completerPostesEnfant(enfant) {
  const cles = new Set(STATE.postes.filter(p => p.enfant_id === enfant.id).map(p => p.key));
  const attendus = fabriquerPostesEnfant(enfant.id, enfant.sect, enfant.stat, enfant.opt || {});
  const existants = STATE.postes.filter(p => p.enfant_id === enfant.id);
  const manquants = attendus.filter(np => !cles.has(np.key) && !repasReduitHistorique(np, existants));
  if (manquants.length > 0) {
    console.warn(`Postes manquants complétés pour ${enfant.nom} : ${manquants.map(p => p.key).join(", ")}`);
    STATE.postes.push(...manquants);
  }
  return manquants;
}

// ============================================================
// ENREGISTREMENT D'UN PAIEMENT
// ============================================================
async function handleCreateEntree(e) {
  e.preventDefault();
  if (enregistrementEntreeEnCours || correctionEntreeEnCours) return;

  const date = document.getElementById("eDate").value;
  const nom = document.getElementById("eNom").value.trim();
  const montant = parseFloat(document.getElementById("eMontant").value);
  const mode = document.getElementById("eMode").value;
  const moisChoisi = document.getElementById("eMois").value || null;
  const note = document.getElementById("eNote").value.trim();
  const secteurs = Array.from(document.querySelectorAll('input[name="eSect"]:checked')).map(cb => cb.value);
  const moisDate = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][Number(date.slice(5, 7)) - 1];
  const moisDepart = moisChoisi || (secteurs.some(s => SECTEURS_MENSUALITES.includes(s)) ? moisDate : null);
  const champsRepartition = Array.from(document.querySelectorAll("#eRepartition [data-montant-secteur]"));
  const repartition = champsRepartition.some(input => input.value !== "")
    ? Object.fromEntries(champsRepartition.map(input => [input.dataset.montantSecteur, input.value === "" ? NaN : Number(input.value)])) : null;

  if (!date || !nom || !Number.isSafeInteger(montant) || montant <= 0) {
    showToast("Veuillez renseigner la date, le nom et un montant valide.", "error");
    return;
  }
  if (secteurs.length === 0) {
    showToast("Sélectionnez au moins un secteur concerné par ce paiement.", "error");
    return;
  }
  if (repartition && (secteurs.some(s => !Number.isSafeInteger(repartition[s]) || repartition[s] < 0) ||
      Math.abs(secteurs.reduce((s, sect) => s + repartition[sect], 0) - montant) > 0.001)) {
    showToast("Renseignez chaque secteur ; leur somme doit correspondre au montant du paiement.", "error");
    return;
  }

  const enfant = selectedEnfantId
    ? STATE.enfants.find(x => x.id === selectedEnfantId)
    : STATE.enfants.find(x => x.nom.toLowerCase() === nom.toLowerCase());

  if (enfant && correctionMensuelleEnAttente(enfant.id)) {
    showToast("Une correction de répartition attend sa synchronisation. Rechargez la page avant de saisir un autre paiement.", "error");
    return;
  }

  // Les secteurs sont imputés et enregistrés dans l'ordre de priorité :
  // frais généraux d'abord, puis scolarité, puis mensualités, puis montant
  // libre (voir ORDRE_SECTEURS_ENTREE). Les mois à effectif réduit ne
  // bloquent plus le paiement : un versement ciblé sur un tel mois en fixe
  // automatiquement le montant (voir imputerPaiement, postes.js).
  secteurs.sort((a, b) => {
    const ia = ORDRE_SECTEURS_ENTREE.indexOf(a);
    const ib = ORDRE_SECTEURS_ENTREE.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const entree = {
    id: uid("ent"), date, nom, enfant_id: enfant ? enfant.id : null,
    sect: secteurs.join(", "), mois: moisDepart, mt: montant, mode, note: note || null,
    allocations: []
  };

  let detailCible = "";
  const postesAvant = STATE.postes.map(p => ({ ...p }));
  let entreeEnregistree = false;
  enregistrementEntreeEnCours = true;
  const bouton = document.querySelector('#formEntree button[type="submit"]');
  if (bouton) bouton.disabled = true;

  try {
    let postesEnfant = [];

    if (enfant) {
      // Complète d'abord les postes standards absents du dossier (frais
      // généraux non générés par une version antérieure du logiciel…) :
      // sans eux, les secteurs correspondants n'auraient rien à créditer.
      completerPostesEnfant(enfant);
      postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id).map(p => ({ ...p }));
      const allocations = imputerPaiementMultiSecteur(postesEnfant, secteurs, montant, moisDepart, repartition);

      // Notifie le versé/restant de l'échéance ciblée (mois ou tranche) —
      // utile surtout quand le paiement ne la solde pas entièrement.
      if (moisDepart && allocations.length > 0) {
        const posteCible = allocations.map(a => a.poste).find(p => p.mois === moisDepart || p.key === moisDepart)
          || postesEnfant.find(p => (p.mois === moisDepart || p.key === moisDepart) && !p.is_var && !p.is_remise);
        if (posteCible) {
          const resteCible = Math.max((posteCible.du || 0) - (posteCible.paye || 0), 0);
          const labelCible = TRANCHE_LABELS_ENTREE[moisDepart] || moisDepart;
          detailCible = resteCible > 0
            ? ` ${labelCible} : versé ${fmtFCFA(posteCible.paye)}, restant à solder ${fmtFCFA(resteCible)}.`
            : ` ${labelCible} entièrement soldée.`;
        }
      }

      // Les nouveaux postes "Avance" créés pendant l'imputation n'ont pas
      // encore d'identifiant : on les rattache avant de les persister
      postesEnfant.forEach(p => {
        if (!p.id) {
          p.id = uid("pst");
          p.enfant_id = enfant.id;
        }
      });

      // Trace précisément quel poste a reçu quoi, pour pouvoir annuler
      // ce paiement proprement si l'entrée est supprimée plus tard.
      entree.allocations = allocations.map(a => ({ poste_id: a.poste.id, montant: a.montant,
        secteur: a.secteur || secteurEnregistrementPoste(a.poste, enfant), poste: { ...a.poste },
        methode: "mensuel_v2", repartition_explicit: !!repartition }));
    }

    await dbInsertEntree(entree);
    entreeEnregistree = true;

    if (enfant) {
      await dbUpsertPostes(postesEnfant);
      // Aucun envoi WhatsApp automatique ici : une fois toutes les entrées
      // saisies pour l'enfant, utilisez le bouton "Envoyer bilan WhatsApp"
      // de son dossier (onglet Dossiers enfants ou onglet WhatsApp).
    }
    STATE.entrees.unshift(entree);
    if (enfant) STATE.postes = STATE.postes.filter(p => p.enfant_id !== enfant.id).concat(postesEnfant);

    resetEntreeForm();
    refreshAllTabs();
    showToast(`Paiement de ${fmtFCFA(montant)} enregistré avec succès.${detailCible}`, "success");

    if (enfant) openConfirmerEnvoiRecuModal(enfant, entree);
  } catch (err) {
    console.error(err);
    STATE.postes = postesAvant;
    if (entreeEnregistree) {
      // Le paiement est déjà reçu en base : ne pas proposer de le saisir
      // une seconde fois si seule la mise à jour du dossier a échoué.
      STATE.entrees.unshift(entree);
      resetEntreeForm();
      refreshAllTabs();
      showToast("Paiement enregistré, mais le dossier n’a pas pu être mis à jour. Ne ressaisissez pas le paiement ; rechargez pour synchroniser.", "error");
      return;
    }
    showToast("Erreur lors de l'enregistrement du paiement : " + err.message, "error");
  } finally {
    enregistrementEntreeEnCours = false;
    if (bouton) bouton.disabled = false;
  }
}

// Propose d'envoyer le reçu de versement par WhatsApp juste après
// l'enregistrement d'un paiement — envoi uniquement du reçu de ce paiement
function openConfirmerEnvoiRecuModal(enfant, entree) {
  openModal(`
    <div class="modal-title">Envoyer le reçu par WhatsApp ?</div>
    <div class="modal-text">Le paiement de <strong>${escapeHtml(enfant.nom)}</strong> (${fmtFCFA(entree.mt)}) a bien été enregistré. Voulez-vous envoyer le reçu de versement au parent sur WhatsApp ?</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalNon">Non</button>
      <button class="btn btn-whatsapp" id="modalOui" ${enfant.tel ? "" : "disabled"} title="${enfant.tel ? "" : "Aucun numéro WhatsApp enregistré"}"><i class="bi bi-whatsapp"></i> Oui, envoyer le reçu</button>
    </div>
  `);
  document.getElementById("modalNon").addEventListener("click", closeModal);
  document.getElementById("modalOui").addEventListener("click", () => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
    ouvrirModeleParent(enfant, "recu_paiement", { entree });
  });
}

// ============================================================
// RENDU DE L'HISTORIQUE DES ENTRÉES
// ============================================================
// Mini-bilan en haut de l'onglet : total encaissé, nombre d'opérations, et
// les 3 secteurs qui ont le plus rapporté — pour un coup d'œil rapide sans
// devoir aller sur Bilans secteurs.
function renderEntreesMetrics() {
  const root = document.getElementById("entreesMetrics");
  if (!root) return;

  const total = STATE.entrees.reduce((s, e) => s + (Number(e.mt) || 0), 0);
  const recettesParSecteur = calculerRecettesParSecteur(true);
  const ventilation = document.getElementById("entreesVentilation");
  if (ventilation) {
    const secteurs = Object.entries(recettesParSecteur).sort((a, b) => b[1] - a[1]);
    majCompteurListe(ventilation, secteurs.length);
    ventilation.innerHTML = secteurs.length ? secteurs.map(([sect, mt]) =>
      `<div class="poste-row"><div class="poste-label">${escapeHtml(sect)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>`).join("")
      : '<p class="text-muted">Aucun encaissement enregistré.</p>';
  }
  const topSecteurs = Object.entries(recettesParSecteur)
    .sort((a, b) => b[1] - a[1]).slice(0, 3);

  const tuilesSecteurs = topSecteurs.map(([sect, mt], i) => {
    const couleurs = ["metric-navy", "metric-lime", "metric-gold"];
    return `<div class="metric-card ${couleurs[i] || "metric-navy"}"><div class="metric-label">${escapeHtml(sect)}</div><div class="metric-value small">${fmtFCFA(mt)}</div></div>`;
  }).join("");

  root.innerHTML = `
    <div class="metric-card metric-green"><div class="metric-label">Total entrées</div><div class="metric-value">${fmtFCFA(total)}</div></div>
    <div class="metric-card metric-navy"><div class="metric-label">Opérations</div><div class="metric-value">${STATE.entrees.length}</div></div>
    ${tuilesSecteurs}
  `;
}

function renderEntreesList() {
  const tbody = document.getElementById("entreesList");
  if (!tbody) return;

  renderEntreesMetrics();

  const liste = STATE.entrees.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  majCompteurListe(tbody, liste.length);

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aucun paiement enregistré pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(en => {
    const enfant = en.enfant_id ? STATE.enfants.find(x => x.id === en.enfant_id) : null;
    return `
    <tr>
      <td>${formatDateFR(en.date)}</td>
      <td>${escapeHtml(en.nom)}</td>
      <td>${escapeHtml(en.sect || "—")}</td>
      <td>${TRANCHE_LABELS_ENTREE[en.mois] || en.mois || "—"}</td>
      <td><strong>${fmtFCFA(en.mt)}</strong></td>
      <td>${escapeHtml(en.mode)}</td>
      <td>
        ${enfant ? `<button class="btn btn-whatsapp btn-sm" data-wa-entree="${en.id}" ${enfant.tel ? "" : "disabled"} title="Envoyer le reçu de paiement par WhatsApp"><i class="bi bi-whatsapp"></i></button>` : ""}
        ${entreeRepartitionCorrigeable(en) ? `<button class="btn btn-secondary btn-sm" data-edit-repartition="${escapeHtml(en.id)}" title="Corriger la répartition"><i class="bi bi-pencil"></i></button>` : ""}
        <button class="btn btn-danger btn-sm" data-del-entree="${en.id}" title="Supprimer"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-del-entree]").forEach(btn => {
    btn.addEventListener("click", () => openDeleteEntreeModal(btn.dataset.delEntree));
  });
  tbody.querySelectorAll("[data-edit-repartition]").forEach(btn => btn.addEventListener("click", () => openCorrectionMensuelleModal(btn.dataset.editRepartition)));

  tbody.querySelectorAll("[data-wa-entree]").forEach(btn => {
    btn.addEventListener("click", () => {
      const en = STATE.entrees.find(x => x.id === btn.dataset.waEntree);
      const enfant = en && en.enfant_id ? STATE.enfants.find(x => x.id === en.enfant_id) : null;
      if (!enfant) return;
      const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
      ouvrirModeleParent(enfant, "recu_paiement", { entree: en });
    });
  });
}

function openDeleteEntreeModal(entreeId) {
  const aSupprimer = STATE.entrees.find(en => en.id === entreeId);
  if (correctionEntreeEnCours || (aSupprimer && correctionMensuelleEnAttente(aSupprimer.enfant_id))) { showToast("Rechargez la page pour terminer la correction avant de supprimer ce paiement.", "error"); return; }
  const entree = STATE.entrees.find(e => e.id === entreeId);
  if (!entree) return;

  const aDesAllocations = Array.isArray(entree.allocations) && entree.allocations.length > 0;
  const texteAvertissement = aDesAllocations
    ? "Les montants correspondants seront automatiquement retirés du dossier de l'enfant."
    : "Ce paiement a été enregistré avant la mise à jour du logiciel : les montants déjà crédités sur le dossier de l'enfant ne pourront pas être retirés automatiquement — ajustez le dossier manuellement si nécessaire.";

  confirmModal({
    titre: "Supprimer ce paiement ?",
    texte: `Le paiement de <strong>${fmtFCFA(entree.mt)}</strong> du ${formatDateFR(entree.date)} pour <strong>${escapeHtml(entree.nom)}</strong> sera supprimé de l'historique. ${texteAvertissement}`,
    labelConfirmer: "Supprimer",
    onConfirm: async () => {
      try {
        const postesTouches = [];
        const originaux = [];
        (entree.allocations || []).forEach(a => {
          const poste = STATE.postes.find(p => p.id === a.poste_id);
          if (poste) {
            let copie = postesTouches.find(p => p.id === poste.id);
            if (!copie) {
              copie = { ...poste };
              postesTouches.push(copie);
              originaux.push({ ...poste });
            }
            copie.paye = Math.max((copie.paye || 0) - (Number(a.montant) || 0), 0);
          }
        });
        if (postesTouches.length > 0) await dbUpsertPostes(postesTouches);

        try {
          await dbDeleteEntree(entree.id);
        } catch (err) {
          // Si la suppression de l'entrée échoue, rétablir ses crédits.
          if (originaux.length > 0) await dbUpsertPostes(originaux);
          throw err;
        }
        postesTouches.forEach(copie => {
          const poste = STATE.postes.find(p => p.id === copie.id);
          if (poste) Object.assign(poste, copie);
        });
        STATE.entrees = STATE.entrees.filter(e => e.id !== entree.id);
        refreshAllTabs();
        showToast(
          aDesAllocations ? "Paiement supprimé et dossier de l'enfant mis à jour." : "Paiement supprimé de l'historique.",
          "success"
        );
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la suppression : " + err.message, "error");
      }
    }
  });
}
