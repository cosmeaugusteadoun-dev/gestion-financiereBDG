-- ============================================================
-- MIGRATION — 13/08/2026
-- Ajoute la colonne "is_reduit" à la table postes : marque les postes de
-- cantine/goûter/cantine crèche des mois à effectif réduit (mars, juin,
-- septembre — rentrée mi-septembre, congés de Pâques, fin d'année
-- écourtée), dont le montant dû n'est plus calculé automatiquement mais
-- saisi manuellement depuis le dossier de l'enfant.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : les postes existants auront is_reduit = FALSE (comportement
-- inchangé) jusqu'à leur prochaine régénération (modification des options
-- du dossier, qui recrée les postes de cantine avec les nouvelles clés
-- "..._reduit_Mar/Jun/Sep").
-- ============================================================

ALTER TABLE postes ADD COLUMN IF NOT EXISTS is_reduit BOOLEAN DEFAULT FALSE;
