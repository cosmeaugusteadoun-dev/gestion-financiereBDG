// ============================================================
// Configuration Supabase
// Récupérer ces valeurs dans : Supabase > Project Settings > API
//
// NOTE TECHNIQUE : ce fichier est parfois exécuté plusieurs fois sur la
// même page (ex. rechargement automatique de Live Server pendant le
// développement). On utilise donc window.X = ... plutôt que const/let,
// qui lèveraient une erreur "identifier has already been declared" si le
// script s'exécute deux fois — ce qui bloquait toute l'application.
// ============================================================

window.SUPABASE_URL = "https://xutdwwjwftgizwfovafk.supabase.co";
window.SUPABASE_ANON = "sb_publishable_9bCOHSsZaTrFUy2jHZPz-g_uL0U_6Fu";

// ============================================================
// Authentification du logiciel : comptes personnels Supabase Auth.
// ============================================================
// La connexion et les mots de passe sont désormais gérés par Supabase Auth.
window.APP_USERNAME = "adminBDJ";
window.APP_PASSWORD_HASH = "6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6";

// Initialisation du client Supabase (le SDK est chargé via le CDN dans index.html/app.html)
// Protégée par un try/catch pour ne jamais bloquer l'écran de connexion
// si la configuration Supabase est absente ou invalide.
try {
  window.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON, {
    global: { fetch: async (url, options = {}) => {
      // Réessayer uniquement les lectures et PATCH idempotents après une coupure.
      // Aucun nouvel essai automatique pour les paiements ou messages (POST).
      try { return await fetch(url, options); }
      catch (err) {
        if (!["GET", "HEAD", "PATCH"].includes((options.method || "GET").toUpperCase())) throw err;
        return fetch(url, options);
      }
    } },
    // Conserver l'authentification entre les pages, uniquement dans cet onglet.
    auth: { persistSession: true, storage: window.sessionStorage }
  });
} catch (err) {
  console.error("Erreur d'initialisation du client Supabase :", err);
}
