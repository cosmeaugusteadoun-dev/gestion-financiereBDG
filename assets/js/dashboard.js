// ============================================================
// dashboard.js — Tableau de bord : métriques, alertes, anniversaires
// ============================================================

function calculerMetriques() {
  let totalDu = 0, totalPaye = 0, totalReste = 0;

  STATE.enfants.forEach(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    totalDu += tDu(postesEnfant);
    totalPaye += tPaye(postesEnfant);
    totalReste += tReste(postesEnfant);
  });

  const totalEncaisse = STATE.entrees.reduce((s, e) => s + (Number(e.mt) || 0), 0);
  const tauxRecouvrement = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

  return { totalDu, totalPaye, totalReste, totalEncaisse, tauxRecouvrement };
}

function renderDashboard() {
  const m = calculerMetriques();
  const root = document.getElementById("dashMetrics");
  if (!root) return;

  root.innerHTML = `
    <div class="metric-card metric-green">
      <div class="metric-label">Total encaissé</div>
      <div class="metric-value">${fmtFCFA(m.totalEncaisse)}</div>
    </div>
    <div class="metric-card metric-navy">
      <div class="metric-label">Total dû</div>
      <div class="metric-value">${fmtFCFA(m.totalDu)}</div>
    </div>
    <div class="metric-card metric-red">
      <div class="metric-label">Reste à recouvrer</div>
      <div class="metric-value">${fmtFCFA(m.totalReste)}</div>
    </div>
    <div class="metric-card metric-gold">
      <div class="metric-label">Taux de recouvrement</div>
      <div class="metric-value">${m.tauxRecouvrement}%</div>
    </div>
  `;

  renderChartsBloc("dashCharts");
  renderAlertesRetard();
  renderRecettesSecteurDashboard();
  renderSansDateNaissance();
  renderParentsARelancer();
  renderAnniversaires();
  renderRenouvellementsCreche();
  renderDerniersPaiements();
}

// ============================================================
// COMPTEURS DES LISTES — badge « N éléments » en haut de chaque carte
// ============================================================
function majBadgeListe(id, n, classeSiNonVide) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = n;
  badge.className = "badge " + (n === 0 ? "badge-green" : (classeSiNonVide || "badge-gray"));
}

function majCompteurListe(root, n) {
  if (!root) return;
  let compteur = document.getElementById(root.id + "Compteur");
  if (!compteur) {
    compteur = document.createElement("p");
    compteur.id = root.id + "Compteur";
    compteur.className = "text-muted";
    const table = root.closest(".table-wrap");
    (table || root).before(compteur);
  }
  compteur.textContent = `${n} élément${n > 1 ? "s" : ""}`;
}

function correspondStatut(statut, filtre) {
  return !filtre || statut === filtre || (filtre === "a_jour" && statut === "solde");
}

// Filtre par statut choisi sur le graphique « Statut des paiements »
// (variable conservée dans bilans.js : filtreStatutDashActif).
function statutFiltreDashboard() {
  return typeof filtreStatutDashActif === "string" ? filtreStatutDashActif : "";
}

// ============================================================
// ALERTES DE RETARD
// ============================================================
var listesDashboardOuvertes = { dashAlertes: false, dashSansDdn: false };
var LIMITE_LISTES_DASHBOARD = 5;

function listeDashboardVisible(id, liste) {
  return listesDashboardOuvertes[id] ? liste : liste.slice(0, LIMITE_LISTES_DASHBOARD);
}

function ajouterBoutonListeDashboard(root, total, render) {
  if (total <= LIMITE_LISTES_DASHBOARD) return;
  const ouvert = !!listesDashboardOuvertes[root.id];
  root.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-secondary btn-sm mt-1" data-liste-dashboard="${root.id}" aria-expanded="${ouvert}" aria-controls="${root.id}"><i class="bi ${ouvert ? "bi-chevron-up" : "bi-chevron-down"}"></i> ${ouvert ? "Voir moins" : `Voir plus (${total - LIMITE_LISTES_DASHBOARD} autres)`}</button>`);
  root.querySelector("[data-liste-dashboard]").addEventListener("click", () => {
    listesDashboardOuvertes[root.id] = !listesDashboardOuvertes[root.id];
    render();
  });
}

function renderAlertesRetard() {
  const root = document.getElementById("dashAlertes");
  if (!root) return;

  const filtre = statutFiltreDashboard();

  const tousRetards = STATE.enfants.map(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const detail = posteRetardsDetail(postesEnfant);
    return {
      enfant: e, detail,
      total: detail.reduce((s, d) => s + d.manque, 0),
      statut: statutPaiement(postesEnfant)
    };
  }).filter(x => x.detail.length > 0).sort((a, b) => b.total - a.total);

  const enfantsRetard = tousRetards.filter(x => correspondStatut(x.statut, filtre));
  majBadgeListe("dashAlertesBadge", enfantsRetard.length, "badge-red");

  if (enfantsRetard.length === 0) {
    root.innerHTML = filtre
      ? `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Aucun enfant dans ce statut.</div>`
      : `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Aucun retard de paiement à signaler.</div>`;
    return;
  }

  const categoriesUniques = (detail) => [...new Set(detail.map(d => d.cat))].join(", ");

  root.innerHTML = listeDashboardVisible(root.id, enfantsRetard).map(x => `
    <div class="alert alert-danger">
      <div style="flex:1;">
        <strong>${escapeHtml(x.enfant.nom)}</strong> — ${fmtFCFA(x.total)} en retard
        <div class="text-muted" style="font-size:11.5px; margin-top:2px;">${escapeHtml(categoriesUniques(x.detail))}</div>
      </div>
      <button class="btn btn-ghost btn-sm" data-voir="${x.enfant.id}">Voir le dossier</button>
    </div>`).join("");

  root.querySelectorAll("[data-voir]").forEach(btn => {
    btn.addEventListener("click", () => verFicheEnfant(btn.dataset.voir));
  });
  ajouterBoutonListeDashboard(root, enfantsRetard.length, renderAlertesRetard);
}

// ============================================================
// ANNIVERSAIRES — 7 PROCHAINS JOURS
// ============================================================
function joursAvantAnniversaire(ddn) {
  if (!ddn) return null;
  const naissance = new Date(ddn);
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  let prochain = new Date(auj.getFullYear(), naissance.getMonth(), naissance.getDate());
  prochain.setHours(0, 0, 0, 0);
  if (prochain < auj) prochain = new Date(auj.getFullYear() + 1, naissance.getMonth(), naissance.getDate());
  return Math.round((prochain - auj) / 86400000);
}

function renderAnniversaires() {
  if (typeof actualiserBadgeAnniversaires === "function") actualiserBadgeAnniversaires();
  const root = document.getElementById("dashAnniversaires");
  if (!root) return;

  const liste = STATE.enfants
    .map(e => ({ enfant: e, jours: joursAvantAnniversaire(e.ddn) }))
    .filter(x => x.jours !== null && x.jours <= 7)
    .sort((a, b) => a.jours - b.jours);

  majBadgeListe("dashAnniversBadge", liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<p class="text-muted">Aucun anniversaire dans les 7 prochains jours.</p>`;
    return;
  }

  root.innerHTML = liste.map(x => {
    const age = ageAns(x.enfant.ddn);
    const estAujourdhui = x.jours === 0;
    return `
      <div class="bday-row ${estAujourdhui ? "bday-today" : ""}">
        <div>
          <div class="bday-name">${escapeHtml(x.enfant.nom)} ${estAujourdhui ? '<span class="badge badge-pink"><i class="bi bi-stars"></i> AUJOURD\'HUI</span>' : ""}</div>
          <div class="bday-date">${estAujourdhui ? `Fête ses ${age} ans aujourd'hui` : `Dans ${x.jours} jour${x.jours > 1 ? "s" : ""} · ${SECT_LABELS[x.enfant.sect] || x.enfant.sect}`}</div>
        </div>
        <button class="btn btn-whatsapp btn-sm" data-anniv="${x.enfant.id}" ${x.enfant.tel ? "" : "disabled"} title="Envoyer un message"><i class="bi bi-whatsapp"></i></button>
      </div>`;
  }).join("");

  root.querySelectorAll("[data-anniv]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.anniv);
      sendWhatsApp(enfant.tel, buildAnniversaireMessage(enfant));
    });
  });
}

// ============================================================
// RENOUVELLEMENTS CRÈCHE — 14 PROCHAINS JOURS
// L'abonnement Crèche (inscription + assurance) court sur 12 mois
// glissants à partir de la date réelle d'inscription (voir db.js,
// prochainRenouvellementCreche) — pas sur l'année scolaire, la crèche
// accueille toute l'année.
// ============================================================
function renderRenouvellementsCreche() {
  const root = document.getElementById("dashRenouvellementsCreche");
  if (!root) return;

  const liste = CRECHE_SECTS
    .reduce((acc, sect) => acc.concat(STATE.enfants.filter(e => e.sect === sect)), [])
    .map(e => ({ enfant: e, jours: joursAvantRenouvellementCreche(e.date_inscription) }))
    .filter(x => x.jours !== null && x.jours <= 14)
    .sort((a, b) => a.jours - b.jours);

  majBadgeListe("dashRenouvBadge", liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<p class="text-muted">Aucun renouvellement d'abonnement Crèche dans les 14 prochains jours.</p>`;
    return;
  }

  root.innerHTML = liste.map(x => {
    const echu = x.jours <= 0;
    return `
      <div class="bday-row ${echu ? "bday-today" : ""}">
        <div>
          <div class="bday-name">${escapeHtml(x.enfant.nom)} ${echu ? '<span class="badge badge-pink"><i class="bi bi-exclamation-circle-fill"></i> ÉCHU</span>' : ""}</div>
          <div class="bday-date">${echu ? "Abonnement arrivé à échéance" : `Dans ${x.jours} jour${x.jours > 1 ? "s" : ""}`}</div>
        </div>
        <button class="btn btn-whatsapp btn-sm" data-renouv="${x.enfant.id}" ${x.enfant.tel ? "" : "disabled"} title="Envoyer le rappel"><i class="bi bi-whatsapp"></i></button>
      </div>`;
  }).join("");

  root.querySelectorAll("[data-renouv]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.renouv);
      const dateRenouvellement = prochainRenouvellementCreche(enfant.date_inscription);
      ouvrirModeleParent(enfant, "renouvellement_creche", { dateRenouvellement });
    });
  });
}

// ============================================================
// 5 DERNIERS PAIEMENTS
// ============================================================
function renderDerniersPaiements() {
  const root = document.getElementById("dashDerniers");
  if (!root) return;

  const liste = STATE.entrees
    .slice()
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 5);

  majBadgeListe("dashDerniersBadge", liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<p class="text-muted">Aucun paiement enregistré pour le moment.</p>`;
    return;
  }

  root.innerHTML = `<div class="timeline">${liste.map(en => `
    <div class="timeline-item">
      <span class="timeline-date">${formatDateFR(en.date)}</span>
      <span>${escapeHtml(en.nom)} · ${escapeHtml(en.sect || "—")}</span>
      <span class="timeline-mt">${fmtFCFA(en.mt)}</span>
    </div>`).join("")}</div>`;
}

// ============================================================
// RECETTES PAR SECTEUR (résumé, mêmes montants que "Bilan par secteur")
// ============================================================
function renderRecettesSecteurDashboard() {
  const root = document.getElementById("dashRecettesSecteur");
  if (!root) return;

  const recettesParSecteur = calculerEncaisseParSecteurBilan();
  const entrees = Object.entries(recettesParSecteur).sort((a, b) => b[1] - a[1]);

  majBadgeListe("dashRecettesBadge", entrees.length);

  if (entrees.length === 0) {
    root.innerHTML = `<p class="text-muted">Aucune recette pour le moment.</p>`;
    return;
  }

  root.innerHTML = entrees.map(([sect, mt]) => `
    <div class="poste-row"><div class="poste-label">${escapeHtml(sect)}</div><div class="poste-amounts">${fmtFCFA(mt)}</div></div>
  `).join("");
}

// ============================================================
// SANS DATE DE NAISSANCE — dossiers à compléter
// Sans date de naissance, ni l'âge ni l'anniversaire ne peuvent être
// calculés : on liste ces enfants avec un accès direct au dossier
// complet ou au formulaire de profil (champ « Date de naissance » ciblé).
// ============================================================
function renderSansDateNaissance() {
  const root = document.getElementById("dashSansDdn");
  const badge = document.getElementById("dashSansDdnBadge");
  if (!root) return;

  const manquants = STATE.enfants
    .filter(e => !e.ddn)
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }));

  if (badge) {
    badge.textContent = manquants.length;
    badge.className = "badge " + (manquants.length === 0 ? "badge-green" : "badge-orange");
  }

  if (STATE.enfants.length === 0) {
    root.innerHTML = `<p class="text-muted">Aucun dossier enfant enregistré pour le moment.</p>`;
    return;
  }

  if (manquants.length === 0) {
    root.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Tous les dossiers ont une date de naissance renseignée.</div>`;
    return;
  }

  root.innerHTML = listeDashboardVisible(root.id, manquants).map(e => `
    <div class="ddn-row">
      <div class="ddn-infos">
        <div class="bday-name">${escapeHtml(e.nom)}</div>
        <div class="bday-date">${escapeHtml(SECT_LABELS[e.sect] || e.sect || "—")}</div>
      </div>
      <div class="ddn-actions">
        <button class="btn btn-ghost btn-sm" data-ddn-dossier="${e.id}" title="Ouvrir le dossier complet"><i class="bi bi-folder2-open"></i> Dossier</button>
        <button class="btn btn-primary btn-sm" data-ddn-modifier="${e.id}" title="Saisir la date de naissance"><i class="bi bi-pencil-fill"></i> Modifier</button>
      </div>
    </div>`).join("");

  root.querySelectorAll("[data-ddn-dossier]").forEach(btn => {
    btn.addEventListener("click", () => verFicheEnfant(btn.dataset.ddnDossier));
  });
  root.querySelectorAll("[data-ddn-modifier]").forEach(btn => {
    btn.addEventListener("click", () => openEditProfilModal(btn.dataset.ddnModifier, "ddn"));
  });
  ajouterBoutonListeDashboard(root, manquants.length, renderSansDateNaissance);
}

// ============================================================
// PARENTS À RELANCER — dossiers avec un reste à payer, triés par
// montant décroissant, avec accès direct à WhatsApp
// ============================================================
function renderParentsARelancer() {
  const root = document.getElementById("dashParentsRelancer");
  if (!root) return;

  const filtre = statutFiltreDashboard();

  let aRelancer = STATE.enfants.map(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    return { enfant: e, reste: tReste(postesEnfant), statut: statutPaiement(postesEnfant) };
  }).filter(x => x.reste > 0).sort((a, b) => b.reste - a.reste);

  if (filtre) aRelancer = aRelancer.filter(x => correspondStatut(x.statut, filtre));
  majBadgeListe("dashRelancerBadge", aRelancer.length, "badge-orange");

  if (aRelancer.length === 0) {
    root.innerHTML = filtre
      ? `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Aucun parent dans ce statut.</div>`
      : `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Aucun parent à relancer pour le moment.</div>`;
    return;
  }

  const AFFICHES = 4;
  const visibles = aRelancer.slice(0, AFFICHES);

  root.innerHTML = visibles.map(x => `
    <div class="bday-row">
      <div>
        <div class="bday-name">${escapeHtml(x.enfant.nom)} <span class="text-muted">— ${SECT_LABELS[x.enfant.sect] || x.enfant.sect}</span></div>
        <div class="bday-date">Reste : ${fmtFCFA(x.reste)}${x.enfant.tel ? " · " + escapeHtml(x.enfant.tel) : ""}</div>
      </div>
      <button class="btn btn-whatsapp btn-sm" data-relance="${x.enfant.id}" ${x.enfant.tel ? "" : "disabled"} title="Envoyer le bilan"><i class="bi bi-whatsapp"></i></button>
    </div>`).join("")
    + (aRelancer.length > AFFICHES ? `<button class="btn btn-ghost btn-block mt-1" id="btnVoirToutRelance">Voir tout (${aRelancer.length})</button>` : "");

  root.querySelectorAll("[data-relance]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.relance);
      const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
      const suiviEnfant = STATE.suivi.filter(s => s.enfant_id === enfant.id);
      ouvrirModeleParent(enfant, "bilan_financier");
    });
  });

  document.getElementById("btnVoirToutRelance")?.addEventListener("click", () => switchTab("enfants"));
}
