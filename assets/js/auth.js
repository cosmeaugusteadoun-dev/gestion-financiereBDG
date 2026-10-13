// Connexion Supabase et identité du compte connecté au logiciel.
async function connecterCompteSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user || !data?.session) return null;
  return { mode: "supabase", userId: data.user.id, email: data.user.email };
}

async function verifierSessionSupabase(session) {
  if (session?.mode === "historique") return session.actif === true && session.expire > Date.now();
  if (!session || session.mode !== "supabase" || !session.userId) return false;
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data?.user && data.user.id === session.userId;
}

async function recupererHashHistorique() {
  const { data, error } = await supabase.from("app_config").select("password_hash").eq("id", "main").single();
  if (!error && data?.password_hash) return data.password_hash;
  if (error && error.code !== "PGRST116") throw new Error("Vérification de l'ancien compte impossible. Vérifiez l'accès à app_config ou connectez-vous avec votre email Supabase.");
  return APP_PASSWORD_HASH;
}

async function connecterCompteLogiciel(identifiant, password) {
  if (identifiant !== APP_USERNAME) return connecterCompteSupabase(identifiant, password);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const empreinte = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (empreinte !== await recupererHashHistorique()) return null;
  await supabase.auth.signOut({ scope: "local" });
  return { mode: "historique" };
}

async function changerMotDePasseSupabase(session, ancien, nouveau) {
  // L'identité est vérifiée sur le serveur avant toute modification.
  if (!await verifierSessionSupabase(session)) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.email) throw new Error("Compte introuvable. Reconnectez-vous.");
  const identite = await connecterCompteSupabase(data.user.email, ancien);
  if (!identite || identite.userId !== session.userId) throw new Error("L'ancien mot de passe saisi est incorrect.");
  const resultat = await supabase.auth.updateUser({ password: nouveau });
  if (resultat.error) throw resultat.error;
}
