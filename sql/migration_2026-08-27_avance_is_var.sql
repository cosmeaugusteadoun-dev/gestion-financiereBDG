-- ============================================================
-- MIGRATION — 27/08/2026
-- Corrige l'affichage des postes "Avance / Trop-perçu" déjà enregistrés :
-- ils n'avaient pas is_var = TRUE, ce qui les faisait afficher comme
-- "0 F CFA / Soldé" dans le dossier de l'enfant (le calcul "dû - payé"
-- écrasait le surplus réel) au lieu du montant réellement en avance.
-- Les nouveaux postes "Avance" créés par le logiciel ont déjà is_var =
-- TRUE depuis cette mise à jour — cette migration corrige seulement les
-- lignes déjà présentes en base.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : ne touche que les postes dont la clé est "avance".
-- ============================================================

UPDATE postes SET is_var = TRUE WHERE key = 'avance';