// ============================================================
// enfants.js — Dossiers élèves : création, affichage, options
// ============================================================

// Services disponibles selon la section (filtre dynamique du formulaire)
var SERVICE_RULES = {
  creche:   ["cantC", "halte"],
  garderie: ["four"],
  premat:   ["ptdej", "dej", "gout", "four"],
  mat1:     ["ptdej", "dej", "gout", "four"],
  mat2:     ["ptdej", "dej", "gout", "four"],
  // Le goûter est réservé à la Maternelle sur la fiche tarifaire officielle
  ci:       ["ptdej", "dej", "four"],
  cp:       ["ptdej", "dej", "four"],
  ce1:      ["ptdej", "dej", "four"],
  ce2:      ["ptdej", "dej", "four"],
  cm1:      ["ptdej", "dej", "four"]
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
  document.getElementById("formEnfant").addEventListener("submit", handleCreateEnfant);
  document.getElementById("btnResetEnfant").addEventListener("click", resetEnfantForm);
  document.getElementById("rechEnfant").addEventListener("input", renderEnfantsList);
  document.getElementById("filtreSect").addEventListener("change", renderEnfantsList);
  document.getElementById("filtreStatutPaiement").addEventListener("change", renderEnfantsList);
  document.getElementById("btnExportCsv").addEventListener("click", exportEnfantsCsv);

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
  document.querySelectorAll("#fServices .checkbox-item").forEach(item => {
    const svc = item.dataset.svc;
    const input = item.querySelector("input");
    const ok = allowed.includes(svc);
    input.disabled = !ok;
    if (!ok) {
      input.checked = false;
      item.classList.remove("checked");
    }
    item.classList.toggle("disabled", !ok);
  });

  // Uniformes : tarif fixe à la quantité, disponible pour tous les niveaux sauf la crèche
  const uniformesOk = sect !== "" && sect !== "creche";
  document.querySelectorAll('[data-svc-group="unif"] input').forEach(input => {
    input.disabled = !uniformesOk;
    if (!uniformesOk) input.value = 0;
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
  const annee = document.getElementById("fAnnee").value;
  const remise = parseFloat(document.getElementById("fRemise").value) || 0;
  const remiseCible = document.getElementById("fRemiseCible").value;

  if (!nom || !sect) {
    showToast("Veuillez renseigner au minimum le nom et la section.", "error");
    return;
  }

  const opt = {
    ptdej: document.getElementById("svcPtdej").checked ? "oui" : "non",
    dej:   document.getElementById("svcDej").checked ? "oui" : "non",
    gout:  document.getElementById("svcGout").checked ? "oui" : "non",
    qteTenue: parseInt(document.getElementById("fQteTenue").value, 10) || 0,
    qteSport: parseInt(document.getElementById("fQteSport").value, 10) || 0,
    four:  document.getElementById("svcFour").checked ? "oui" : "non",
    cantC: document.getElementById("svcCantC").checked ? "oui" : "non",
    halte:    document.getElementById("svcHalte").checked ? "oui" : "non",
    remise: remise > 0 ? remise : 0,
    remiseCible
  };

  const id = uid("enf");
  const enfant = { id, nom, sect, stat, sexe, tel, parent, civilite, ddn, annee, opt, remise, remise_cible: remiseCible };
  const postesGeneres = fabriquerPostesEnfant(id, sect, stat, opt);

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
    is_var: !!p.is_var, is_remise: !!p.is_remise
  }));
}

// ============================================================
// RECONCILIATION DES POSTES (modification des options)
// Préserve les montants déjà payés sur les services conservés.
// ============================================================
function reconcilerPostes(enfant, newOpt) {
  const anciens = STATE.postes.filter(p => p.enfant_id === enfant.id);
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
      du: np.du || 0, mois: np.mois || null, dl: np.dl || null,
      is_var: !!np.is_var, is_remise: !!np.is_remise,
      paye: anc ? (anc.paye || 0) : (np.paye || 0)
    });
    delete ancienParKey[np.key];
  });

  // Postes correspondant à un service désormais désactivé : conservés
  // seulement si un montant y a déjà été versé (historique préservé)
  Object.values(ancienParKey).forEach(p => {
    if ((p.paye || 0) > 0) resultat.push(p);
  });

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
  if (filtreStatut) {
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
  partiel: { badge: "badge-orange", icon: "bi-exclamation-circle-fill", texte: "Partiel" },
  impaye:  { badge: "badge-red",    icon: "bi-x-circle-fill",           texte: "Impayé" }
};

function renderEnfantItem(e) {
  const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
  const statut = statutPaiement(postesEnfant);
  const info = STATUT_INFO[statut];
  const isOpen = openIds.has(e.id);

  // Regroupement des postes par catégorie (hors remise, gérée à part)
  // Les services ponctuels de la crèche (halte-garderie, samedi, nuitée)
  // s'affichent regroupés sous "Crèche" plutôt que dans une section à part.
  const categories = {};
  postesEnfant.filter(p => !p.is_remise).forEach(p => {
    const catAffichage = PONCTUEL_CRECHE_CATS.includes(p.cat) ? "Crèche" : p.cat;
    if (!categories[catAffichage]) categories[catAffichage] = [];
    categories[catAffichage].push(p);
  });

  const remisePoste = postesEnfant.find(p => p.is_remise);

  // Rendu d'une ligne de poste (montant dû + versé/restant, badge retard)
  function renderPosteRow(label, du, paye, isVar, retard) {
    const reste = isVar ? Math.max(-(paye || 0), 0) : Math.max((du || 0) - (paye || 0), 0);
    const duTxt = isVar ? "Montant libre" : fmtFCFA(du);

    // Transparence totale : dès qu'un poste n'est pas soldé, on affiche à la
    // fois ce qui a déjà été versé (en bleu) et ce qu'il reste (en rouge/orange)
    // — jamais le reste seul, ni les deux dans la même couleur : ça se confond.
    let statutHtml;
    if (isVar) {
      statutHtml = `<span class="text-blue">${fmtFCFA(paye)} versé</span>`;
    } else if (reste <= 0) {
      statutHtml = `<span class="text-green">Soldé</span>`;
    } else {
      const resteClass = retard ? "text-red" : "text-orange";
      statutHtml = `<span class="text-blue">Versé ${fmtFCFA(paye || 0)}</span> · <span class="${resteClass}">Restant ${fmtFCFA(reste)}</span>`;
    }

    return `
      <div class="poste-row">
        <div class="poste-label">${escapeHtml(label)}${retard ? ' <span class="badge badge-red">retard</span>' : ""}</div>
        <div class="poste-amounts">
          <span class="du">${duTxt}</span>
          <span class="reste">${statutHtml}</span>
        </div>
      </div>`;
  }

  const MOIS_ORDRE_AFFICHAGE = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];

  const catsHtml = Object.keys(categories).map(cat => {
    let lignes;

    if (cat === "Cantine") {
      // Regroupe Petit-déjeuner + Déjeuner (et toute autre option cantine)
      // en un seul total mensuel, plus lisible que le détail poste par poste.
      // Les postes sans mois (ex. une avance mal orientée) restent affichés
      // individuellement plutôt que d'être regroupés sous un mois "null".
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
          return renderPosteRow(`Cantine ${mois}`, g.du, g.paye, false, retard);
        }).join("")
        + horsMois.map(p => renderPosteRow(p.label, p.du, p.paye, p.is_var, posteEnRetard(p))).join("");
    } else {
      lignes = categories[cat].map(p => renderPosteRow(p.label, p.du, p.paye, p.is_var, posteEnRetard(p))).join("");
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
        ${remisePoste ? `<div class="remise-badge"><i class="bi bi-gift-fill"></i> Remise de ${fmtFCFA(remisePoste.paye)} sur ${escapeHtml(remisePoste.cat)}</div>` : ""}
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
  const prixTenueInfo = MAT_SECTS.includes(enfant.sect) ? "8 000 F/unité" : "9 000 F/unité";

  openModal(`
    <div class="modal-title">Modifier les options — ${escapeHtml(enfant.nom)}</div>
    <div class="modal-text">Les paiements déjà enregistrés sont conservés même si un service est désactivé.</div>
    <div class="checkbox-grid">${checkboxesHtml || '<p class="text-muted">Aucun service optionnel pour cette section.</p>'}</div>
    ${uniformesOk ? `
    <div class="form-grid mt-2">
      <div class="field">
        <label>Tenues scolaires — nombre</label>
        <input type="number" id="editQteTenue" min="0" step="1" value="${opt.qteTenue || 0}">
        <div class="field-hint">${prixTenueInfo}</div>
      </div>
      <div class="field">
        <label>Tenues de sport — nombre</label>
        <input type="number" id="editQteSport" min="0" step="1" value="${opt.qteSport || 0}">
        <div class="field-hint">4 000 F/unité</div>
      </div>
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

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalEnregistrer").addEventListener("click", async () => {
    const newOpt = { ...opt };
    services.forEach(s => {
      const cb = document.querySelector(`[data-svc-edit="${s.key}"]`);
      newOpt[s.key] = cb.checked ? "oui" : "non";
    });
    if (uniformesOk) {
      newOpt.qteTenue = parseInt(document.getElementById("editQteTenue").value, 10) || 0;
      newOpt.qteSport = parseInt(document.getElementById("editQteSport").value, 10) || 0;
    } else {
      newOpt.qteTenue = 0;
      newOpt.qteSport = 0;
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
function openEditProfilModal(enfantId) {
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
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn btn-primary" id="modalEnregistrer"><i class="bi bi-check-lg"></i> Enregistrer</button>
    </div>
  `);

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalEnregistrer").addEventListener("click", async () => {
    const patch = {
      nom: document.getElementById("editNom").value.trim(),
      sexe: document.getElementById("editSexe").value || null,
      civilite: document.getElementById("editCivilite").value,
      parent: document.getElementById("editParent").value.trim(),
      tel: document.getElementById("editTel").value.trim(),
      ddn: document.getElementById("editDdn").value || null
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
// EXPORT CSV
// ============================================================
function exportEnfantsCsv() {
  if (STATE.enfants.length === 0) {
    showToast("Aucun dossier à exporter.", "error");
    return;
  }
  const lignes = [["Nom", "Section", "Statut", "Total dû", "Total payé", "Reste à payer", "Statut paiement"]];
  STATE.enfants.slice().sort((a, b) => a.nom.localeCompare(b.nom)).forEach(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    lignes.push([
      e.nom, SECT_LABELS[e.sect] || e.sect, e.stat === "nouveau" ? "Nouveau" : "Ancien",
      tDu(postesEnfant), tPaye(postesEnfant), tReste(postesEnfant), statutPaiement(postesEnfant)
    ]);
  });
  const csv = lignes.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bulles-de-joie-eleves-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
