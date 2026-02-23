#!/bin/bash
# Creates Keycloak user/DB and 3 KAIROS databases/users (kairos_dev, kairos_qa, kairos_prod).
# Passwords come from .env.prod: compose loads env_file .env.prod into this container, so
# .env.prod is the source of truth (must match scripts/generate-dev-secrets.sh).
# Run on first boot (mounted in docker-entrypoint-initdb.d) or for existing DB:
#   docker compose --env-file .env.prod --profile prod exec postgres /docker-entrypoint-initdb.d/02-kairos-dbs.sh
set -e

# Keycloak user and database (for optional Keycloak service). ALTER ensures password stays in sync after regenerate-secrets.
if [ -n "$KEYCLOAK_DB_PASSWORD" ]; then
  pass_sql="${KEYCLOAK_DB_PASSWORD//\'/\'\'}"
  psql -v ON_ERROR_STOP=0 -U postgres -c "CREATE ROLE keycloak WITH LOGIN PASSWORD '$pass_sql';" || true
  psql -v ON_ERROR_STOP=0 -U postgres -c "CREATE DATABASE keycloak OWNER keycloak;" || true
  psql -v ON_ERROR_STOP=0 -U postgres -c "ALTER ROLE keycloak WITH PASSWORD '$pass_sql';" || true
  echo "Keycloak user/DB init done."
fi

# KAIROS DBs and users
for env in dev qa prod; do
  var="KAIROS_${env^^}_DB_PASSWORD"
  pass="${!var}"
  if [ -z "$pass" ]; then
    echo "Skip kairos_$env: $var not set" >&2
    continue
  fi
  pass_sql="${pass//\'/\'\'}"
  psql -v ON_ERROR_STOP=0 -U postgres -c "CREATE ROLE kairos_$env WITH LOGIN PASSWORD '$pass_sql';" || true
  psql -v ON_ERROR_STOP=0 -U postgres -c "CREATE DATABASE kairos_$env OWNER kairos_$env;" || true
  psql -v ON_ERROR_STOP=0 -U postgres -c "ALTER ROLE kairos_$env WITH PASSWORD '$pass_sql';" || true
done
echo "KAIROS DBs init done."
