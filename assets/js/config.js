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
// Identifiants de connexion au logiciel
// Le mot de passe n'est jamais stocké en clair : seule son empreinte
// SHA-256 est conservée ici. Pour changer le mot de passe, générez
// une nouvelle empreinte (ex. dans la console du navigateur) avec :
//   await crypto.subtle.digest('SHA-256', new TextEncoder().encode('nouveauMotDePasse'))
//     .then(buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join(''))
// ============================================================
window.APP_USERNAME = "adminBDJ";
window.APP_PASSWORD_HASH = "6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6"; // admin2026

// Initialisation du client Supabase (le SDK est chargé via le CDN dans index.html/app.html)
// Protégée par un try/catch pour ne jamais bloquer l'écran de connexion
// si la configuration Supabase est absente ou invalide.
try {
  window.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
} catch (err) {
  console.error("Erreur d'initialisation du client Supabase :", err);
}
