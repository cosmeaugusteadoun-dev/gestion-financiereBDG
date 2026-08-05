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
  renderAnniversaires();
  renderDerniersPaiements();
}

// ============================================================
// ALERTES DE RETARD
// ============================================================
function renderAlertesRetard() {
  const root = document.getElementById("dashAlertes");
  if (!root) return;

  const enfantsRetard = STATE.enfants.map(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const detail = posteRetardsDetail(postesEnfant);
    return { enfant: e, detail, total: detail.reduce((s, d) => s + d.manque, 0) };
  }).filter(x => x.detail.length > 0).sort((a, b) => b.total - a.total);

  if (enfantsRetard.length === 0) {
    root.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> Aucun retard de paiement à signaler.</div>`;
    return;
  }

  const categoriesUniques = (detail) => [...new Set(detail.map(d => d.cat))].join(", ");

  root.innerHTML = enfantsRetard.map(x => `
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
  const root = document.getElementById("dashAnniversaires");
  if (!root) return;

  const liste = STATE.enfants
    .map(e => ({ enfant: e, jours: joursAvantAnniversaire(e.ddn) }))
    .filter(x => x.jours !== null && x.jours <= 7)
    .sort((a, b) => a.jours - b.jours);

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
// 5 DERNIERS PAIEMENTS
// ============================================================
function renderDerniersPaiements() {
  const root = document.getElementById("dashDerniers");
  if (!root) return;

  const liste = STATE.entrees
    .slice()
    .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    .slice(0, 5);

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
