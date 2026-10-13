-- Journal privé et prévention des doubles envois, indépendant des paiements.
CREATE TABLE IF NOT EXISTS public.whatsapp_envois (
  request_id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  recipient TEXT NOT NULL,
  template_name TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','failed','unknown')),
  message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_envois ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_envois FROM anon, authenticated;
GRANT ALL ON public.whatsapp_envois TO service_role;
CREATE INDEX IF NOT EXISTS whatsapp_envois_message_id_idx ON public.whatsapp_envois(message_id);
