#!/usr/bin/env bash
# Copy the production database STRUCTURE (plus menu/config reference data) into
# the staging Supabase project. Production is only ever read from.
#
# Copied:  public schema (tables, functions, policies, grants), triggers on
#          auth.users, storage buckets + storage policies, and reference data
#          (roles, permissions, locations, categories, products, modifiers,
#          inventory, settings, hero slides, announcements).
# Never copied: users, orders, order items, logs, saved reports, or any auth accounts.
#
# Usage: bash supabase/scripts/clone-prod-to-staging.sh
# You'll be asked for each project's Session pooler connection string
# (Dashboard -> Connect -> Session pooler). Input is hidden and never saved.

set -euo pipefail

PROD_REF="djdsprgnxfpehbpnxrzx"
STAGING_REF="eeqdzaggpyeurezgcfrx"

REF_TABLES=(
  roles permissions role_permissions locations categories products
  modifier_groups modifiers product_modifier_groups inventory settings
  hero_slides announcements
)

read -rsp "PRODUCTION connection string (read-only use): " PROD_URL; echo
read -rsp "STAGING connection string: " STAGING_URL; echo

[[ "$PROD_URL" == *"$PROD_REF"* ]] || { echo "✗ Production string doesn't contain $PROD_REF"; exit 1; }
[[ "$STAGING_URL" == *"$STAGING_REF"* ]] || { echo "✗ Staging string doesn't contain $STAGING_REF"; exit 1; }
[[ "$STAGING_URL" != *"$PROD_REF"* ]] || { echo "✗ Staging string points at production. Aborting."; exit 1; }

q() { psql "$1" -X -At -v ON_ERROR_STOP=1 -c "$2"; }

# pg_dump must be at least as new as the production server.
SERVER_MAJOR=$(q "$PROD_URL" "SHOW server_version_num" | cut -c1-2)
DUMP_MAJOR=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
if (( DUMP_MAJOR < SERVER_MAJOR )); then
  echo "✗ Production runs Postgres $SERVER_MAJOR but pg_dump is $DUMP_MAJOR."
  echo "  Run: brew install postgresql@$SERVER_MAJOR && export PATH=\"/opt/homebrew/opt/postgresql@$SERVER_MAJOR/bin:\$PATH\""
  exit 1
fi

EXISTING=$(q "$STAGING_URL" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
if (( EXISTING > 0 )); then
  echo "✗ Staging already has $EXISTING tables in public. Expected an empty project. Aborting."
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "→ Dumping production schema..."
pg_dump "$PROD_URL" --schema-only --schema=public --no-owner \
  | grep -vE '^(CREATE SCHEMA public;|COMMENT ON SCHEMA public |ALTER DEFAULT PRIVILEGES )' > "$WORK/schema.sql"

echo "→ Reading auth.users triggers, storage buckets and storage policies..."
q "$PROD_URL" "
  SELECT pg_get_triggerdef(t.oid) || ';'
  FROM pg_trigger t
  WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal" > "$WORK/auth_triggers.sql"

q "$PROD_URL" "
  SELECT format('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
                id, name, public, file_size_limit, allowed_mime_types)
  FROM storage.buckets" > "$WORK/buckets.sql"

q "$PROD_URL" "
  SELECT format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
                policyname, schemaname, tablename, permissive, cmd,
                array_to_string(roles, ', '),
                CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
                CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END)
  FROM pg_policies WHERE schemaname = 'storage'" > "$WORK/storage_policies.sql"

echo "→ Dumping reference data (no users, orders or logs)..."
TABLE_ARGS=()
for t in "${REF_TABLES[@]}"; do TABLE_ARGS+=(--table="public.$t"); done
pg_dump "$PROD_URL" --data-only --no-owner "${TABLE_ARGS[@]}" > "$WORK/data.sql"

echo "→ Applying to staging..."
psql "$STAGING_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$WORK/schema.sql"
[[ -s "$WORK/auth_triggers.sql" ]] && psql "$STAGING_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$WORK/auth_triggers.sql"
[[ -s "$WORK/buckets.sql" ]] && psql "$STAGING_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$WORK/buckets.sql"
[[ -s "$WORK/storage_policies.sql" ]] && psql "$STAGING_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$WORK/storage_policies.sql"
psql "$STAGING_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$WORK/data.sql"

# Make sure every id sequence continues after the copied rows.
q "$STAGING_URL" "
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name) AS seq
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(format('public.%I', c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT max(%I) FROM public.%I), 0) + 1, false)', r.seq, r.column_name, r.table_name);
  END LOOP;
END \$\$;" > /dev/null

echo
echo "✓ Done. Staging now has:"
q "$STAGING_URL" "SELECT '  ' || count(*) || ' tables' FROM information_schema.tables WHERE table_schema='public'"
q "$STAGING_URL" "SELECT '  ' || count(*) || ' storage buckets' FROM storage.buckets"
q "$STAGING_URL" "SELECT '  ' || count(*) || ' products' FROM public.products"
echo "  $(wc -l < "$WORK/auth_triggers.sql" | tr -d ' ') auth.users trigger(s), $(wc -l < "$WORK/storage_policies.sql" | tr -d ' ') storage policies"
