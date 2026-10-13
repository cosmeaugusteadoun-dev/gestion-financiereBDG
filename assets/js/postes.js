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
var PONCTUEL_CRECHE_CATS = ["Halte-Garderie"];

// Mois à effectif réduit pour la cantine/le goûter : rentrée le 14
// septembre (l'enfant n'est là que la moitié du mois), deux semaines de
// congé de Pâques en mars, deux dernières semaines de cours seulement en
// juin. Le tarif mensuel plein ne s'applique pas — le montant dû est
// saisi manuellement une fois la fréquentation réelle connue (voir
// enfants.js, poste "is_reduit").
var MOIS_CANTINE_REDUITS = ["Mar", "Jun", "Sep"];

// ============================================================
// GÉNÉRATION DES POSTES FINANCIERS
// ============================================================
function buildPostes(sect, stat, opt) {
  opt = opt || {};
  const s = stat;
  const p = [];

  // ── CRÈCHE (bébés 2 mois → 2 ans) ─────────────────────────
  if (sect === "creche") {
    p.push({ key:"inscr",   cat:"Inscription",  label:"Inscription annuelle",  du:15000, paye:0, dl:"19/10" });
    p.push({ key:"assur",   cat:"Assurance",    label:"Assurance annuelle",    du:3000,  paye:0, dl:"19/10" });
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
      MOIS_CRECHE.filter(m => !MOIS_CANTINE_REDUITS.includes(m)).forEach(m => {
        p.push({ key:`cantc_${m}`, cat:"Cantine crèche", label:`Cantine crèche ${m}`,
                 du:13000, paye:0, mois:m, dl:moisDlC[m] });
      });
      MOIS_CANTINE_REDUITS.forEach(m => {
        p.push({ key:`cantc_reduit_${m}`, cat:"Cantine crèche",
                 label:`Cantine crèche ${m} (effectif réduit — montant à définir)`,
                 du:0, paye:0, mois:m, dl:moisDlC[m], is_reduit:true });
      });
    }
    // Halte-garderie, journée du samedi, nuitée : un seul poste combiné —
    // tarif journalier, pas de mensualité fixe, facturé au cas par cas via
    // une entrée libre, quel que soit celui des trois services consommé.
    if (opt.halte === "oui") {
      p.push({ key:"halte", cat:"Halte-Garderie",
               label:"Halte-garderie / Samedi / Nuitée (3 000-3 500 F selon le cas)",
               du:0, paye:0, is_var:true });
    }
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
    const moisCantinePleins = MOIS.filter(m => !MOIS_CANTINE_REDUITS.includes(m));
    if (opt.ptdej === "oui" || opt.dej === "oui") {
      if (opt.ptdej === "oui") moisCantinePleins.forEach(m => p.push({ key:`ptdej_${m}`, cat:"Cantine", label:`Petit-déjeuner ${m}`, du:5000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
      if (opt.dej   === "oui") moisCantinePleins.forEach(m => p.push({ key:`dej_${m}`,   cat:"Cantine", label:`Déjeuner ${m}`,       du:9000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
      ajouterRepasReduits(p, opt);
    }
    // Le goûter est une catégorie à part entière (bilans, Entrées, Sorties)
    // — seul le dossier de l'enfant continue de l'afficher regroupé avec
    // la Cantine, par choix d'affichage (voir enfants.js, catAffichage).
    if (opt.gout === "oui") {
      moisCantinePleins.forEach(m => p.push({ key:`gout_${m}`, cat:"Goûter", label:`Goûter ${m}`, du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
      MOIS_CANTINE_REDUITS.forEach(m => p.push({ key:`gout_reduit_${m}`, cat:"Goûter",
               label:`Goûter ${m} (effectif réduit — montant à définir)`,
               du:0, paye:0, mois:m, dl:MOIS_DL_5[m], is_reduit:true }));
    }
    // Garderie de midi : automatiquement incluse dès que le Déjeuner est
    // souscrit (l'enfant reste forcément sur place à midi), et disponible
    // seule pour les enfants qui apportent leur repas mais restent le midi.
    // Contrairement à la cantine, son tarif reste fixe même en mois réduit.
    if (opt.dej === "oui" || opt.gard === "oui") MOIS.forEach(m => p.push({ key:`gard_${m}`, cat:"Garderie", label:`Garderie midi ${m}`, du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
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
    const moisCantinePleinsPrim = MOIS.filter(m => !MOIS_CANTINE_REDUITS.includes(m));
    if (opt.ptdej === "oui" || opt.dej === "oui") {
      if (opt.ptdej === "oui") moisCantinePleinsPrim.forEach(m => p.push({ key:`ptdej_${m}`, cat:"Cantine", label:`Petit-déjeuner ${m}`, du:5000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
      if (opt.dej   === "oui") moisCantinePleinsPrim.forEach(m => p.push({ key:`dej_${m}`,   cat:"Cantine", label:`Déjeuner ${m}`,       du:9000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
      ajouterRepasReduits(p, opt);
    }
    if (opt.gout === "oui") MOIS.forEach(m => p.push({
      key: MOIS_CANTINE_REDUITS.includes(m) ? `gout_reduit_${m}` : `gout_${m}`,
      cat:"Goûter", label:`Goûter ${m}`, du:MOIS_CANTINE_REDUITS.includes(m) ? 0 : 3000,
      paye:0, mois:m, dl:MOIS_DL_5[m], is_reduit:MOIS_CANTINE_REDUITS.includes(m)
    }));
    // Garderie de midi : automatiquement incluse dès que le Déjeuner est
    // souscrit (l'enfant reste forcément sur place à midi), et disponible
    // seule pour les enfants qui apportent leur repas mais restent le midi.
    if (opt.dej === "oui" || opt.gard === "oui") MOIS.forEach(m => p.push({ key:`gard_${m}`, cat:"Garderie", label:`Garderie midi ${m}`, du:3000, paye:0, mois:m, dl:MOIS_DL_5[m] }));
  }

  // ── UNIFORMES (tous niveaux sauf crèche) ────────────────────
  // Montant libre saisi manuellement (tissu complet, demi-tissu, haut seul, bas seul...)
  if (sect !== "creche") {
    const montantUnif = parseFloat(opt.montantUnif) || 0;
    const qteTenue = parseInt(opt.qteTenue, 10) || 0;
    const qteSport = parseInt(opt.qteSport, 10) || 0;

    if (montantUnif > 0) {
      p.push({ key:"unif", cat:"Uniformes", label:"Uniforme", du:montantUnif, paye:0 });
    } else if (opt.unif === "oui") {
      p.push({ key:"unif", cat:"Uniformes", label:"Uniforme", du:0, paye:0, is_var:true });
    } else if (qteTenue > 0 || qteSport > 0) {
      // Rétrocompatibilité dossiers existants avec quantités
      const prixTenue = MAT_SECTS.includes(sect) ? 8000 : 8500;
      if (qteTenue > 0) {
        p.push({ key:"unif_tenue", cat:"Uniformes", label:`Tenue scolaire ×${qteTenue} (${fmtFCFA(prixTenue)}/unité)`, du:prixTenue * qteTenue, paye:0 });
      }
      if (qteSport > 0) {
        p.push({ key:"unif_sport", cat:"Uniformes", label:`Tenue de sport ×${qteSport} (4 000 F/unité)`, du:4000 * qteSport, paye:0 });
      }
    }
  }

  // ── FOURNITURES (montant libre) ────────────────────────────
  if (opt.four === "oui") {
    p.push({ key:"four", cat:"Fournitures", label:"Fournitures scolaires", du:0, paye:0, is_var:true });
  }

  // La remise (si accordée) n'est plus un poste fictif à part : elle est
  // créditée directement sur les postes réels de la catégorie ciblée, comme
  // un paiement classique (voir appliquerRemise, appelée par enfants.js à la
  // création et à la reconciliation du dossier) — sans ça, un poste "remise"
  // séparé ne se reflétait ni sur le détail par mois/tranche, ni sur les
  // bilans par secteur, ni sur le message WhatsApp envoyé aux parents.

  appliquerMoisNonSouscrits(p, opt);
  return p;
}

// La participation est conservée dans opt (JSON), sans nouvelle colonne SQL.
function posteEstAbsent(poste, opt) {
  if (!poste || !poste.mois) return false;
  if (!opt && typeof STATE !== "undefined") opt = STATE.enfants.find(e => e.id === poste.enfant_id)?.opt;
  return !!opt?.mois_non_souscrits?.[poste.key]?.absent;
}

function appliquerMoisNonSouscrits(postes, opt) {
  postes.forEach(p => {
    const participation = p.mois && opt?.mois_non_souscrits?.[p.key];
    if (!participation) return;
    if (participation.absent) { if (!(p.paye > 0)) p.du = 0; }
    else if (Number.isSafeInteger(participation.du) && participation.du >= 0 &&
      (participation.du > 0 || participation.tarif_manuel || !(p.paye > 0))) p.du = participation.du;
  });
  return postes;
}

function ajouterRepasReduits(postes, opt) {
  MOIS_CANTINE_REDUITS.forEach(m => {
    [["ptdej", "Petit-déjeuner"], ["dej", "Déjeuner"]].forEach(([key, label]) => {
      if (opt[key] === "oui") postes.push({ key:`${key}_reduit_${m}`, cat:"Cantine",
        label:`${label} ${m} (effectif réduit — montant à définir)`,
        du:0, paye:0, mois:m, dl:MOIS_DL_5[m], is_reduit:true });
    });
  });
}

// Conserver un ancien mois fusionné déjà facturé/payé sans doubler sa dette.
function repasReduitHistorique(poste, anciens) {
  return /^(ptdej|dej)_reduit_/.test(poste.key) && anciens.some(p =>
    p.key === `cantine_reduit_${poste.mois}` && ((Number(p.du) || 0) > 0 || (Number(p.paye) || 0) > 0));
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
  "Garderie":                ["Garderie"],
  "Uniformes":               ["Uniformes"],
  "Fournitures":             ["Fournitures"],
  "Halte-Garderie":          ["Halte-Garderie"]
};

// ============================================================
// IMPUTATION D'UN PAIEMENT (mois chronologiques, Sep → Aoû)
// ============================================================
// - postesCibles (optionnel) : liste limitée des postes à imputer — un
//   secteur comme « Petit-déjeuner » ne cible que les postes `ptdej_*` de
//   la catégorie Cantine (voir entrees.js, postesDuSecteur).
// - moisDepart : si c'est un mois, l'imputation commence À CE MOIS-Là (et
//   non plus au premier mois non soldé) ; sur un mois à effectif réduit dont
//   le montant n'est pas encore défini, le versement en fixe le montant.
// Retourne la liste des versements effectués : [{ poste, montant }, ...]
// Chaque entrée permet de retrouver précisément quel poste a reçu quoi,
// afin de pouvoir annuler l'opération si le paiement est supprimé.
function imputerPaiement(postes, cat, montant, moisDepart, postesCibles) {
  const MOIS_ORD = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
  const idxDepart = (moisDepart && MOIS_ORD.includes(moisDepart)) ? MOIS_ORD.indexOf(moisDepart) : 0;
  const allocations = [];

  // Pour la Crèche : ne jamais imputer Inscription (inscr) ni Assurance (assur)
  // lors d'un versement mensuel de Crèche (elles ont leurs propres secteurs)
  const base = postesCibles || postes.filter(p => p.cat === cat);
  const cibles = base
    .filter(p => p.cat === cat && !posteEstAbsent(p) && !p.is_var && !p.is_remise && p.key !== "avance" && (cat !== "Crèche" || (p.key !== "inscr" && p.key !== "assur")))
    .sort((a, b) => {
      if (cat === "Scolarité") {
        const SCOL_ORD = ["inscr", "t1", "t2", "t3"];
        const ai = SCOL_ORD.indexOf(a.key);
        const bi = SCOL_ORD.indexOf(b.key);
        if (ai !== -1 && bi !== -1) return ai - bi;
      }
      const ai = a.mois ? MOIS_ORD.indexOf(a.mois) : -1;
      const bi = b.mois ? MOIS_ORD.indexOf(b.mois) : -1;
      return ai - bi;
    });

  let reste = montant;
  cibles.forEach(p => {
    if (reste <= 0) return;
    // Jamais avant le mois choisi (mois choisi = Sep → on commence en Sep)
    if (p.mois && MOIS_ORD.indexOf(p.mois) < idxDepart) return;

    const manque = Math.max((p.du || 0) - (p.paye || 0), 0);
    if (manque > 0) {
      const versement = Math.min(reste, manque);
      p.paye = (p.paye || 0) + versement;
      allocations.push({ poste: p, montant: versement });
      reste -= versement;
      return;
    }

    // Mois à effectif réduit dont le montant n'est pas encore défini, ciblé
    // explicitement par le versement : le paiement en fixe le montant (plafonné
    // au tarif de référence du/des service(s) concerné(s) pour ne pas avaler un
    // versement destiné à plusieurs mois). Voir aussi refPosteReduit.
    if (reste > 0 && p.is_reduit && !(p.du > 0) && moisDepart && moisDepart === p.mois) {
      const ref = refPosteReduit(p, cibles);
      const plafond = ref > 0 ? Math.max(ref - (p.du || 0), 0) : reste;
      const versement = Math.min(reste, plafond);
      if (versement > 0) {
        p.du = (p.du || 0) + versement;
        p.paye = (p.paye || 0) + versement;
        allocations.push({ poste: p, montant: versement });
        reste -= versement;
      }
    }
  });

  // Surplus non réparti → poste "Avance" (jamais sur postes[0])
  if (reste > 0) {
    let avance = postes.find(p => p.key === "avance" && p.cat === cat);
    if (!avance) {
      // is_var:true pour un affichage correct ("X versé", pas "0 F / Soldé")
      // — un surplus n'a pas de "dû" à comparer, voir renderPosteRow.
      avance = { key:"avance", cat, label:"Avance / Trop-perçu", du:0, paye:0, is_var:true };
      postes.push(avance);
    }
    avance.paye = (avance.paye || 0) + reste;
    allocations.push({ poste: avance, montant: reste });
  }
  return allocations;
}

// Tarif de référence d'un poste mensuel à effectif réduit (montant saisi
// manuellement par l'administration) — sert à plafonner un versement qui
// vient de fixer ce montant : sans plafond, un versement couvrant plusieurs
// mois serait entièrement absorbé par le premier mois réduit rencontré.
function refPosteReduit(p, postesRef) {
  if (p.key.indexOf("ptdej_reduit_") === 0) return 5000;
  if (p.key.indexOf("dej_reduit_") === 0) return 9000;
  if (p.key.indexOf("cantc_reduit") === 0) return 13000;
  if (p.key.indexOf("gout_reduit") === 0) return 3000;
  if (p.key.indexOf("cantine_reduit") === 0 || p.key.indexOf("ptdej_reduit") === 0 || p.key.indexOf("dej_reduit") === 0) {
    // Poste fusionné petit-déjeuner + déjeuner (dossiers existants) : la
    // référence dépend des services réellement présents dans la cible.
    const src = (postesRef && postesRef.length > 0) ? postesRef : [p];
    const aPtdej = p.key.indexOf("ptdej_") === 0 || src.some(x => x.key && x.key.indexOf("ptdej_") === 0);
    const aDej = p.key.indexOf("dej_") === 0 || src.some(x => x.key && x.key.indexOf("dej_") === 0);
    const ref = (aPtdej ? 5000 : 0) + (aDej ? 9000 : 0);
    return ref > 0 ? ref : 14000;
  }
  return 0;
}

// ============================================================
// APPLICATION D'UNE REMISE (crédit direct, comme un paiement)
// ============================================================
// Une remise accordée doit se refléter exactement comme un versement du
// parent : mois/tranche par mois/tranche, en commençant par le plus ancien
// non soldé (même règle que imputerPaiement). Retourne les allocations
// [{poste, montant}, ...] pour pouvoir annuler précisément la remise si
// elle est modifiée ou supprimée plus tard (voir reconcilerPostes).
function appliquerRemise(postes, cat, montant) {
  if (!montant || montant <= 0 || !cat) return [];
  // Remise sur Scolarité : s'impute directement sur les tranches de scolarité
  if (cat === "Scolarité") {
    const tranches = postes.filter(p => p.cat === "Scolarité" && ["t1", "t2", "t3"].includes(p.key));
    if (tranches.length > 0) {
      let resteRemise = montant;
      const allocs = [];
      tranches.forEach(p => {
        if (resteRemise <= 0) return;
        const manque = (p.du || 0) - (p.paye || 0);
        if (manque > 0) {
          const v = Math.min(resteRemise, manque);
          p.paye = (p.paye || 0) + v;
          allocs.push({ poste: p, montant: v });
          resteRemise -= v;
        }
      });
      return allocs;
    }
  }
  return imputerPaiement(postes, cat, montant, null);
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
  // Une avance ou un versement libre ne solde pas une autre dette.
  return postes.filter(p => !p.is_remise && !p.is_var && p.key !== "avance")
    .reduce((s, p) => s + Math.max((Number(p.du) || 0) - (Number(p.paye) || 0), 0), 0);
}

// ============================================================
// STATUT DE PAIEMENT D'UN ENFANT
// ============================================================
// Nouveaux statuts (plus de « Partiel » / « Impayé ») :
//   solde          — tout le dossier est soldé
//   a_jour         — aucune échéance échue en retard
//   retard_scol    — échéance en retard sur un poste « scolarité »
//                    (scolarité, frais généraux, uniformes, fournitures)
//   retard_creche  — échéance en retard sur un poste rattaché à la Crèche
//                    (mensualité crèche, halte-garderie)
//   retard_cantine — échéance en retard sur un repas / un service de garde
//                    journalier (petit-déjeuner, déjeuner, goûter,
//                    garderie midi, cantine crèche)
// Les familles suivent le regroupement déjà utilisé dans le dossier de
// l'enfant (enfants.js, catAffichage) : Garderie affichée avec la Cantine,
// Halte-Garderie affichée avec la Crèche.
var STATUT_FAMILLE_RETARD = {
  "Crèche": "retard_creche",
  "Halte-Garderie": "retard_creche",
  "Cantine": "retard_cantine",
  "Cantine crèche": "retard_cantine",
  "Goûter": "retard_cantine",
  "Garderie": "retard_cantine"
};

function familleRetardPoste(cat) {
  return STATUT_FAMILLE_RETARD[cat] || "retard_scol";
}

// En cas de retards multiples, l'enfant est rattaché à la famille dont le
// montant en retard est le plus élevé (égalité → scolarité, priorité).
function statutPaiement(postes) {
  if (!postes || postes.length === 0) return "a_jour";

  const du = tDu(postes);
  const reste = tReste(postes);

  // Dossier entièrement réglé
  if (du > 0 && reste <= 0) return "solde";

  // Aucun dû (dossier non configuré, postes à montant libre uniquement…) :
  // rien à réclamer, l'enfant est « À jour » — jamais « Soldé ».
  const detail = posteRetardsDetail(postes);
  if (detail.length === 0) return "a_jour";

  const totaux = { retard_scol: 0, retard_creche: 0, retard_cantine: 0 };
  detail.forEach(d => { totaux[familleRetardPoste(d.cat)] += Number(d.manque) || 0; });

  let famille = "retard_scol";
  let max = totaux.retard_scol;
  if (totaux.retard_creche > max) { famille = "retard_creche"; max = totaux.retard_creche; }
  if (totaux.retard_cantine > max) { famille = "retard_cantine"; }
  return famille;
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

// Seuils d'alerte de retard — distincts des échéances indiquées aux
// parents (voir le rappel de tranches dans le bilan WhatsApp) : chaque
// seuil correspond au lendemain de l'échéance (délai de tolérance d'un
// jour), sauf la T3 qui bénéficie de 5 jours de tolérance.
var SEUIL_RETARD_FRAIS_GENERAUX = new Date(2026, 8, 14);  // 14/09/2026 — jour de la rentrée
var SEUIL_RETARD_T1 = new Date(2026, 9, 20);               // 20/10/2026
var SEUIL_RETARD_T2 = new Date(2026, 11, 8);                // 08/12/2026
var SEUIL_RETARD_T3 = new Date(2027, 1, 10);                 // 10/02/2027

function posteEnRetard(p) {
  if (!p || p.is_var || p.is_remise || posteEstAbsent(p)) return false;
  if ((p.paye || 0) >= p.du) return false;

  const today = new Date();

  // Frais généraux (Inscription, Activités parascolaires, Fêtes scolaires,
  // Assurance, APE) : retard s'ils ne sont pas soldés avant le 14 septembre
  // (jour de la rentrée).
  if (["inscr", "act", "fetes", "assur", "ape"].includes(p.key)) {
    return today >= SEUIL_RETARD_FRAIS_GENERAUX;
  }
  if (p.key === "t1") return today >= SEUIL_RETARD_T1;
  if (p.key === "t2") return today >= SEUIL_RETARD_T2;
  if (p.key === "t3") return today >= SEUIL_RETARD_T3;

  // Postes mensuels (Crèche, Cantine, Cantine crèche, Garderie) :
  // retard dès le jour de l'échéance (le 5 de chaque mois).
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
