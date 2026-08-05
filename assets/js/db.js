// ============================================================
// db.js — Accès Supabase (CRUD) + état global + utilitaires
// Toutes les fonctions ici sont globales (pas de bundler, pas
// de modules ES) car chaque fichier est chargé via <script>.
// ============================================================

// ---------- État global de l'application ----------
var STATE = {
  enfants: [],   // dossiers élèves
  postes: [],    // lignes financières (générées par buildPostes)
  entrees: [],   // paiements reçus
  sorties: [],   // dépenses de l'école
  suivi: []      // suivi scolaire par trimestre
};

// ============================================================
// UTILITAIRES GÉNÉRAUX
// ============================================================

// Génère un identifiant unique lisible, préfixé par type
function uid(prefix) {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${t}${r}`;
}

// Formate un montant en Francs CFA (ex. 15 000 F CFA)
function fmtFCFA(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("fr-FR").replace(/ /g, " ") + " F CFA";
}

// Échappe le HTML pour éviter les injections dans les templates
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Formate une date ISO (YYYY-MM-DD) en format français lisible
function formatDateFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Calcule l'âge en années à partir d'une date de naissance
function ageAns(ddn) {
  if (!ddn) return null;
  const naissance = new Date(ddn);
  const auj = new Date();
  let age = auj.getFullYear() - naissance.getFullYear();
  const m = auj.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < naissance.getDate())) age--;
  return age;
}

// ---------- Notifications toast ----------
var toastTimer = null;
function showToast(message, type = "info") {
  const root = document.getElementById("toastRoot");
  if (!root) return;
  root.innerHTML = `<div class="toast toast-${type === "success" ? "success" : type === "error" ? "error" : ""}" id="toastEl">${escapeHtml(message)}</div>`;
  const el = document.getElementById("toastEl");
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

// ---------- Modals HTML personnalisés (jamais confirm() natif) ----------
function openModal(innerHtml) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box">${innerHtml}</div></div>`;
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
}

function closeModal() {
  const root = document.getElementById("modalRoot");
  root.innerHTML = "";
}

// Modal de confirmation générique (suppression, actions sensibles)
function confirmModal({ titre, texte, labelConfirmer = "Supprimer", danger = true, onConfirm }) {
  openModal(`
    <div class="modal-title">${escapeHtml(titre)}</div>
    <div class="modal-text">${texte}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modalConfirmer">${escapeHtml(labelConfirmer)}</button>
    </div>
  `);
  document.getElementById("modalAnnuler").addEventListener("click", closeModal);
  document.getElementById("modalConfirmer").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

// ============================================================
// CHARGEMENT INITIAL
// ============================================================
async function loadAll() {
  const [enfantsRes, postesRes, entreesRes, sortiesRes, suiviRes] = await Promise.all([
    supabase.from("enfants").select("*").order("nom", { ascending: true }),
    supabase.from("postes").select("*"),
    supabase.from("entrees").select("*").order("date", { ascending: false }),
    supabase.from("sorties").select("*").order("date", { ascending: false }),
    supabase.from("suivi").select("*")
  ]);

  if (enfantsRes.error) throw enfantsRes.error;
  if (postesRes.error) throw postesRes.error;
  if (entreesRes.error) throw entreesRes.error;
  if (sortiesRes.error) throw sortiesRes.error;
  if (suiviRes.error) throw suiviRes.error;

  STATE.enfants = enfantsRes.data || [];
  STATE.postes = postesRes.data || [];
  STATE.entrees = entreesRes.data || [];
  STATE.sorties = sortiesRes.data || [];
  STATE.suivi = suiviRes.data || [];
}

// ============================================================
// ENFANTS
// ============================================================
async function dbInsertEnfant(enfant) {
  const { error } = await supabase.from("enfants").insert(enfant);
  if (error) throw error;
}

async function dbUpdateEnfant(id, patch) {
  const { error } = await supabase.from("enfants").update(patch).eq("id", id);
  if (error) throw error;
}

async function dbDeleteEnfant(id) {
  const { error } = await supabase.from("enfants").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// POSTES
// ============================================================

// Remplace intégralement les postes d'un enfant (utilisé à la création
// et lors de la modification des options souscrites)
async function dbReplacePostesEnfant(enfantId, postesArray) {
  const { error: errDel } = await supabase.from("postes").delete().eq("enfant_id", enfantId);
  if (errDel) throw errDel;
  if (postesArray.length > 0) {
    const { error: errIns } = await supabase.from("postes").insert(postesArray);
    if (errIns) throw errIns;
  }
}

// Met à jour un lot de postes (après imputation d'un paiement)
async function dbUpsertPostes(postesArray) {
  if (postesArray.length === 0) return;
  const { error } = await supabase.from("postes").upsert(postesArray, { onConflict: "id" });
  if (error) throw error;
}

// ============================================================
// ENTRÉES
// ============================================================
async function dbInsertEntree(entree) {
  const { error } = await supabase.from("entrees").insert(entree);
  if (error) throw error;
}

async function dbDeleteEntree(id) {
  const { error } = await supabase.from("entrees").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// SORTIES
// ============================================================
async function dbInsertSortie(sortie) {
  const { error } = await supabase.from("sorties").insert(sortie);
  if (error) throw error;
}

async function dbDeleteSortie(id) {
  const { error } = await supabase.from("sorties").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// SUIVI SCOLAIRE
// ============================================================
async function dbUpsertSuivi(suivi) {
  const { error } = await supabase.from("suivi").upsert(suivi, { onConflict: "enfant_id,trim" });
  if (error) throw error;
}
