-- ============================================================
-- MIGRATION — 07/08/2026
-- Ajoute la table "suivi_classe" : un suivi collectif par classe et par
-- trimestre (ex. observation générale, sortie éducative, consigne), distinct
-- du suivi individuel par élève (table "suivi") qui reste inchangée.
--
-- À exécuter une seule fois dans Supabase > SQL Editor > Run.
-- Sans danger : nouvelle table, n'affecte aucune donnée existante.
-- ============================================================

CREATE TABLE IF NOT EXISTS suivi_classe (
  id            TEXT PRIMARY KEY,
  sect          TEXT NOT NULL,
  trim          TEXT NOT NULL,
  observation   TEXT,
  UNIQUE(sect, trim)
);
