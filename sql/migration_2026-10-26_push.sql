-- Tables privées : aucun accès anonyme, y compris avec l'ancien identifiant.
BEGIN;
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subscription jsonb NOT NULL,
 vapid_public_key text NOT NULL,
 active boolean NOT NULL DEFAULT true,
 ack_date date,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.push_deliveries (
 subscription_id text NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 on_date date NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','accepted','failed','unknown')),
 error_code integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(subscription_id,on_date)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions, public.push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.push_subscriptions, public.push_deliveries TO service_role;
CREATE INDEX IF NOT EXISTS push_subscriptions_owner_idx ON public.push_subscriptions(owner_id);
COMMIT;
