// ============================================================
// enfants.js — Dossiers élèves : création, affichage, options
// ============================================================

// Services disponibles selon la section (filtre dynamique du formulaire)
var SERVICE_RULES = {
  creche:   ["cantC", "halte"],
  garderie: ["four"],
  premat:   ["ptdej", "dej", "gout", "gard", "four"],
  mat1:     ["ptdej", "dej", "gout", "gard", "four"],
  mat2:     ["ptdej", "dej", "gout", "gard", "four"],
  // Le goûter est réservé à la Maternelle sur la fiche tarifaire officielle
  // La garderie de midi (3 000 F/mois) concerne tous les niveaux de la
  // Prématernelle au CM1 — différente de la crèche (0 à 3 ans).
  ci:       ["ptdej", "dej", "gard", "four"],
  cp:       ["ptdej", "dej", "gard", "four"],
  ce1:      ["ptdej", "dej", "gard", "four"],
  ce2:      ["ptdej", "dej", "gard", "four"],
  cm1:      ["ptdej", "dej", "gard", "four"]
};

// Enfants dont la fiche est actuellement dépliée (persiste entre les rendus)
var openIds = new Set();

// ---------- Initiales pour l'avatar ----------
function initials(nom) {
  return (nom || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ============================================================
// INITIALISATION DU MODULE
// ============================================================
function initEnfants() {
  document.getElementById("fSect").addEventListener("change", updateServiceAvailability);
  document.getElementById("svcDej").addEventListener("change", updateServiceAvailability);
  document.getElementById("formEnfant").addEventListener("submit", handleCreateEnfant);
  document.getElementById("btnResetEnfant").addEventListener("click", resetEnfantForm);
  document.getElementById("rechEnfant").addEventListener("input", renderEnfantsList);
  document.getElementById("filtreSect").addEventListener("change", renderEnfantsList);
  document.getElementById("filtreStatutPaiement").addEventListener("change", renderEnfantsList);
  document.getElementById("btnExportCsv").addEventListener("click", exportEnfantsCsv);

  // Bouton flottant permanent retour en haut
  const btnScrollTop = document.getElementById("btnScrollTop");
  if (btnScrollTop) {
    btnScrollTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Style visuel des cases à cocher (classe .checked)
  document.querySelectorAll("#fServices input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", () => cb.closest(".checkbox-item").classList.toggle("checked", cb.checked));
  });

  updateServiceAvailability();
}

// ============================================================
// FILTRE DYNAMIQUE DES SERVICES SELON LA SECTION
// ============================================================
function updateServiceAvailability() {
  const sect = document.getElementById("fSect").value;
  const allowed = SERVICE_RULES[sect] || [];
  const dejCoche = !!document.getElementById("svcDej")?.checked;
  const estCreche = sect === "creche";

  // Date d'inscription : concerne UNIQUEMENT la Crèche
  const wrapDate = document.getElementById("wrapDateInscription");
  if (wrapDate) {
    wrapDate.style.display = estCreche ? "block" : "none";
    const inputDate = document.getElementById("fDateInscription");
    if (inputDate && !estCreche) inputDate.value = "";
  }

  // Uniformes : montant libre, disponible pour tous les niveaux SAUF la Crèche
  const wrapUnif = document.getElementById("wrapUnif");
  if (wrapUnif) {
    wrapUnif.style.display = (sect && !estCreche) ? "block" : "none";
    const inputUnif = document.getElementById("fMontantUnif");
    if (inputUnif && (!sect || estCreche)) inputUnif.value = 0;
  }

  document.querySelectorAll("#fServices .checkbox-item").forEach(item => {
    const svc = item.dataset.svc;
    const input = item.querySelector("input");
    // Pour la Crèche : pas de fournitures (ni d'uniforme)
    const ok = allowed.includes(svc) && !(estCreche && svc === "four");

    // La garderie de midi est incluse d'office dès que le Déjeuner est souscrit
    if (svc === "gard" && ok && dejCoche) {
      input.checked = true;
      input.disabled = true;
      item.classList.add("checked");
      item.classList.remove("disabled");
      return;
    }

    input.disabled = !ok;
    if (!ok) {
      input.checked = false;
      item.classList.remove("checked");
    }
    item.classList.toggle("disabled", !ok);
  });
}

function resetEnfantForm() {
  document.getElementById("formEnfant").reset();
  document.querySelectorAll("#fServices .checkbox-item").forEach(item => item.classList.remove("checked"));
  updateServiceAvailability();
}

// ============================================================
// CRÉATION D'UN DOSSIER
// ============================================================
async function handleCreateEnfant(e) {
  e.preventDefault();

  const nom = document.getElementById("fNom").value.trim();
  const sect = document.getElementById("fSect").value;
  const stat = document.querySelector('input[name="fStat"]:checked').value;
  const sexe = document.getElementById("fSexe").value || null;
  const civilite = document.getElementById("fCivilite").value;
  const parent = document.getElementById("fParent").value.trim();
  const tel = document.getElementById("fTel").value.trim();
  const ddn = document.getElementById("fDdn").value || null;
  // La date d'inscription ne concerne que la Crèche (12 mois glissants)
  const dateInscription = sect === "creche"
    ? (document.getElementById("fDateInscription").value || new Date().toISOString().slice(0, 10))
    : null;
  const annee = document.getElementById("fAnnee").value;
  const remise = parseFloat(document.getElementById("fRemise").value) || 0;
  const remiseCible = document.getElementById("fRemiseCible").value;

  if (!nom || !sect) {
    showToast("Veuillez renseigner au minimum le nom et la section.", "error");
    return;
  }

  // Uniforme : montant libre à saisir manuellement (sauf Crèche)
  const montantUnif = (sect !== "creche") ? (parseFloat(document.getElementById("fMontantUnif")?.value) || 0) : 0;

  const opt = {
    ptdej: document.getElementById("svcPtdej").checked ? "oui" : "non",
    dej:   document.getElementById("svcDej").checked ? "oui" : "non",
    gout:  document.getElementById("svcGout").checked ? "oui" : "non",
    gard:  document.getElementById("svcGard").checked ? "oui" : "non",
    montantUnif: montantUnif,
    unif: montantUnif > 0 ? "oui" : "non",
    four: (sect !== "creche" && document.getElementById("svcFour").checked) ? "oui" : "non",
    cantC: (sect === "creche" && document.getElementById("svcCantC").checked) ? "oui" : "non",
    halte: (sect === "creche" && document.getElementById("svcHalte").checked) ? "oui" : "non",
    remise: remise > 0 ? remise : 0,
    remiseCible
  };

  const id = uid("enf");
  const enfant = { id, nom, sect, stat, sexe, tel, parent, civilite, ddn, date_inscription: dateInscription, annee, opt, remise, remise_cible: remiseCible };
  const postesGeneres = fabriquerPostesEnfant(id, sect, stat, opt);

  // La remise est créditée directement sur les postes réels (comme un
  // paiement) — on mémorise les allocations pour pouvoir l'annuler
  // proprement si le dossier est modifié plus tard.
  const allocationsRemise = appliquerRemise(postesGeneres, remiseCible, remise);
  opt.remise_allocations = allocationsRemise.map(a => ({ poste_id: a.poste.id, montant: a.montant }));

  try {
    await dbInsertEnfant(enfant);
    await dbReplacePostesEnfant(id, postesGeneres);
    STATE.enfants.push(enfant);
    STATE.postes.push(...postesGeneres);
    resetEnfantForm();
    refreshAllTabs();
    showToast(`Dossier de ${nom} créé avec succès.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de la création du dossier : " + err.message, "error");
  }
}

// Construit les postes formatés pour la base de données à partir de buildPostes()
function fabriquerPostesEnfant(enfantId, sect, stat, opt) {
  return buildPostes(sect, stat, opt).map(p => ({
    id: `${enfantId}_${p.key}`,
    enfant_id: enfantId,
    key: p.key, cat: p.cat, label: p.label,
    du: p.du || 0, paye: p.paye || 0,
    mois: p.mois || null, dl: p.dl || null,
    is_var: !!p.is_var, is_remise: false, is_reduit: !!p.is_reduit
  }));
}

// ============================================================
// RECONCILIATION DES POSTES (modification des options)
// Préserve les montants déjà payés sur les services conservés.
// ============================================================
function reconcilerPostes(enfant, newOpt) {
  const anciens = STATE.postes.filter(p => p.enfant_id === enfant.id);

  // Annule d'abord le crédit de l'ancienne remise (si présente), pour
  // repartir d'un historique de paiements "propre" avant d'appliquer la
  // nouvelle — sinon une remise modifiée s'additionnerait à l'ancienne.
  (enfant.opt.remise_allocations || []).forEach(a => {
    const poste = anciens.find(p => p.id === a.poste_id);
    if (poste) poste.paye = Math.max((poste.paye || 0) - (a.montant || 0), 0);
  });

  const ancienParKey = {};
  anciens.forEach(p => { ancienParKey[p.key] = p; });

  const nouveauxBruts = buildPostes(enfant.sect, enfant.stat, newOpt);
  const resultat = [];

  nouveauxBruts.forEach(np => {
    const anc = ancienParKey[np.key];
    resultat.push({
      id: `${enfant.id}_${np.key}`,
      enfant_id: enfant.id,
      key: np.key, cat: np.cat, label: np.label,
      // Mois à effectif réduit : le montant est saisi manuellement par
      // l'administration (voir openEditerMontantReduitModal) — buildPostes
      // le régénère toujours à 0, donc on préserve la valeur déjà définie
      // au lieu de l'écraser à chaque modification des options du dossier.
      du: (np.is_reduit && anc) ? (anc.du || 0) : (np.du || 0),
      mois: np.mois || null, dl: np.dl || null,
      is_var: !!np.is_var, is_remise: false, is_reduit: !!np.is_reduit,
      paye: anc ? (anc.paye || 0) : (np.paye || 0)
    });
    delete ancienParKey[np.key];
  });

  // Postes correspondant à un service désormais désactivé : conservés
  // seulement si un montant y a déjà été versé (historique préservé)
  Object.values(ancienParKey).forEach(p => {
    if ((p.paye || 0) > 0) resultat.push(p);
  });

  // Applique la nouvelle remise directement sur les postes réels, comme un
  // paiement classique, et mémorise les allocations dans newOpt pour
  // pouvoir l'annuler proprement la prochaine fois que le dossier change.
  const allocationsRemise = appliquerRemise(resultat, newOpt.remiseCible, newOpt.remise);
  newOpt.remise_allocations = allocationsRemise.map(a => ({ poste_id: a.poste.id, montant: a.montant }));

  return resultat;
}

// ============================================================
// RENDU DE LA LISTE (accordéon)
// ============================================================
function renderEnfantsList() {
  const root = document.getElementById("enfantsList");
  if (!root) return;

  const recherche = (document.getElementById("rechEnfant")?.value || "").trim().toLowerCase();
  const filtreSect = document.getElementById("filtreSect")?.value || "";
  const filtreStatut = document.getElementById("filtreStatutPaiement")?.value || "";

  let liste = STATE.enfants.filter(e => !recherche || e.nom.toLowerCase().includes(recherche));
  if (filtreSect) liste = liste.filter(e => e.sect === filtreSect);
  if (filtreStatut === "scol_solde" || filtreStatut === "scol_impaye") {
    const cible = filtreStatut === "scol_solde" ? "solde" : "impaye";
    liste = liste.filter(e => statutScolarite(STATE.postes.filter(p => p.enfant_id === e.id)) === cible);
  } else if (filtreStatut) {
    liste = liste.filter(e => statutPaiement(STATE.postes.filter(p => p.enfant_id === e.id)) === filtreStatut);
  }
  liste = liste.slice().sort((a, b) => a.nom.localeCompare(b.nom));

  if (liste.length === 0) {
    root.innerHTML = `<div class="empty-state"><div class="icon"><i class="bi bi-people"></i></div>Aucun dossier ne correspond à votre recherche.</div>`;
    return;
  }

  root.innerHTML = liste.map(renderEnfantItem).join("");
  wireEnfantItemEvents();
}

var STATUT_INFO = {
  solde:   { badge: "badge-green",  icon: "bi-check-circle-fill",       texte: "Soldé" },
  a_jour:  { badge: "badge-green",  icon: "bi-check-circle-fill",       texte: "À jour" },
  partiel: { badge: "badge-orange", icon: "bi-exclamation-circle-fill", texte: "Partiel" },
  impaye:  { badge: "badge-red",    icon: "bi-x-circle-fill",           texte: "Impayé" }
};

// Statut de la Scolarité seule (Inscription + tranches, cat "Scolarité") —
// distinct du statut global : un enfant peut avoir sa scolarité entièrement
// soldée tout en ayant un reste sur la cantine, et inversement. Utilisé par
// les filtres "Scolarité soldée" / "Scolarité impayée" (Dossiers enfants).
// Retourne null pour un enfant sans poste "Scolarité" (ex. crèche).
function statutScolarite(postesEnfant) {
  const lignes = postesEnfant.filter(p => p.cat === "Scolarité" && !p.is_var && !p.is_remise && p.key !== "avance");
  if (lignes.length === 0) return null;
  const du = lignes.reduce((s, p) => s + (p.du || 0), 0);
  const paye = lignes.reduce((s, p) => s + (p.paye || 0), 0);
  return paye >= du ? "solde" : "impaye";
}

function renderEnfantItem(e) {
  const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
  const statut = statutPaiement(postesEnfant);
  const info = STATUT_INFO[statut] || STATUT_INFO.impaye;
  const isOpen = openIds.has(e.id);

  // Regroupement des postes par catégorie (hors remise, gérée à part)
  // Les services ponctuels de la crèche (halte-garderie, samedi, nuitée)
  // s'affichent regroupés sous "Crèche" plutôt que dans une section à part.
  // La Garderie midi s'affiche regroupée avec la Cantine (même section,
  // même total) : en pratique elle est toujours payée en même temps
  // (cochée automatiquement avec le Déjeuner dans Entrées) — contrairement
  // au Goûter, qui lui reste séparé (voir plus bas) car il peut être payé
  // indépendamment et créait un total mensuel trompeur une fois regroupé.
  const categories = {};
  postesEnfant.filter(p => !p.is_remise).forEach(p => {
    const catAffichage = PONCTUEL_CRECHE_CATS.includes(p.cat) ? "Crèche" : p.cat === "Garderie" ? "Cantine" : p.cat;
    if (!categories[catAffichage]) categories[catAffichage] = [];
    categories[catAffichage].push(p);
  });

  // Rendu d'une ligne de poste (montant dû + versé/restant, badge retard).
  // posteIdEditable : pour les mois à effectif réduit (Cantine/Goûter/
  // Cantine crèche de mars, juin, septembre) dont le montant est saisi
  // manuellement — affiche une icône crayon pour le définir/l'ajuster.
  function renderPosteRow(label, du, paye, isVar, retard, posteIdEditable, montantNonDefini) {
    const reste = isVar ? Math.max(-(paye || 0), 0) : Math.max((du || 0) - (paye || 0), 0);
    const duTxt = isVar ? "Montant libre" : (montantNonDefini ? "À définir" : fmtFCFA(du));

    // Transparence totale : dès qu'un poste n'est pas soldé, on affiche à la
    // fois ce qui a déjà été versé (en bleu) et ce qu'il reste (en rouge/orange)
    // — jamais le reste seul, ni les deux dans la même couleur : ça se confond.
    let statutHtml;
    if (isVar) {
      statutHtml = `<span class="text-blue">${fmtFCFA(paye)} versé</span>`;
    } else if (montantNonDefini) {
      statutHtml = `<span class="text-muted">Montant non défini</span>`;
    } else if (reste <= 0) {
      statutHtml = `<span class="text-green">Soldé</span>`;
    } else {
      const resteClass = retard ? "text-red" : "text-orange";
      statutHtml = `<span class="text-blue">Versé ${fmtFCFA(paye || 0)}</span> · <span class="${resteClass}">Restant ${fmtFCFA(reste)}</span>`;
    }

    const editBtn = posteIdEditable
      ? `<button type="button" class="btn-icon-edit-poste" data-editer-montant="${posteIdEditable}" title="Définir le montant"><i class="bi bi-pencil-fill"></i></button>`
      : "";

    return `
      <div class="poste-row">
        <div class="poste-label">${escapeHtml(label)}${retard ? ' <span class="badge badge-red">retard</span>' : ""}${editBtn}</div>
        <div class="poste-amounts">
          <span class="du">${duTxt}</span>
          <span class="reste">${statutHtml}</span>
        </div>
      </div>`;
  }

  const MOIS_ORDRE_AFFICHAGE = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];

  // Ordre d'affichage des catégories : Inscription, Scolarité, Assurance, APE,
  // Activités, Fêtes, Goûter, Crèche, Uniformes, Fournitures, et Cantine EN BAS.
  const ORDRE_CATEGORIES_DOSSIER = [
    "Inscription", "Scolarité", "Assurance", "APE",
    "Activités parascolaires", "Fêtes scolaires", "Goûter",
    "Crèche", "Halte-Garderie",
    "Uniformes", "Fournitures",
    "Cantine", "Cantine crèche"
  ];
  const catsOrdonnees = Object.keys(categories).sort((a, b) => {
    const ia = ORDRE_CATEGORIES_DOSSIER.indexOf(a);
    const ib = ORDRE_CATEGORIES_DOSSIER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const catsHtml = catsOrdonnees.map(cat => {
    let lignes;

    if (cat === "Cantine") {
      // Regroupe Petit-déjeuner + Déjeuner + Garderie midi (et toute autre
      // option cantine) en un seul total mensuel, plus lisible que le
      // détail poste par poste. Les postes sans mois (ex. une avance mal
      // orientée) restent affichés individuellement plutôt que d'être
      // regroupés sous un mois "null".
      const parMois = {};
      const horsMois = [];
      categories[cat].forEach(p => {
        if (!p.mois) { horsMois.push(p); return; }
        if (!parMois[p.mois]) parMois[p.mois] = { du: 0, paye: 0, postes: [] };
        parMois[p.mois].du += p.du || 0;
        parMois[p.mois].paye += p.paye || 0;
        parMois[p.mois].postes.push(p);
      });
      lignes = Object.keys(parMois)
        .sort((a, b) => MOIS_ORDRE_AFFICHAGE.indexOf(a) - MOIS_ORDRE_AFFICHAGE.indexOf(b))
        .map(mois => {
          const g = parMois[mois];
          const retard = g.postes.some(p => posteEnRetard(p));
          // Mois à effectif réduit : un poste "montant à définir" au sein
          // du groupe (potentiellement mélangé à la Garderie, toujours à
          // tarif fixe) — on expose son id pour l'édition manuelle, et on
          // n'affiche "à définir" que si c'est le seul poste du mois.
          const posteReduitObj = g.postes.find(p => p.is_reduit);
          const posteReduit = posteReduitObj ? posteReduitObj.id : null;
          const montantNonDefini = g.postes.length === 1 && !!posteReduitObj && !posteReduitObj.du;
          return renderPosteRow(`Cantine ${mois}`, g.du, g.paye, false, retard, posteReduit, montantNonDefini);
        }).join("")
        + horsMois.map(p => renderPosteRow(p.label, p.du, p.paye, p.is_var, posteEnRetard(p))).join("");
    } else {
      lignes = categories[cat].map(p => renderPosteRow(p.label, p.du, p.paye, p.is_var, posteEnRetard(p), p.is_reduit ? p.id : null, p.is_reduit && !p.du)).join("");
    }

    return `<div class="postes-cat"><div class="postes-cat-title">${escapeHtml(cat)}</div>${lignes}</div>`;
  }).join("");

  const historique = STATE.entrees
    .filter(en => en.enfant_id === e.id)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(en => `
      <div class="timeline-item">
        <span class="timeline-date">${formatDateFR(en.date)}</span>
        <span>${escapeHtml(en.sect || "—")}${en.mois ? " · " + en.mois : ""}</span>
        <span class="timeline-mt">${fmtFCFA(en.mt)}</span>
      </div>`).join("");

  return `
    <div class="enfant-item ${isOpen ? "open" : ""}" id="enfant-${e.id}" data-id="${e.id}">
      <div class="enfant-header" data-toggle="${e.id}">
        <div class="enfant-id-block">
          <div class="enfant-avatar">${initials(e.nom)}</div>
          <div>
            <div class="enfant-name">${escapeHtml(e.nom)}</div>
            <div class="enfant-meta">${SECT_LABELS[e.sect] || e.sect} · ${e.stat === "nouveau" ? "Nouveau" : "Ancien"}${e.tel ? " · " + escapeHtml(e.tel) : ""}</div>
          </div>
        </div>
        <div class="enfant-right">
          <span class="badge ${info.badge}"><i class="bi ${info.icon}"></i> ${info.texte}</span>
          <button class="btn-icon-danger" data-del="${e.id}" title="Supprimer le dossier" aria-label="Supprimer le dossier"><i class="bi bi-trash"></i></button>
          <span class="enfant-chevron"><i class="bi bi-chevron-down"></i></span>
        </div>
      </div>
      <div class="enfant-body">
        ${e.remise > 0 ? `<div class="remise-badge"><i class="bi bi-gift-fill"></i> Remise de ${fmtFCFA(e.remise)} sur ${escapeHtml(e.remise_cible || "—")} — créditée directement sur les échéances concernées</div>` : ""}
        ${catsHtml || '<p class="text-muted mt-1">Aucun poste financier.</p>'}

        <div class="postes-cat">
          <div class="postes-cat-title">Récapitulatif</div>
          <div class="poste-row"><div class="poste-label">Total dû</div><div class="poste-amounts">${fmtFCFA(tDu(postesEnfant))}</div></div>
          <div class="poste-row"><div class="poste-label">Total payé</div><div class="poste-amounts">${fmtFCFA(tPaye(postesEnfant))}</div></div>
          <div class="poste-row"><div class="poste-label">Reste à payer</div><div class="poste-amounts"><strong>${fmtFCFA(tReste(postesEnfant))}</strong></div></div>
        </div>

        <div class="postes-cat">
          <div class="postes-cat-title">Historique des paiements</div>
          <div class="timeline">${historique || '<p class="text-muted">Aucun paiement enregistré.</p>'}</div>
        </div>

        <div class="enfant-actions">
          <button class="btn btn-secondary btn-sm" data-opt="${e.id}"><i class="bi bi-sliders"></i> Modifier les options</button>
          <button class="btn btn-secondary btn-sm" data-profil="${e.id}"><i class="bi bi-pencil-square"></i> Modifier le profil</button>
          <button class="btn btn-whatsapp btn-sm" data-wa="${e.id}" ${e.tel ? "" : "disabled"}><i class="bi bi-whatsapp"></i> Envoyer bilan WhatsApp</button>
          <button class="btn btn-ghost btn-sm" data-print="${e.id}"><i class="bi bi-printer"></i> Imprimer la fiche</button>
          <button class="btn btn-danger btn-sm" data-del="${e.id}"><i class="bi bi-trash"></i> Supprimer</button>
        </div>
      </div>
    </div>`;
}

function wireEnfantItemEvents() {
  document.querySelectorAll("[data-toggle]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.toggle;
      const item = document.getElementById(`enfant-${id}`);
      const dejaOuvert = openIds.has(id);

      // Un seul dossier ouvert à la fois : on referme systématiquement
      // les autres avant d'ouvrir celui qui vient d'être cliqué.
      document.querySelectorAll(".enfant-item.open").forEach(autre => autre.classList.remove("open"));
      openIds.clear();

      if (!dejaOuvert) {
        openIds.add(id);
        item.classList.add("open");
      }
    });
  });

  document.querySelectorAll("[data-opt]").forEach(btn => btn.addEventListener("click", () => openEditOptionsModal(btn.dataset.opt)));
  document.querySelectorAll("[data-profil]").forEach(btn => btn.addEventListener("click", () => openEditProfilModal(btn.dataset.profil)));
  document.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", (ev) => {
    ev.stopPropagation(); // évite de (dé)plier le dossier quand on clique la poubelle de l'en-tête
    openDeleteEnfantModal(btn.dataset.del);
  }));
  document.querySelectorAll("[data-print]").forEach(btn => btn.addEventListener("click", () => imprimerFiche(btn.dataset.print)));
  document.querySelectorAll("[data-wa]").forEach(btn => btn.addEventListener("click", () => {
    const enfant = STATE.enfants.find(e => e.id === btn.dataset.wa);
    if (!enfant) return;
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
    const suiviEnfant = STATE.suivi.filter(s => s.enfant_id === enfant.id);
    sendWhatsApp(enfant.tel, buildBilanMessage(enfant, postesEnfant, suiviEnfant));
  }));
  document.querySelectorAll("[data-editer-montant]").forEach(btn => btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    openEditerMontantReduitModal(btn.dataset.editerMontant);
  }));
}

// ============================================================
// MODAL — MONTANT D'UN MOIS À EFFECTIF RÉDUIT (Cantine/Goûter/Cantine
// crèche de mars, juin, septembre — voir postes.js, MOIS_CANTINE_REDUITS)
// ============================================================
function openEditerMontantReduitModal(posteId) {
  const poste = STATE.postes.find(p => p.id === posteId);
  if (!poste) return;

  openModal(`
    <div class="modal-title">Définir le montant — ${escapeHtml(poste.label)}</div>
    <div class="modal-text">Ce mois a un effectif réduit (rentrée, congés) : le montant dû ne suit pas le tarif plein et se saisit manuellement.</div>
    <div class="field">
      <label>Montant dû (F CFA)</label>
      <input type="number" id="editMontantReduit" min="0" step="500" value="${poste.du || 0}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn btn-primary" id="modalEnregistrer"><i class="bi bi-check-lg"></i> Enregistrer</button>
    </div>
  `);

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalEnregistrer").addEventListener("click", async () => {
    const montant = parseFloat(document.getElementById("editMontantReduit").value) || 0;
    const ancienDu = poste.du;
    poste.du = montant;
    try {
      await dbUpsertPostes([poste]);
      closeModal();
      refreshAllTabs();
      showToast("Montant mis à jour.", "success");
    } catch (err) {
      poste.du = ancienDu;
      console.error(err);
      showToast("Erreur lors de la mise à jour : " + err.message, "error");
    }
  });
}

// ============================================================
// MODAL — MODIFIER LES OPTIONS (services souscrits)
// ============================================================
function openEditOptionsModal(enfantId) {
  const enfant = STATE.enfants.find(e => e.id === enfantId);
  if (!enfant) return;
  const opt = enfant.opt || {};
  const allowed = SERVICE_RULES[enfant.sect] || [];

  const services = [
    { key: "ptdej",   label: "Petit-déjeuner" },
    { key: "dej",     label: "Déjeuner" },
    { key: "gout",    label: "Goûter" },
    { key: "gard",    label: "Garderie midi (3 000 F/mois)" },
    { key: "four",    label: "Fournitures (montant libre)" },
    { key: "cantC",   label: "Cantine crèche" },
    { key: "halte",   label: "Halte-garderie / Samedi / Nuitée" }
  ].filter(s => allowed.includes(s.key));

  const checkboxesHtml = services.map(s => `
    <label class="checkbox-item ${opt[s.key] === "oui" ? "checked" : ""}">
      <input type="checkbox" data-svc-edit="${s.key}" ${opt[s.key] === "oui" ? "checked" : ""}>
      ${s.label}
    </label>`).join("");

  const uniformesOk = enfant.sect !== "creche";
  const unifPoste = STATE.postes.find(p => p.enfant_id === enfant.id && p.cat === "Uniformes" && !p.is_var && p.key !== "avance");
  const montantUnifVal = opt.montantUnif !== undefined ? opt.montantUnif : (unifPoste ? (unifPoste.du || 0) : 0);

  openModal(`
    <div class="modal-title">Modifier les options — ${escapeHtml(enfant.nom)}</div>
    <div class="modal-text">Les paiements déjà enregistrés sont conservés même si un service est désactivé.</div>
    <div class="checkbox-grid">${checkboxesHtml || '<p class="text-muted">Aucun service optionnel pour cette section.</p>'}</div>
    ${uniformesOk ? `
    <div class="field mt-2">
      <label>Montant uniforme (F CFA)</label>
      <input type="number" id="editMontantUnif" min="0" step="500" value="${montantUnifVal}" placeholder="0 F CFA (montant libre)">
      <div class="field-hint">Montant libre à saisir manuellement (tissu complet, demi-tissu, tenue...). Laisser à 0 si aucun uniforme.</div>
    </div>` : ""}
    <div class="form-grid mt-2">
      <div class="field">
        <label>Remise accordée (F CFA)</label>
        <input type="number" id="editRemise" min="0" step="500" value="${opt.remise || 0}">
      </div>
      <div class="field">
        <label>Remise applicable sur</label>
        <select id="editRemiseCible">
          <option value="Cantine" ${(opt.remiseCible||enfant.remise_cible)==="Cantine"?"selected":""}>Mensualité cantine</option>
          <option value="Crèche" ${(opt.remiseCible||enfant.remise_cible)==="Crèche"?"selected":""}>Mensualité crèche</option>
          <option value="Scolarité" ${(opt.remiseCible||enfant.remise_cible)==="Scolarité"?"selected":""}>Scolarité</option>
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn btn-primary" id="modalEnregistrer"><i class="bi bi-check-lg"></i> Enregistrer</button>
    </div>
  `);

  document.querySelectorAll("[data-svc-edit]").forEach(cb => {
    cb.addEventListener("change", () => cb.closest(".checkbox-item").classList.toggle("checked", cb.checked));
  });

  // La garderie de midi est incluse d'office dès que le Déjeuner est
  // souscrit — même lien que sur le formulaire de création.
  const dejEdit = document.querySelector('[data-svc-edit="dej"]');
  const gardEdit = document.querySelector('[data-svc-edit="gard"]');
  if (dejEdit && gardEdit) {
    const appliquerLien = () => {
      if (dejEdit.checked) {
        gardEdit.checked = true;
        gardEdit.disabled = true;
      } else {
        gardEdit.disabled = false;
      }
      gardEdit.closest(".checkbox-item").classList.toggle("checked", gardEdit.checked);
      gardEdit.closest(".checkbox-item").classList.toggle("disabled", gardEdit.disabled);
    };
    dejEdit.addEventListener("change", appliquerLien);
    appliquerLien();
  }

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalEnregistrer").addEventListener("click", async () => {
    const newOpt = { ...opt };
    services.forEach(s => {
      const cb = document.querySelector(`[data-svc-edit="${s.key}"]`);
      newOpt[s.key] = cb.checked ? "oui" : "non";
    });
    if (uniformesOk) {
      const mUnif = parseFloat(document.getElementById("editMontantUnif")?.value) || 0;
      newOpt.montantUnif = mUnif;
      newOpt.unif = mUnif > 0 ? "oui" : "non";
    } else {
      newOpt.montantUnif = 0;
      newOpt.unif = "non";
    }
    const remise = parseFloat(document.getElementById("editRemise").value) || 0;
    const remiseCible = document.getElementById("editRemiseCible").value;
    newOpt.remise = remise > 0 ? remise : 0;
    newOpt.remiseCible = remiseCible;

    const resultat = reconcilerPostes(enfant, newOpt);

    try {
      await dbReplacePostesEnfant(enfant.id, resultat);
      await dbUpdateEnfant(enfant.id, { opt: newOpt, remise, remise_cible: remiseCible });
      enfant.opt = newOpt;
      enfant.remise = remise;
      enfant.remise_cible = remiseCible;
      STATE.postes = STATE.postes.filter(p => p.enfant_id !== enfant.id).concat(resultat);
      closeModal();
      refreshAllTabs();
      showToast("Options mises à jour.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la mise à jour : " + err.message, "error");
    }
  });
}

// ============================================================
// MODAL — MODIFIER LE PROFIL (sans supprimer le dossier)
// ============================================================
// `champCible` (optionnel) : nom court du champ à mettre en évidence à
// l'ouverture (ex. "ddn" pour la date de naissance) — utilisé par le
// tableau de bord pour compléter un dossier en quelques secondes.
function openEditProfilModal(enfantId, champCible) {
  const enfant = STATE.enfants.find(e => e.id === enfantId);
  if (!enfant) return;

  openModal(`
    <div class="modal-title">Modifier le profil — ${escapeHtml(enfant.nom)}</div>
    <div class="form-grid">
      <div class="field"><label>Nom complet</label><input type="text" id="editNom" value="${escapeHtml(enfant.nom)}"></div>
      <div class="field"><label>Sexe</label>
        <select id="editSexe">
          <option value="" ${!enfant.sexe?"selected":""}>— Non renseigné —</option>
          <option value="F" ${enfant.sexe==="F"?"selected":""}>Fille</option>
          <option value="M" ${enfant.sexe==="M"?"selected":""}>Garçon</option>
        </select>
      </div>
      <div class="field"><label>Civilité du parent</label>
        <select id="editCivilite">
          <option value="—" ${enfant.civilite==="—"?"selected":""}>—</option>
          <option value="Monsieur" ${enfant.civilite==="Monsieur"?"selected":""}>Monsieur</option>
          <option value="Madame" ${enfant.civilite==="Madame"?"selected":""}>Madame</option>
        </select>
      </div>
      <div class="field"><label>Nom du parent</label><input type="text" id="editParent" value="${escapeHtml(enfant.parent||"")}"></div>
      <div class="field"><label>Téléphone (WhatsApp)</label><input type="tel" id="editTel" value="${escapeHtml(enfant.tel||"")}"></div>
      <div class="field"><label>Date de naissance</label><input type="date" id="editDdn" value="${enfant.ddn||""}"></div>
      <div class="field" ${enfant.sect !== "creche" ? 'style="display:none;"' : ""}><label>Date d'inscription <span class="text-muted">(Crèche uniquement)</span></label><input type="date" id="editDateInscription" value="${enfant.date_inscription||""}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn btn-primary" id="modalEnregistrer"><i class="bi bi-check-lg"></i> Enregistrer</button>
    </div>
  `);

  // Ciblage direct d'un champ (ex. bouton « Modifier » du tableau de bord
  // pour saisir une date de naissance manquante) : le champ est mis en
  // évidence, centré à l'écran et le curseur y est placé immédiatement.
  if (champCible) {
    const idChamp = "edit" + champCible.charAt(0).toUpperCase() + champCible.slice(1);
    const champ = document.getElementById(idChamp);
    if (champ) {
      champ.classList.add("champ-cible");
      requestAnimationFrame(() => {
        champ.scrollIntoView({ behavior: "smooth", block: "center" });
        champ.focus({ preventScroll: true });
      });
    }
  }

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalEnregistrer").addEventListener("click", async () => {
    const patch = {
      nom: document.getElementById("editNom").value.trim(),
      sexe: document.getElementById("editSexe").value || null,
      civilite: document.getElementById("editCivilite").value,
      parent: document.getElementById("editParent").value.trim(),
      tel: document.getElementById("editTel").value.trim(),
      ddn: document.getElementById("editDdn").value || null,
      date_inscription: enfant.sect === "creche" ? (document.getElementById("editDateInscription").value || null) : null
    };
    if (!patch.nom) { showToast("Le nom ne peut pas être vide.", "error"); return; }

    try {
      await dbUpdateEnfant(enfant.id, patch);
      Object.assign(enfant, patch);
      closeModal();
      refreshAllTabs();
      showToast("Profil mis à jour.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la mise à jour : " + err.message, "error");
    }
  });
}

// ============================================================
// SUPPRESSION D'UN DOSSIER
// ============================================================
function openDeleteEnfantModal(enfantId) {
  const enfant = STATE.enfants.find(e => e.id === enfantId);
  if (!enfant) return;
  const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
  const reste = tReste(postesEnfant);

  confirmModal({
    titre: "Supprimer ce dossier ?",
    texte: `Vous êtes sur le point de supprimer définitivement le dossier de <strong>${escapeHtml(enfant.nom)}</strong> (reste dû : ${fmtFCFA(reste)}). Cette action est irréversible et supprimera également ses postes financiers et son suivi scolaire.`,
    labelConfirmer: "Supprimer le dossier",
    onConfirm: async () => {
      try {
        await dbDeleteEnfant(enfant.id);
        STATE.enfants = STATE.enfants.filter(e => e.id !== enfant.id);
        STATE.postes = STATE.postes.filter(p => p.enfant_id !== enfant.id);
        STATE.suivi = STATE.suivi.filter(s => s.enfant_id !== enfant.id);
        STATE.entrees.forEach(en => { if (en.enfant_id === enfant.id) en.enfant_id = null; });
        openIds.delete(enfant.id);
        refreshAllTabs();
        showToast("Dossier supprimé.", "success");
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la suppression : " + err.message, "error");
      }
    }
  });
}

// ============================================================
// IMPRESSION D'UNE FICHE
// ============================================================
function imprimerFiche(enfantId) {
  openIds.add(enfantId);
  renderEnfantsList();
  document.body.classList.add("print-fiche");
  const item = document.getElementById(`enfant-${enfantId}`);
  if (item) item.classList.add("print-only");
  window.print();
}
window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-fiche");
  document.querySelectorAll(".enfant-item.print-only").forEach(el => el.classList.remove("print-only"));
});

// ============================================================
// EXPORT CSV ENRICHI (Bilan général + Bilans secteurs + Élèves)
// ============================================================
function exportEnfantsCsv() {
  if (STATE.enfants.length === 0 && STATE.entrees.length === 0) {
    showToast("Aucune donnée à exporter.", "error");
    return;
  }

  const lignes = [];

  // --- 1. BILAN FINANCIER GÉNÉRAL DE L'ÉCOLE ---
  const totalEntrees = STATE.entrees.reduce((s, e) => s + (Number(e.mt) || 0), 0);
  const totalSorties = STATE.sorties.reduce((s, x) => s + (Number(x.mt) || 0), 0);
  const soldeNetGeneral = totalEntrees - totalSorties;
  const totalDu = STATE.enfants.reduce((s, e) => s + tDu(STATE.postes.filter(p => p.enfant_id === e.id)), 0);
  const totalPaye = STATE.enfants.reduce((s, e) => s + tPaye(STATE.postes.filter(p => p.enfant_id === e.id)), 0);
  const totalReste = STATE.enfants.reduce((s, e) => s + tReste(STATE.postes.filter(p => p.enfant_id === e.id)), 0);
  const tauxRecouvrement = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  lignes.push(["=== BILAN FINANCIER GENERAL DE L'ECOLE (2026-2027) ==="]);
  lignes.push(["Indicateur", "Montant (F CFA)"]);
  lignes.push(["Total entrees encaissees", totalEntrees]);
  lignes.push(["Total depenses (sorties)", totalSorties]);
  lignes.push(["Resultat net de l'ecole", soldeNetGeneral]);
  lignes.push(["Creances familles (reste a recouvrer)", totalReste]);
  lignes.push(["Resultat net previsionnel", soldeNetGeneral + totalReste]);
  lignes.push(["Taux de recouvrement", `${tauxRecouvrement}%`]);
  lignes.push([]);

  // --- 2. BILANS PAR SECTION & SECTEUR ---
  lignes.push(["=== BILANS PAR SECTION ET SECTEUR ==="]);
  lignes.push(["Section / Secteur", "Entrees encaissees", "Sorties imputees", "Solde net", "Total attendu", "Reste a recouvrer"]);

  const enfantParId = {};
  STATE.enfants.forEach(e => { enfantParId[e.id] = e; });
  const sortiesParSecteur = {};
  STATE.sorties.forEach(s => {
    const sect = s.secteur || "Administratif / Divers";
    sortiesParSecteur[sect] = (sortiesParSecteur[sect] || 0) + (Number(s.mt) || 0);
  });

  BILAN_CATEGORIES_FIXES.forEach(catEntry => {
    let du = 0, paye = 0;
    STATE.postes.forEach(p => {
      if (p.is_remise || p.key === "avance") return;
      if (catEntry.match(p, enfantParId[p.enfant_id])) {
        du += p.du || 0;
        paye += p.paye || 0;
      }
    });
    const sorties = sortiesParSecteur[catEntry.label] || 0;
    const soldeNet = paye - sorties;
    const auChoix = BILAN_SECTEURS_AU_CHOIX.includes(catEntry.label);
    const reste = auChoix ? "—" : Math.max(du - paye, 0);
    const duTxt = auChoix ? "—" : du;

    lignes.push([catEntry.label, paye, sorties, soldeNet, duTxt, reste]);
  });

  const autresSorties = sortiesParSecteur["Administratif / Divers"] || 0;
  if (autresSorties > 0) {
    lignes.push(["Administratif / Divers", 0, autresSorties, -autresSorties, "—", "—"]);
  }
  lignes.push([]);

  // --- 3. SYNTHÈSE DES DOSSIERS ÉLÈVES ---
  lignes.push(["=== SYNTHESE DES DOSSIERS ELEVES ==="]);
  lignes.push(["Nom eleve", "Section", "Statut", "Total du", "Total paye", "Reste a payer", "Statut paiement"]);

  STATE.enfants.slice().sort((a, b) => a.nom.localeCompare(b.nom)).forEach(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const st = statutPaiement(postesEnfant);
    const stLabel = STATUT_INFO[st]?.texte || st;
    lignes.push([
      e.nom,
      SECT_LABELS[e.sect] || e.sect,
      e.stat === "nouveau" ? "Nouveau" : "Ancien",
      tDu(postesEnfant),
      tPaye(postesEnfant),
      tReste(postesEnfant),
      stLabel
    ]);
  });

  const csv = lignes.map(l => (l.length === 0 ? "" : l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"))).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bulles-de-joie-bilan-et-eleves-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Export CSV généré avec succès.", "success");
}

// ============================================================
// AUTO-RÉPARATION & SYNCHRONISATION DES DOSSIERS
// ============================================================
// Régularise automatiquement les dossiers sans postes ou les versements
// d'inscription qui n'avaient pas été crédités sur le poste 'inscr'.
async function synchroniserEtReparerDossiers() {
  let modifs = false;
  const postesAMettreAJour = [];

  for (const enfant of STATE.enfants) {
    let postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);

    // 1. Régénération des postes pour les dossiers vides (évite le faux statut "Soldé")
    if (postesEnfant.length === 0) {
      console.warn(`Régénération des postes financiers pour ${enfant.nom}`);
      const nouveaux = fabriquerPostesEnfant(enfant.id, enfant.sect, enfant.stat, enfant.opt || {});
      STATE.postes.push(...nouveaux);
      postesAMettreAJour.push(...nouveaux);
      postesEnfant = nouveaux;
      modifs = true;
    }

    // 2. Régularisation des inscriptions enregistrées mais restant à 0 versé
    const entreesInscr = STATE.entrees.filter(en => en.enfant_id === enfant.id && (
      (en.sect || "").includes("Inscription") ||
      (en.note || "").toLowerCase().includes("inscription") ||
      (en.note || "").toLowerCase().includes("réinscription")
    ));
    const totalInscrEntrees = entreesInscr.reduce((s, en) => s + (Number(en.mt) || 0), 0);
    const posteInscr = postesEnfant.find(p => p.key === "inscr");

    if (posteInscr && totalInscrEntrees > 0 && (posteInscr.paye || 0) < Math.min(posteInscr.du, totalInscrEntrees)) {
      console.log(`Régularisation inscription pour ${enfant.nom} : ${totalInscrEntrees} F CFA`);
      posteInscr.paye = Math.min(posteInscr.du, totalInscrEntrees);
      postesAMettreAJour.push(posteInscr);
      modifs = true;
    }
  }

  if (modifs && postesAMettreAJour.length > 0) {
    try {
      await dbUpsertPostes(postesAMettreAJour);
    } catch (err) {
      console.error("Erreur de synchronisation automatique :", err);
    }
  }
}

