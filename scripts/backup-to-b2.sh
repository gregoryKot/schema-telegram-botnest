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
#
# SKIP_UPLOAD=1 — режим репетиции restore (nightly.yml, джоба backup-restore
# и src/infra/backup-restore.spec.ts): пропускает B2-креды и сам аплоад,
# кладёт зашифрованный файл в $BACKUP_OUT_DIR (по умолчанию — текущая
# директория) и печатает путь. Поведение без SKIP_UPLOAD не меняется ни на
# байт.

set -euo pipefail

SKIP_UPLOAD="${SKIP_UPLOAD:-0}"

: "${DATABASE_URL:?DATABASE_URL required}"
: "${ENCRYPTION_KEY:?ENCRYPTION_KEY required}"
if [ "$SKIP_UPLOAD" != "1" ]; then
  : "${B2_KEY_ID:?B2_KEY_ID required}"
  : "${B2_APP_KEY:?B2_APP_KEY required}"
  : "${B2_BUCKET:?B2_BUCKET required}"
fi

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

if [ "$SKIP_UPLOAD" = "1" ]; then
  OUT_DIR="${BACKUP_OUT_DIR:-.}"
  mkdir -p "$OUT_DIR"
  OUT_FILE="$OUT_DIR/schemehappens-$DATE.sql.gz.enc"
  cp "$ENC_FILE" "$OUT_FILE"
  echo "[backup] SKIP_UPLOAD=1 — аплоад в B2 пропущен, файл сохранён локально: $OUT_FILE"
else
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
fi

echo "[backup] done — schemehappens-$DATE.sql.gz.enc"

# To decrypt / restore: scripts/restore-backup.sh.
#
# (Аудит тестовых практик 2026-08, «репетиция restore»: старая версия этого
# комментария была НЕВЕРНА — она читала `head -c 32` как «32 hex chars»,
# хотя выше IV префиксуется как 16 СЫРЫХ байт (`xxd -r -p`), а не как hex-
# текст. По той инструкции восстановление отдавало мусор — воспроизведено и
# зафиксировано в src/infra/backup-restore.spec.ts и nightly.yml, джоба
# backup-restore.)
#   ENCRYPTION_KEY=<тот же 64-hex ключ> bash scripts/restore-backup.sh \
#     schemehappens-2026-06-01.sql.gz.enc [DATABASE_URL для сразу-залить]
