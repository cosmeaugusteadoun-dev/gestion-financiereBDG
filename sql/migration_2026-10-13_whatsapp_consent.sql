-- Le consentement est dans enfants.opt : aucune modification des tarifs.
-- Trace privée du consentement utilisé pour chaque envoi API.
ALTER TABLE public.whatsapp_envois ADD COLUMN IF NOT EXISTS enfant_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.whatsapp_envois ADD COLUMN IF NOT EXISTS consentements JSONB NOT NULL DEFAULT '[]'::jsonb;
