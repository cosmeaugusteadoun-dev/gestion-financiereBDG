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
  if (document.getElementById("fConsentWhatsApp")?.checked && !telephoneConsentementWhatsApp(tel)) { showToast("Renseignez un numéro WhatsApp valide avant de valider le consentement.", "error"); return; }

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
  opt.whatsapp_consent = preparerConsentementWhatsApp(null, !!document.getElementById("fConsentWhatsApp")?.checked, tel, parent);
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
  const anciens = STATE.postes.filter(p => p.enfant_id === enfant.id).map(p => ({ ...p }));

  // Annule d'abord le crédit de l'ancienne remise (si présente), pour
  // repartir d'un historique de paiements "propre" avant d'appliquer la
  // nouvelle — sinon une remise modifiée s'additionnerait à l'ancienne.
  ((enfant.opt || {}).remise_allocations || []).forEach(a => {
    const poste = anciens.find(p => p.id === a.poste_id);
    if (poste) poste.paye = Math.max((poste.paye || 0) - (a.montant || 0), 0);
  });

  const ancienParKey = {};
  anciens.forEach(p => { ancienParKey[p.key] = p; });

  const nouveauxBruts = buildPostes(enfant.sect, enfant.stat, newOpt).filter(p => !repasReduitHistorique(p, anciens));
  const resultat = [];

  nouveauxBruts.forEach(np => {
    const anc = ancienParKey[np.key];
    resultat.push({
      id: anc ? anc.id : `${enfant.id}_${np.key}`,
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
    if ((p.paye || 0) > 0 || (p.key.indexOf("cantine_reduit_") === 0 && p.du > 0)) resultat.push(p);
  });

  // Applique la nouvelle remise directement sur les postes réels, comme un
  // paiement classique, et mémorise les allocations dans newOpt pour
  // pouvoir l'annuler proprement la prochaine fois que le dossier change.
  appliquerMoisNonSouscrits(resultat, newOpt);
  appliquerTarifsFixes(enfant.sect, resultat, newOpt);
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
    liste = liste.filter(e => correspondStatut(statutPaiement(STATE.postes.filter(p => p.enfant_id === e.id)), filtreStatut));
  }
  liste = liste.slice().sort((a, b) => a.nom.localeCompare(b.nom));
  majCompteurListe(root, liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<div class="empty-state"><div class="icon"><i class="bi bi-people"></i></div>Aucun dossier ne correspond à votre recherche.</div>`;
    return;
  }

  root.innerHTML = liste.map(renderEnfantItem).join("");
  wireEnfantItemEvents();
}

var STATUT_INFO = {
  solde:          { badge: "badge-green",  icon: "bi-check-circle-fill",      texte: "Soldé" },
  a_jour:         { badge: "badge-green",  icon: "bi-check-circle-fill",      texte: "À jour" },
  retard_scol:    { badge: "badge-red",    icon: "bi-exclamation-triangle-fill", texte: "Retard de scolarité" },
  retard_creche:  { badge: "badge-orange", icon: "bi-exclamation-circle-fill",   texte: "Retard de crèche" },
  retard_cantine: { badge: "badge-orange", icon: "bi-cup-hot-fill",              texte: "Retard de cantine" }
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
  const info = STATUT_INFO[statut] || STATUT_INFO.a_jour;
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
  postesEnfant.filter(p => !p.is_remise && !(p.key.indexOf("cantine_reduit_") === 0 &&
    !(p.du > 0) && !(p.paye > 0) && postesEnfant.some(x => x.mois === p.mois && /^(ptdej|dej)_reduit_/.test(x.key)))).forEach(p => {
    const catAffichage = PONCTUEL_CRECHE_CATS.includes(p.cat) ? "Crèche" : p.cat === "Garderie" ? "Cantine" : p.cat;
    if (!categories[catAffichage]) categories[catAffichage] = [];
    categories[catAffichage].push(p);
  });

  // Rendu d'une ligne de poste (montant dû + versé/restant, badge retard).
  // posteIdEditable : pour les mois à effectif réduit (Cantine/Goûter/
  // Cantine crèche de mars, juin, septembre) dont le montant est saisi
  // manuellement — affiche une icône crayon pour le définir/l'ajuster.
  function renderPosteRow(label, du, paye, isVar, retard, posteIdEditable, montantNonDefini, absent) {
    const reste = isVar ? Math.max(-(paye || 0), 0) : Math.max((du || 0) - (paye || 0), 0);
    const duTxt = absent ? "Non facturé" : isVar ? "Montant libre" : (montantNonDefini ? "À définir" : fmtFCFA(du));

    // Transparence totale : dès qu'un poste n'est pas soldé, on affiche à la
    // fois ce qui a déjà été versé (en bleu) et ce qu'il reste (en rouge/orange)
    // — jamais le reste seul, ni les deux dans la même couleur : ça se confond.
    let statutHtml;
    if (absent) {
      statutHtml = '<span class="text-muted">Absent / non souscrit</span>';
    } else if (isVar) {
      statutHtml = `<span class="text-blue">${fmtFCFA(paye)} versé</span>`;
    } else if (montantNonDefini) {
      statutHtml = `<span class="text-muted">Montant non défini</span>`;
    } else if (reste <= 0) {
      statutHtml = `<span class="text-green">Soldé</span>`;
    } else {
      const resteClass = retard ? "text-red" : "text-orange";
      statutHtml = `<span class="text-blue">Versé ${fmtFCFA(paye || 0)}</span> · <span class="${resteClass}">Restant ${fmtFCFA(reste)}</span>`;
    }

    const editBtn = posteIdEditable && !absent
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

  // Les postes sont triés chronologiquement (Sep → Aoû) au sein de chaque
  // catégorie : l'ordre renvoyé par la base n'est pas garanti et le dossier
  // affichait parfois Février avant Avril, puis Octobre…
  const ORDRE_KEYS_SANS_MOIS = ["inscr","t1","t2","t3","act","fetes","assur","ape","halte","unif","unif_tenue","unif_sport","four","avance"];
  const rangPoste = p => {
    if (p.mois) return MOIS_ORDRE_AFFICHAGE.indexOf(p.mois);
    const i = ORDRE_KEYS_SANS_MOIS.indexOf(p.key);
    return 100 + (i === -1 ? 50 : i);
  };
  Object.keys(categories).forEach(cat => {
    categories[cat].sort((a, b) => rangPoste(a) - rangPoste(b));
  });

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
          const posteReduitObj = g.postes.find(p => p.is_reduit && !posteEstAbsent(p));
          const posteReduit = posteReduitObj ? posteReduitObj.id : null;
          const montantNonDefini = g.postes.length === 1 && !!posteReduitObj && !posteReduitObj.du;
          const absents = g.postes.filter(p => posteEstAbsent(p));
          const detail = absents.length && absents.length < g.postes.length ? ` — non souscrit : ${absents.map(p => p.label).join(", ")}` : "";
          return renderPosteRow(`Cantine ${mois}${detail}`, g.du, g.paye, false, retard, posteReduit, montantNonDefini, absents.length === g.postes.length);
        }).join("")
        + horsMois.map(p => renderPosteRow(p.label, p.du, p.paye, p.is_var, posteEnRetard(p))).join("");
    } else {
      lignes = categories[cat].map(p => {
        // Le libellé « montant à définir » n'a plus lieu d'être une fois le
        // montant saisi au crayon — ou fixé par un versement ciblé sur ce mois.
        const label = (p.is_reduit && p.du > 0) ? p.label.replace(" — montant à définir", "") : p.label;
        return renderPosteRow(label, p.du, p.paye, p.is_var, posteEnRetard(p), p.is_reduit ? p.id : null, p.is_reduit && !p.du, posteEstAbsent(p));
      }).join("");
    }

    return `<div class="postes-cat"><div class="postes-cat-title">${escapeHtml(cat)} <span class="badge badge-gray">${(lignes.match(/class="poste-row"/g) || []).length}</span></div>${lignes}</div>`;
  }).join("");

  const historique = STATE.entrees
    .filter(en => en.enfant_id === e.id)
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(en => `
      <div class="timeline-item">
        <span class="timeline-date">${formatDateFR(en.date)}</span>
        <span>${escapeHtml(en.sect || "—")}${en.mois ? " · " + escapeHtml(en.mois) : ""}</span>
        <span class="timeline-mt">${fmtFCFA(en.mt)}${entreeRepartitionCorrigeable(en) ? `<button type="button" class="btn btn-ghost btn-sm" data-corriger-repartition="${escapeHtml(en.id)}">Vérifier la répartition</button>` : ""}</span>
      </div>`).join("");

  return `
    <div class="enfant-item ${isOpen ? "open" : ""}" id="enfant-${e.id}" data-id="${e.id}">
      <div class="enfant-header" data-toggle="${e.id}">
        <div class="enfant-id-block">
          <div class="enfant-avatar">${initials(e.nom)}</div>
          <div>
            <div class="enfant-name">${escapeHtml(e.nom)}</div>
            <div class="enfant-meta">${escapeHtml(SECT_LABELS[e.sect] || e.sect)} · ${e.stat === "nouveau" ? "Nouveau" : "Ancien"}${e.tel ? " · " + escapeHtml(e.tel) : ""}</div>
            <div class="enfant-meta">WhatsApp : ${consentementWhatsAppValide(e) ? `accord enregistré le ${formatDateFR(e.opt.whatsapp_consent.recorded_at)}` : "aucun consentement valide enregistré"}</div>
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
          <div class="postes-cat-title">Historique des paiements <span class="badge badge-gray">${STATE.entrees.filter(en => en.enfant_id === e.id).length}</span></div>
          <div class="timeline">${historique || '<p class="text-muted">Aucun paiement enregistré.</p>'}</div>
        </div>

        <div class="enfant-actions">
          <button class="btn btn-secondary btn-sm" data-mois-services="${e.id}"><i class="bi bi-calendar-check"></i> Présence / mois</button>
          <button class="btn btn-secondary btn-sm" data-opt="${e.id}"><i class="bi bi-sliders"></i> Modifier les options</button>
          <button class="btn btn-secondary btn-sm" data-profil="${e.id}"><i class="bi bi-pencil-square"></i> Modifier le profil</button>
          <button class="btn btn-whatsapp btn-sm" data-wa="${e.id}" ${e.tel ? "" : "disabled"}><i class="bi bi-whatsapp"></i> Envoyer bilan WhatsApp</button>
          <button class="btn btn-ghost btn-sm" data-print="${e.id}"><i class="bi bi-printer"></i> Imprimer la fiche</button>
          <button class="btn btn-danger btn-sm" data-del="${e.id}"><i class="bi bi-trash"></i> Supprimer</button>
        </div>
      </div>
    </div>`;
}

function preparerMoisNonSouscrits(enfant, choix) {
  const opt = JSON.parse(JSON.stringify(enfant.opt || {}));
  opt.mois_non_souscrits = { ...(opt.mois_non_souscrits || {}) };
  const postes = STATE.postes.filter(p => p.enfant_id === enfant.id).map(p => ({ ...p }));
  postes.forEach(p => {
    if (!p.mois || !Object.prototype.hasOwnProperty.call(choix, p.key)) return;
    const ancien = opt.mois_non_souscrits[p.key];
    if (choix[p.key]) {
      if (p.paye > 0) throw new Error(`${p.label} : un versement ou une remise existe déjà. Corrigez ce versement avant de marquer le mois absent.`);
      opt.mois_non_souscrits[p.key] = { absent: true, du: ancien?.absent ? ancien.du : (Number(p.du) || 0) };
      p.du = 0;
    } else if (ancien?.absent) {
      p.du = Number(ancien.du) || 0;
      // Garder le tarif réactivé permet de le restaurer même si l'écriture
      // des postes échoue après celle des options.
      opt.mois_non_souscrits[p.key] = { absent: false, du: p.du };
    }
  });
  appliquerTarifsFixes(enfant.sect, postes, opt);
  return { opt, postes };
}

async function enregistrerMoisNonSouscrits(enfant, choix) {
  if (correctionEntreeEnCours || correctionMensuelleEnAttente(enfant.id)) throw new Error("Terminez la synchronisation de la répartition avant de modifier ces mois. Rechargez la page.");
  const resultat = preparerMoisNonSouscrits(enfant, choix);
  // Les options sont la source durable de la participation et de son tarif.
  // La synchronisation au chargement répare une écriture des postes interrompue.
  await dbUpdateEnfant(enfant.id, { opt: resultat.opt });
  enfant.opt = resultat.opt;
  STATE.postes = STATE.postes.filter(p => p.enfant_id !== enfant.id).concat(resultat.postes);
  try {
    await dbUpsertPostes(resultat.postes);
  } catch (err) {
    throw new Error(`Participation enregistrée ; synchronisation des montants incomplète : ${err.message}. Rechargez la page, sans ressaisir les paiements.`);
  }
}

function openMoisServicesModal(enfantId) {
  const enfant = STATE.enfants.find(e => e.id === enfantId);
  if (!enfant) return;
  const postes = STATE.postes.filter(p => p.enfant_id === enfantId && p.mois && !p.is_var && !p.is_remise);
  if (!postes.length) { showToast("Aucun service mensuel dans ce dossier.", "error"); return; }
  const ordre = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
  postes.sort((a, b) => ordre.indexOf(a.mois) - ordre.indexOf(b.mois) || a.label.localeCompare(b.label));
  openModal(`
    <div class="modal-title">Présence / mois — ${escapeHtml(enfant.nom)}</div>
    <p class="modal-text">Choisissez « Absent / non souscrit » pour les services inutilisés. Ces mois ne sont pas facturés et ne génèrent aucun retard. Vous pourrez les réactiver. Un mois déjà crédité conserve son paiement.</p>
    <div style="max-height:55vh;overflow:auto">${postes.map(p => `
      <div class="field">
        <label for="presence-${escapeHtml(p.id)}">${escapeHtml(p.label.replace(/Garderie midi/g, "Garderie"))}</label>
        <select id="presence-${escapeHtml(p.id)}" data-presence-key="${escapeHtml(p.key)}" ${p.paye > 0 ? "disabled" : ""}>
          <option value="actif" ${!posteEstAbsent(p) ? "selected" : ""}>Souscrit${p.paye > 0 ? " — paiement enregistré" : ""}</option>
          <option value="absent" ${posteEstAbsent(p) ? "selected" : ""}>Absent / non souscrit</option>
        </select>
      </div>`).join("")}</div>
    <p id="presenceErreur" role="alert" class="text-red" hidden></p>
    <div class="modal-actions"><button class="btn btn-ghost" id="presenceAnnuler">Annuler</button><button class="btn btn-primary" id="presenceEnregistrer">Enregistrer</button></div>
  `);
  document.getElementById("presenceAnnuler").addEventListener("click", closeModal);
  document.getElementById("presenceEnregistrer").addEventListener("click", async ev => {
    const bouton = ev.currentTarget;
    if (bouton.disabled) return;
    const choix = {};
    document.querySelectorAll("[data-presence-key]").forEach(el => { choix[el.dataset.presenceKey] = el.value === "absent"; });
    bouton.disabled = true;
    try {
      await enregistrerMoisNonSouscrits(enfant, choix);
      closeModal(); refreshAllTabs();
      showToast("Participation mensuelle enregistrée.", "success");
    } catch (err) {
      bouton.disabled = false;
      const zone = document.getElementById("presenceErreur");
      zone.hidden = false; zone.textContent = err.message;
      showToast(err.message, "error");
    }
  });
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
  document.querySelectorAll("[data-mois-services]").forEach(btn => btn.addEventListener("click", () => openMoisServicesModal(btn.dataset.moisServices)));
  document.querySelectorAll("[data-corriger-repartition]").forEach(btn => btn.addEventListener("click", () => openCorrectionMensuelleModal(btn.dataset.corrigerRepartition)));
  document.querySelectorAll("[data-profil]").forEach(btn => btn.addEventListener("click", () => openEditProfilModal(btn.dataset.profil)));
  document.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", (ev) => {
    ev.stopPropagation(); // évite de (dé)plier le dossier quand on clique la poubelle de l'en-tête
    openDeleteEnfantModal(btn.dataset.del);
  }));
  document.querySelectorAll("[data-print]").forEach(btn => btn.addEventListener("click", () => imprimerFiche(btn.dataset.print)));
  document.querySelectorAll("[data-wa]").forEach(btn => btn.addEventListener("click", () => {
    const enfant = STATE.enfants.find(e => e.id === btn.dataset.wa);
    if (!enfant) return;
    ouvrirModeleParent(enfant, "bilan_financier");
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
  if (!poste || posteEstAbsent(poste)) return;
  if (correctionEntreeEnCours || correctionMensuelleEnAttente(poste.enfant_id)) { showToast("Rechargez la page pour terminer la correction avant de modifier ce montant.", "error"); return; }

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
  document.getElementById("modalEnregistrer").addEventListener("click", async ev => {
    const bouton = ev.currentTarget;
    if (bouton.disabled) return;
    const montant = parseFloat(document.getElementById("editMontantReduit").value) || 0;
    if (!Number.isSafeInteger(montant) || montant < 0) { showToast("Saisissez un montant entier positif ou nul.", "error"); return; }
    const ancienDu = poste.du;
    const enfant = STATE.enfants.find(e => e.id === poste.enfant_id);
    let tarifEnregistre = false;
    bouton.disabled = true;
    try {
      if (enfant?.opt?.mois_non_souscrits?.[poste.key]) {
        const opt = JSON.parse(JSON.stringify(enfant.opt));
        opt.mois_non_souscrits[poste.key] = { absent: false, du: montant, tarif_manuel: true };
        await dbUpdateEnfant(enfant.id, { opt });
        enfant.opt = opt;
        tarifEnregistre = true;
      }
      poste.du = montant;
      await dbUpsertPostes([poste]);
      closeModal();
      refreshAllTabs();
      showToast("Montant mis à jour.", "success");
    } catch (err) {
      if (!tarifEnregistre) poste.du = ancienDu;
      bouton.disabled = false;
      console.error(err);
      showToast((tarifEnregistre ? "Tarif enregistré, rechargez la page pour terminer la synchronisation : " : "Erreur lors de la mise à jour : ") + err.message, "error");
    }
  });
}

// ============================================================
// MODAL — MODIFIER LES OPTIONS (services souscrits)
// ============================================================
function openEditOptionsModal(enfantId) {
  if (correctionEntreeEnCours || correctionMensuelleEnAttente(enfantId)) { showToast("Rechargez la page pour terminer la correction avant de modifier les options.", "error"); return; }
  const enfant = STATE.enfants.find(e => e.id === enfantId);
  if (!enfant) return;
  const opt = enfant.opt || {};
  const allowed = SERVICE_RULES[enfant.sect] || [];

  const services = [
    { key: "ptdej",   label: "Petit-déjeuner" },
    { key: "dej",     label: "Déjeuner" },
    { key: "gout",    label: "Goûter" },
    { key: "gard",    label: "Garderie" },
    { key: "four",    label: MAT_SECTS.includes(enfant.sect) ? "Fournitures (20 000 F CFA)" : "Fournitures (montant libre)" },
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
      <div class="field" style="grid-column:1 / -1"><label class="checkbox-item"><input type="checkbox" id="editConsentWhatsApp" ${consentementWhatsAppValide(enfant) ? "checked" : ""}> Le parent a consenti à recevoir les notifications WhatsApp</label><div class="field-hint" id="editConsentHint">${consentementWhatsAppValide(enfant) ? `Accord enregistré le ${formatDateFR(enfant.opt.whatsapp_consent.recorded_at)}.` : "Aucun consentement valide enregistré."} La date est enregistrée automatiquement à la validation de l'accord.</div></div>
      <div class="field"><label>Date de naissance</label><input type="date" id="editDdn" value="${enfant.ddn||""}"></div>
      <div class="field" ${enfant.sect !== "creche" ? 'style="display:none;"' : ""}><label>Date d'inscription <span class="text-muted">(Crèche uniquement)</span></label><input type="date" id="editDateInscription" value="${enfant.date_inscription||""}"></div>
      <details style="grid-column:1 / -1"><summary>Présence / absence par service et par mois</summary>
        ${STATE.postes.filter(p => p.enfant_id === enfant.id && p.mois && !p.is_var && !p.is_remise).sort((a,b) => MOIS_CRECHE.indexOf(a.mois) - MOIS_CRECHE.indexOf(b.mois)).map(p => `<div class="field"><label>${escapeHtml(p.label)}</label><select data-profil-presence="${escapeHtml(p.key)}" ${Number(p.paye) > 0 ? "disabled" : ""}><option value="actif" ${!posteEstAbsent(p) ? "selected" : ""}>Souscrit${Number(p.paye) > 0 ? " — paiement enregistré" : ""}</option><option value="absent" ${posteEstAbsent(p) ? "selected" : ""}>Absent / non souscrit</option></select></div>`).join("") || '<p>Aucun service mensuel souscrit.</p>'}
      </details>
    </div>
    <p id="profilErreur" role="alert" class="text-red" hidden></p>
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
  ["editTel", "editParent"].forEach(id => document.getElementById(id).addEventListener("input", () => {
    document.getElementById("editConsentWhatsApp").checked = false;
    document.getElementById("editConsentHint").textContent = "Coordonnées modifiées : validez de nouveau l'accord pour ce contact.";
  }));
  document.getElementById("modalEnregistrer").addEventListener("click", async ev => {
    const bouton = ev.currentTarget;
    if (bouton.disabled) return;
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
      bouton.disabled = true;
      document.getElementById("profilErreur").hidden = true;
      patch.opt = { ...(enfant.opt || {}), whatsapp_consent: preparerConsentementWhatsApp(enfant.opt?.whatsapp_consent, document.getElementById("editConsentWhatsApp").checked, patch.tel, patch.parent) };
      const choix = {};
      document.querySelectorAll("[data-profil-presence]").forEach(el => { choix[el.dataset.profilPresence] = el.value === "absent"; });
      const participation = preparerMoisNonSouscrits({ ...enfant, opt: patch.opt }, choix);
      patch.opt = participation.opt;
      if (correctionEntreeEnCours || correctionMensuelleEnAttente(enfant.id)) throw new Error("Terminez la correction de répartition avant de modifier le profil.");
      await dbUpdateEnfant(enfant.id, patch);
      Object.assign(enfant, patch);
      const montantsModifies = participation.postes.filter(p => {
        const avant = STATE.postes.find(x => x.id === p.id);
        return !avant || Number(avant.du) !== Number(p.du) || Number(avant.paye) !== Number(p.paye);
      });
      await dbUpsertPostes(montantsModifies);
      STATE.postes = STATE.postes.filter(p => p.enfant_id !== enfant.id).concat(participation.postes);
      closeModal();
      refreshAllTabs();
      showToast("Profil mis à jour.", "success");
    } catch (err) {
      console.error(err);
      const zone = document.getElementById("profilErreur");
      zone.hidden = false;
      zone.textContent = `Enregistrement incomplet : ${err.message}. Vos champs sont conservés. Vérifiez la connexion puis réessayez. Si les accès ont été restreints, connectez-vous avec votre compte Supabase.`;
      bouton.disabled = false;
      showToast("Le profil n'a pas pu être entièrement enregistré. Consultez le message du formulaire.", "error");
    }
  });
}

// ============================================================
// SUPPRESSION D'UN DOSSIER
// ============================================================
function openDeleteEnfantModal(enfantId) {
  if (correctionEntreeEnCours || correctionMensuelleEnAttente(enfantId)) { showToast("Rechargez la page pour terminer la correction avant de supprimer ce dossier.", "error"); return; }
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

  // Même source de vérité que l'onglet « Bilans secteurs » : postes crédités
  // + avances, puis au minimum le total réellement reçu d'après les entrées.
  const encaisseParEntree = calculerEncaisseParSecteurDepuisEntrees();

  BILAN_CATEGORIES_FIXES.forEach(catEntry => {
    let du = 0, payePostes = 0, avance = 0;
    STATE.postes.forEach(p => {
      if (p.is_remise) return;
      if (catEntry.match(p, enfantParId[p.enfant_id])) {
        if (p.key === "avance") avance += p.paye || 0;
        else {
          du += p.du || 0;
          payePostes += p.paye || 0;
        }
      }
    });
    const paye = payePostes + avance;
    const encaisse = Math.max(paye, encaisseParEntree[catEntry.label] || 0);

    const sorties = sortiesParSecteur[catEntry.label] || 0;
    const soldeNet = encaisse - sorties;
    const auChoix = BILAN_SECTEURS_AU_CHOIX.includes(catEntry.label);
    const reste = auChoix ? "—" : Math.max(du - payePostes, 0);
    const duTxt = auChoix ? "—" : du;

    lignes.push([catEntry.label, encaisse, sorties, soldeNet, duTxt, reste]);
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
    if (correctionMensuelleEnAttente(enfant.id)) {
      try {
        for (const entree of STATE.entrees.filter(en => en.enfant_id === enfant.id)) await appliquerCorrectionMensuelle(entree);
      } catch (err) {
        console.error("Correction mensuelle en attente :", err);
        showToast(`Répartition de ${enfant.nom} à synchroniser : ${err.message}`, "error");
        continue;
      }
    }
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

    // 2. Postes standards manquants (dossier créé par une version
    // antérieure du logiciel, options non regénérées…) : les frais généraux
    // (activités, fêtes, assurance, APE…) doivent exister pour que les
    // secteurs correspondants soient proposés et que les montants dûs
    // soient justes. Voir aussi entrees.js, completerPostesEnfant.
    const postesCompletes = completerPostesEnfant(enfant);
    if (postesCompletes.length > 0) {
      postesAMettreAJour.push(...postesCompletes);
      postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
      modifs = true;
    }

    // Restaurer les allocations enregistrées lorsque l'entrée a été
    // sauvegardée mais que la mise à jour des postes a échoué. Ne jamais
    // additionner ces sommes à nouveau à chaque ouverture de l'application.
    const versesTraces = new Map();
    STATE.entrees.filter(en => en.enfant_id === enfant.id).forEach(en => {
      (en.allocations || []).forEach(a => {
        let poste = postesEnfant.find(p => p.id === a.poste_id);
        if (!poste && a.poste && a.poste.id === a.poste_id && a.poste.enfant_id === enfant.id) {
          poste = { ...a.poste, paye: 0 };
          postesEnfant.push(poste);
          STATE.postes.push(poste);
        }
        if (!poste) return;
        if (poste.is_reduit && !(poste.du > 0) && a.poste && a.poste.du > 0) {
          poste.du = a.poste.du;
          postesAMettreAJour.push(poste);
          modifs = true;
        }
        versesTraces.set(poste.id, (versesTraces.get(poste.id) || 0) + (Number(a.montant) || 0));
      });
    });
    ((enfant.opt || {}).remise_allocations || []).forEach(a => {
      versesTraces.set(a.poste_id, (versesTraces.get(a.poste_id) || 0) + (Number(a.montant) || 0));
    });
    versesTraces.forEach((montant, id) => {
      const poste = postesEnfant.find(p => p.id === id);
      if (poste && (Number(poste.paye) || 0) < montant) {
        poste.paye = montant;
        postesAMettreAJour.push(poste);
        modifs = true;
      }
    });

    // 3. Régularisation des inscriptions enregistrées mais restant à 0 versé
    const entreesInscr = STATE.entrees.filter(en => en.enfant_id === enfant.id && (
      (en.sect || "").includes("Inscription") ||
      (en.note || "").toLowerCase().includes("inscription") ||
      (en.note || "").toLowerCase().includes("réinscription")
    ));
    const posteInscr = postesEnfant.find(p => p.key === "inscr");
    const totalInscrEntrees = entreesInscr.reduce((s, en) => {
      if (Array.isArray(en.allocations) && en.allocations.length) {
        return s + en.allocations.filter(a => posteInscr && a.poste_id === posteInscr.id)
          .reduce((t, a) => t + (Number(a.montant) || 0), 0);
      }
      // Sans trace, seul un paiement exclusivement d'inscription est sûr.
      return s + ((en.sect || "").trim() === "Inscription" ? (Number(en.mt) || 0) : 0);
    }, 0);

    if (posteInscr && totalInscrEntrees > 0 && (posteInscr.paye || 0) < Math.min(posteInscr.du, totalInscrEntrees)) {
      console.log(`Régularisation inscription pour ${enfant.nom} : ${totalInscrEntrees} F CFA`);
      posteInscr.paye = Math.min(posteInscr.du, totalInscrEntrees);
      postesAMettreAJour.push(posteInscr);
      modifs = true;
    }
  }

  for (const enfant of STATE.enfants) {
    STATE.postes.filter(p => p.enfant_id === enfant.id).forEach(p => {
      const avant = p.du;
      appliquerMoisNonSouscrits([p], enfant.opt || {});
      if (p.du !== avant) { postesAMettreAJour.push(p); modifs = true; }
    });
  }

  for (const enfant of STATE.enfants) {
    const lignes = STATE.postes.filter(p => p.enfant_id === enfant.id);
    const avant = new Map(lignes.map(p => [p.id, JSON.stringify(p)]));
    appliquerTarifsFixes(enfant.sect, lignes, enfant.opt || {});
    lignes.forEach(p => { if (JSON.stringify(p) !== avant.get(p.id)) { postesAMettreAJour.push(p); modifs = true; } });
  }
  if (modifs && postesAMettreAJour.length > 0) {
    try {
      await dbUpsertPostes([...new Map(postesAMettreAJour.map(p => [p.id, p])).values()]);
    } catch (err) {
      console.error("Erreur de synchronisation automatique :", err);
    }
  }
}
