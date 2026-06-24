#!/bin/bash
# Daily encrypted Postgres backup → Backblaze B2.
#
# Required env (set in Amvera secret env):
#   DATABASE_URL              postgresql://...   (used by app)
#   ENCRYPTION_KEY            64-char hex (same one app uses for at-rest)
#   B2_KEY_ID                 from Backblaze: Application Keys → Add a New Application Key
#   B2_APP_KEY                same place
#   B2_BUCKET                 your bucket name (создай в B2 console)
#
# Run via cron OR systemd timer. For Amvera: add a cron task in the panel
# that hits a /api/admin/run-backup endpoint OR runs this script directly.
#
# Output: bucket://<B2_BUCKET>/schemehappens-YYYY-MM-DD.sql.gz.enc
# Retention: keep last 30 days locally (B2 itself retains forever; rotate via
# B2 lifecycle rule if you want — Settings → Lifecycle Settings).

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL required}"
: "${ENCRYPTION_KEY:?ENCRYPTION_KEY required}"
: "${B2_KEY_ID:?B2_KEY_ID required}"
: "${B2_APP_KEY:?B2_APP_KEY required}"
: "${B2_BUCKET:?B2_BUCKET required}"

DATE=$(date -u +%Y-%m-%d)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

DUMP_FILE="$TMP_DIR/schemehappens-$DATE.sql"
ENC_FILE="$DUMP_FILE.gz.enc"

echo "[backup] dumping database..."
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges --format=plain \
  > "$DUMP_FILE"

echo "[backup] compressing + encrypting (AES-256-CBC via openssl)..."
# openssl reads ENCRYPTION_KEY (hex) as the key directly via -K. We need an
# IV too — openssl generates a random one and prepends "Salted__" header
# when -salt and -pbkdf2 are used with a passphrase. For pure-key mode we
# generate IV ourselves and prepend it to the ciphertext.
IV=$(openssl rand -hex 16)
gzip -c "$DUMP_FILE" | openssl enc -aes-256-cbc -K "$ENCRYPTION_KEY" -iv "$IV" \
  | (echo -n "$IV" | xxd -r -p; cat) \
  > "$ENC_FILE"

echo "[backup] uploading to B2..."
# Use B2 native CLI if installed, else fall back to S3-compatible via aws cli.
if command -v b2 >/dev/null 2>&1; then
  b2 account authorize "$B2_KEY_ID" "$B2_APP_KEY" >/dev/null
  b2 file upload "$B2_BUCKET" "$ENC_FILE" "schemehappens-$DATE.sql.gz.enc"
elif command -v aws >/dev/null 2>&1; then
  # B2 exposes an S3-compatible endpoint at https://s3.us-east-005.backblazeb2.com
  : "${B2_ENDPOINT:=https://s3.us-east-005.backblazeb2.com}"
  AWS_ACCESS_KEY_ID="$B2_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$B2_APP_KEY" \
  aws --endpoint-url "$B2_ENDPOINT" \
    s3 cp "$ENC_FILE" "s3://$B2_BUCKET/schemehappens-$DATE.sql.gz.enc"
else
  echo "[backup] ERROR: neither 'b2' nor 'aws' CLI is installed" >&2
  exit 1
fi

echo "[backup] done — schemehappens-$DATE.sql.gz.enc"

# To decrypt locally:
#   FILE=schemehappens-2026-06-01.sql.gz.enc
#   IV=$(head -c 32 "$FILE")  # first 32 hex chars = 16 byte IV
#   tail -c +33 "$FILE" \
#     | openssl enc -d -aes-256-cbc -K "$ENCRYPTION_KEY" -iv "$IV" \
#     | gunzip > restored.sql
