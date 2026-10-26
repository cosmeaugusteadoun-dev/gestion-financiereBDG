-- Après déploiement de push-notifications et configuration des secrets.
-- Dans Supabase Vault, créer push_cron_secret avec la valeur de PUSH_CRON_SECRET.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='push_cron_secret') THEN
  RAISE EXCEPTION 'Créer push_cron_secret dans Supabase Vault avant de planifier les notifications.';
 END IF;
END $$;
SELECT cron.schedule('bdj-anniversaires-quotidiens','0 6 * * *',
$job$
 SELECT net.http_post(
  url := 'https://xutdwwjwftgizwfovafk.supabase.co/functions/v1/push-notifications',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-push-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='push_cron_secret' LIMIT 1)),
  body := '{"action":"daily"}'::jsonb,
  timeout_milliseconds := 120000
 );
$job$);
-- 06:00 UTC = 07:00 au Bénin ; le même nom met à jour le job existant.
