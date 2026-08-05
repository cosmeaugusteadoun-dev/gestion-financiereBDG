// ============================================================
// app.js — Initialisation générale, navigation entre onglets
// ============================================================

// Protection de session : retour à l'écran de connexion si non authentifié
// ou si la session a expiré (durée de vie fixée à la connexion, voir index.html)
function sessionValide() {
  try {
    const session = JSON.parse(sessionStorage.getItem("bdj_session"));
    return !!session && session.actif === true && session.expire > Date.now();
  } catch {
    return false;
  }
}
if (!sessionValide()) {
  sessionStorage.removeItem("bdj_session");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  wireLogout();
  wireTabs();

  const root = document.querySelector(".main-content");
  root.style.opacity = "0.5";

  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast("Impossible de charger les données. Vérifiez la configuration Supabase dans config.js.", "error");
    root.style.opacity = "1";
    return;
  }

  initEnfants();
  initEntrees();
  initSorties();
  initWhatsapp();
  initNotes();

  refreshAllTabs();
  root.style.opacity = "1";
});

// ============================================================
// DÉCONNEXION
// ============================================================
function wireLogout() {
  document.getElementById("btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem("bdj_session");
    window.location.href = "index.html";
  });
}

// ============================================================
// NAVIGATION PAR ONGLETS
// ============================================================
function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tabName}`));
  window.scrollTo({ top: 0, behavior: "auto" });
}

// Ouvre le dossier d'un enfant depuis un autre onglet (ex. alerte de retard)
function verFicheEnfant(enfantId) {
  switchTab("enfants");
  openIds.add(enfantId);
  renderEnfantsList();
  requestAnimationFrame(() => {
    const el = document.getElementById(`enfant-${enfantId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ============================================================
// RAFRAÎCHISSEMENT GLOBAL
// Appelé après toute création/modification/suppression de données
// pour que tous les onglets restent synchronisés entre eux.
// ============================================================
function refreshAllTabs() {
  renderDashboard();
  renderEnfantsList();
  renderEntreesList();
  renderSortiesList();
  renderBilans();
  renderWhatsAppTab();
  renderMessagerieTab();
  renderNotes();
  renderBilanGeneral();
}
