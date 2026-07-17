-- ============================================================
-- DIAGNOSTIC: Check pg_net HTTP request history
-- Run these queries one at a time in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Discover actual columns of the pg_net response table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'net'
ORDER BY table_name, ordinal_position;

-- STEP 2: Dump all recent pg_net HTTP responses (wildcard — works on any version)
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;

-- STEP 3: Check if any requests are still queued / pending
SELECT * FROM net.http_request_queue LIMIT 10;

-- STEP 4: Confirm the service role key database setting is persisted
SELECT current_setting('app.settings.service_role_key', true) AS service_role_key_set;
