// ============================================================
// postes.js — Constantes scolaires + moteur de facturation
// C'est le cœur du logiciel : génération des postes financiers,
// imputation des paiements, détection des retards.
// ============================================================

// ---------- Sections de l'école ----------
var SECT_LABELS = {
  creche:   "Crèche",
  garderie: "Garderie midi",
  premat:   "Prématernelle",
  mat1:     "Maternelle 1",
  mat2:     "Maternelle 2",
  ci:       "CI",
  cp:       "CP",
  ce1:      "CE1",
  ce2:      "CE2",
  cm1:      "CM1"
};

var CRECHE_SECTS = ["creche"];
var MAT_SECTS    = ["premat", "mat1", "mat2"];
var PRIM_SECTS   = ["ci", "cp", "ce1", "ce2", "cm1"];
// "garderie" est une section indépendante — ni crèche, ni mat, ni prim
// CM2 n'existe pas encore à l'école (2026-2027) — à réintroduire ici et
// dans PRIM_SECTS/ACT/SECT_LABELS le jour où le niveau ouvrira.

// ---------- Mois de l'année scolaire ----------
var MOIS        = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun"];
var MOIS_CRECHE = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];

// Échéance commune (le 5 de chaque mois) pour la cantine, le goûter et la
// garderie midi — reprend le mois scolaire (Sep → Jun).
var MOIS_DL_5 = {
  "Sep":"05/09","Oct":"05/10","Nov":"05/11","Déc":"05/12",
  "Jan":"05/01","Fév":"05/02","Mar":"05/03","Avr":"05/04","Mai":"05/05","Jun":"05/06"
};

// ---------- Activités parascolaires (montants annuels) ----------
var ACT = {
  premat:4000, mat1:12000, mat2:12000,
  ci:15000, cp:15000, ce1:20000, ce2:20000, cm1:20000
};

// Niveaux où la scolarité annuelle est majorée (95 000 F au lieu de
// 90 000 F, soit une tranche 1 à 40 000 F au lieu de 35 000 F) — d'après
// la fiche tarifaire officielle : Prématernelle et CM1.
var SCOL_MAJOREE = ["premat", "cm1"];

// Catégories des services ponctuels de la crèche — regroupées visuellement
// sous "Crèche" dans le dossier de l'enfant et le bilan WhatsApp.
var PONCTUEL_CRECHE_CATS = ["Halte-garderie", "Journée du samedi", "Nuitée"];

// ============================================================
// GÉNÉRATION DES POSTES FINANCIERS
// ============================================================
function buildPostes(sect, stat, opt) {
  const s = stat;
  const p = [];

  // ── CRÈCHE (bébés 2 mois → 2 ans) ─────────────────────────
  if (sect === "creche") {
    p.push({ key:"inscr",   cat:"Crèche",  label:"Inscription annuelle",  du:15000, paye:0, dl:"19/10" });
    p.push({ key:"assur",   cat:"Crèche",  label:"Assurance annuelle",    du:3000,  paye:0, dl:"19/10" });
    const moisDlC = {
      "Sep":"05/09","Oct":"05/10","Nov":"05/11","Déc":"05/12",
      "Jan":"05/01","Fév":"05/02","Mar":"05/03","Avr":"05/04",
      "Mai":"05/05","Jun":"05/06","Jul":"05/07","Aoû":"05/08"
    };
    MOIS_CRECHE.forEach(m => {
      p.push({ key:`mens_${m}`, cat:"Crèche", label:`Mensualité ${m}`,
               du:30000, paye:0, mois:m, dl:moisDlC[m] });
    });
    if (opt.cantC === "oui") {
      MOIS_CRECHE.forEach(m => {
        p.push({ key:`cantc_${m}`, cat:"Cantine crèche", label:`Cantine crèche ${m}`,
                 du:13000, paye:0, mois:m });
      });
    }
    // Services ponctuels de la crèche : tarif journalier, pas de mensualité
    // fixe — facturés au cas par cas via une entrée libre (montant saisi
    // manuellement selon le nombre de jours/nuits consommés).
    if (opt.halte  === "oui") p.push({ key:"halte",  cat:"Halte-garderie",       label:"Halte-garderie (3 000 F / jour)",       du:0, paye:0, is_var:true });
    if (opt.samedi === "oui") p.push({ key:"samedi", cat:"Journée du samedi",    label:"Journée du samedi (3 500 F / jour)",    du:0, paye:0, is_var:true });
    if (opt.nuitee === "oui") p.push({ key:"nuitee", cat:"Nuitée",               label:"Nuitée (3 500 F / nuit)",               du:0, paye:0, is_var:true });
  }

  // ── GARDERIE MIDI (Mat/Prim qui restent le midi) ────────────
  else if (sect === "garderie") {
    p.push({ key:"inscr",  cat:"Scolarité", label:"Inscription",              du:s==="nouveau"?12000:10000, paye:0, dl:"19/10" });
    p.push({ key:"act",    cat:"Activités parascolaires", label:"Activités parascolaires", du:4000, paye:0, dl:"19/10" });
    p.push({ key:"assur",  cat:"Assurance", label:"Assurance",                du:2000, paye:0, dl:"19/10" });
    p.push({ key:"ape",    cat:"APE",       label:"APE",                      du:2500, paye:0, dl:"19/10" });
    const moisDlG = {
      "Sep":"05/09","Oct":"05/10","Nov":"05/11","Déc":"05/12",
      "Jan":"05/01","Fév":"05/02","Mar":"05/03","Avr":"05/04","Mai":"05/05","Jun":"05/06"
    };
    MOIS.forEach(m => {
      p.push({ key:`gard_${m}`, cat:"Garderie", label:`Garderie midi ${m}`,
               du:3000, paye:0, mois:m, dl:moisDlG[m] });
    });
  }

  // ── MATERNELLE (Prémat, Mat1, Mat2) ────────────────────────
  else if (MAT_SECTS.includes(sect)) {
    const t1Mat = SCOL_MAJOREE.includes(sect) ? 40000 : 35000;
    p.push({ key:"inscr", cat:"Scolarité", label:"Inscription / Réinscription",
             du:s==="nouveau"?12000:10000, paye:0, dl:"19/10" });
    p.push({ key:"t1", cat:"Scolarité", label:"Tranche 1 scolarité", du:t1Mat, paye:0, dl:"19/10" });
    p.push({ key:"t2", cat:"Scolarité", label:"Tranche 2 scolarité", du:30000, paye:0, dl:"07/12" });
    p.push({ key:"t3", cat:"Scolarité", label:"Tranche 3 scolarité", du:25000, paye:0, dl:"05/02" });
    p.push({ key:"act",   cat:"Activités parascolaires", label:"Activités parascolaires", du:ACT[sect]||12000, paye:0, dl:"19/10" });
    p.push({ key:"fetes", cat:"Fêtes scolaires",         label:"Fêtes scolaires",         du:12000, paye:0, dl:"07/12" });
    p.push({ key:"assur", cat:"Assurance",               label:"Assurance",               du:2000,  paye:0, dl:"19/10" });
    p.push({ key:"ape",   cat:"APE",                     label:"APE",                     du:2500,  paye:0, dl:"19/10" });
    if (opt.ptdej === "oui") MOIS.forEach(m => p.push({ key:`ptdej_${m}`, cat:"Cantine", label:`Petit-déjeuner ${m}`, du:5000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
    if (opt.dej   === "oui") MOIS.forEach(m => p.push({ key:`dej_${m}`,   cat:"Cantine", label:`Déjeuner ${m}`,       du:9000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
    if (opt.gout  === "oui") MOIS.forEach(m => p.push({ key:`gout_${m}`,  cat:"Goûter",  label:`Goûter ${m}`,         du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
    if (opt.gard  === "oui") MOIS.forEach(m => p.push({ key:`gard_${m}`,  cat:"Garderie",label:`Garderie midi ${m}`,  du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
  }

  // ── PRIMAIRE (CI → CM1) ─────────────────────────────────────
  else if (PRIM_SECTS.includes(sect)) {
    const t1Prim = SCOL_MAJOREE.includes(sect) ? 40000 : 35000;
    p.push({ key:"inscr", cat:"Scolarité", label:"Inscription / Réinscription",
             du:s==="nouveau"?12000:10000, paye:0, dl:"19/10" });
    p.push({ key:"t1", cat:"Scolarité", label:"Tranche 1 scolarité", du:t1Prim, paye:0, dl:"19/10" });
    p.push({ key:"t2", cat:"Scolarité", label:"Tranche 2 scolarité", du:30000, paye:0, dl:"07/12" });
    p.push({ key:"t3", cat:"Scolarité", label:"Tranche 3 scolarité", du:25000, paye:0, dl:"05/02" });
    p.push({ key:"act",   cat:"Activités parascolaires", label:"Activités parascolaires", du:ACT[sect]||15000, paye:0, dl:"19/10" });
    p.push({ key:"fetes", cat:"Fêtes scolaires",         label:"Fêtes scolaires",         du:12000, paye:0, dl:"07/12" });
    p.push({ key:"assur", cat:"Assurance",               label:"Assurance",               du:2000,  paye:0, dl:"19/10" });
    p.push({ key:"ape",   cat:"APE",                     label:"APE",                     du:2500,  paye:0, dl:"19/10" });
    // Le goûter est réservé à la Maternelle sur la fiche tarifaire officielle
    if (opt.ptdej === "oui") MOIS.forEach(m => p.push({ key:`ptdej_${m}`, cat:"Cantine", label:`Petit-déjeuner ${m}`, du:5000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
    if (opt.dej   === "oui") MOIS.forEach(m => p.push({ key:`dej_${m}`,   cat:"Cantine", label:`Déjeuner ${m}`,       du:9000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
    if (opt.gard  === "oui") MOIS.forEach(m => p.push({ key:`gard_${m}`,  cat:"Garderie",label:`Garderie midi ${m}`,  du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
  }

  // ── UNIFORMES (tous niveaux sauf crèche, montant libre — pas de tarif
  //    fixe sur la fiche officielle, disponibles au secrétariat) ────────
  if (opt.unif === "oui" && sect !== "creche") {
    p.push({ key:"unif", cat:"Uniformes", label:"Uniformes (tenue scolaire et sport)", du:0, paye:0, is_var:true });
  }

  // ── FOURNITURES (montant libre) ────────────────────────────
  if (opt.four === "oui") {
    p.push({ key:"four", cat:"Fournitures", label:"Fournitures scolaires", du:0, paye:0, is_var:true });
  }

  // ── REMISE (si accordée) ───────────────────────────────────
  if (opt.remise && parseFloat(opt.remise) > 0) {
    p.push({
      key:"remise", cat:opt.remiseCible||"Scolarité",
      label:`Remise accordée (${opt.remiseCible||"Scolarité"})`,
      du:0, paye:parseFloat(opt.remise), is_remise:true
    });
  }

  return p;
}

// ============================================================
// MAPPING SECTEUR (UI) → POSTES CIBLÉS
// ============================================================
var SECT_TO_KEY = {
  "Inscription":             "inscr",
  "Activités parascolaires": "act",
  "Fêtes scolaires":         "fetes",
  "Assurance":               "assur",
  "APE":                     "ape"
};

var SECT_TO_CAT = {
  "Scolarité Maternelle":    ["Scolarité"],
  "Scolarité Primaire":      ["Scolarité"],
  "Crèche":                  ["Crèche"],
  "Cantine":                 ["Cantine"],
  "Cantine crèche":          ["Cantine crèche"],
  "Goûter":                  ["Goûter"],
  "Uniformes":               ["Uniformes"],
  "Fournitures":             ["Fournitures"],
  "Halte-garderie":          ["Halte-garderie"],
  "Journée du samedi":       ["Journée du samedi"],
  "Nuitée":                  ["Nuitée"]
};

// ============================================================
// IMPUTATION D'UN PAIEMENT (règle du premier mois non soldé)
// ============================================================
// Retourne la liste des versements effectués : [{ poste, montant }, ...]
// Chaque entrée permet de retrouver précisément quel poste a reçu quoi,
// afin de pouvoir annuler l'opération si le paiement est supprimé.
function imputerPaiement(postes, cat, montant, moisDepart) {
  const MOIS_ORD = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
  const idxDepart = moisDepart ? MOIS_ORD.indexOf(moisDepart) : 0;
  const allocations = [];

  const cibles = postes
    .filter(p => p.cat === cat && !p.is_var && !p.is_remise && p.key !== "avance")
    .sort((a, b) => {
      const ai = a.mois ? MOIS_ORD.indexOf(a.mois) : -1;
      const bi = b.mois ? MOIS_ORD.indexOf(b.mois) : -1;
      return ai - bi;
    });

  const premierNonSolde = cibles.find(p => (p.paye || 0) < p.du);
  const debut = premierNonSolde
    ? Math.min(MOIS_ORD.indexOf(premierNonSolde.mois), idxDepart >= 0 ? idxDepart : Infinity)
    : idxDepart;

  let reste = montant;
  cibles.forEach(p => {
    if (p.mois && MOIS_ORD.indexOf(p.mois) < debut) return;
    if (reste <= 0) return;
    const manque = p.du - (p.paye || 0);
    if (manque > 0) {
      const versement = Math.min(reste, manque);
      p.paye = (p.paye || 0) + versement;
      allocations.push({ poste: p, montant: versement });
      reste -= versement;
    }
  });

  // Surplus non réparti → poste "Avance" (jamais sur postes[0])
  if (reste > 0) {
    let avance = postes.find(p => p.key === "avance" && p.cat === cat);
    if (!avance) {
      avance = { key:"avance", cat, label:"Avance / Trop-perçu", du:0, paye:0 };
      postes.push(avance);
    }
    avance.paye = (avance.paye || 0) + reste;
    allocations.push({ poste: avance, montant: reste });
  }
  return allocations;
}

// ============================================================
// TOTAUX FINANCIERS
// ============================================================
function tDu(postes) {
  return postes.filter(p => !p.is_remise).reduce((s, p) => s + (Number(p.du) || 0), 0);
}
function tPaye(postes) {
  return postes.filter(p => !p.is_remise).reduce((s, p) => s + (Number(p.paye) || 0), 0);
}
function tRemise(postes) {
  return postes.filter(p => p.is_remise).reduce((s, p) => s + (Number(p.paye) || 0), 0);
}
function tReste(postes) {
  return Math.max(tDu(postes) - tPaye(postes) - tRemise(postes), 0);
}

// Statut global de paiement d'un enfant : solde / partiel / impaye
function statutPaiement(postes) {
  const reste = tReste(postes);
  const paye = tPaye(postes);
  if (reste <= 0) return "solde";
  if (paye > 0) return "partiel";
  return "impaye";
}

// ============================================================
// DÉTECTION DES RETARDS
// ============================================================
function dlPassed(dl) {
  if (!dl) return false;
  const [jour, mois] = dl.split("/").map(Number);
  const annee = mois >= 9 ? 2026 : 2027;
  return new Date() > new Date(annee, mois - 1, jour);
}

function posteEnRetard(p) {
  if (!p || p.is_var || p.is_remise) return false;
  if ((p.paye || 0) >= p.du) return false;

  const today = new Date();
  const grace = new Date(2026, 8, 21); // 7 jours de grâce après la rentrée (14/09/2026)

  if (["inscr", "act", "assur", "ape"].includes(p.key)) {
    return today > grace;
  }
  if (["t1", "t2", "t3"].includes(p.key)) return p.dl ? dlPassed(p.dl) : false;
  return p.dl ? dlPassed(p.dl) : false;
}

function enfantEnRetard(postes) {
  return postes.some(p => posteEnRetard(p));
}

// Regroupe les postes en retard par catégorie, avec le montant manquant
function posteRetardsDetail(postes) {
  return postes
    .filter(p => posteEnRetard(p))
    .map(p => ({ cat: p.cat, label: p.label, manque: (p.du || 0) - (p.paye || 0) }));
}
