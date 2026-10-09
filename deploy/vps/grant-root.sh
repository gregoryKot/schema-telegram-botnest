#!/bin/bash
# Разовая выдача ssh-доступа под root. Нужна провайдерам вроде Cloud.ru
# Evolution: ВМ создаётся с отдельным sudo-пользователем, по ssh пускают только
# его, а в /root/.ssh/authorized_keys ключа нет (cloud-init либо ничего туда не
# кладёт, либо кладёт заглушку `command="echo Please login as ..."`). Всё
# остальное в deploy/vps рассчитано на root, поэтому один раз открываем его.
#
# Запускается op=grant-root в vps.yml ПОД ЭТИМ пользователем, с раннера:
#   ssh vps 'bash -s' < deploy/vps/grant-root.sh
# Скрипт идёт через stdin, потому что до этой операции писать в /opt нельзя.
# Все привилегированные действия — через `sudo -n` (без пароля; нет — ошибка,
# а не зависший запрос).
#
# Делает:
#   1. /root/.ssh (700);
#   2. ЗАМЕНЯЕТ /root/.ssh/authorized_keys содержимым ~/.ssh/authorized_keys
#      этого пользователя (600, владелец root): ключ деплоя тот же, заглушка
#      cloud-init исчезает;
#   3. sshd -T: если permitrootlogin = no, кладёт drop-in
#      sshd_config.d/10-schemehappens-root.conf (prohibit-password: root по
#      ключу, по паролю нет) и перезагружает sshd.
#
# Идемпотентен. Лог Actions публичный: только статусы, ни ключей, ни содержимого
# файлов, ни вывода sshd -T.
set -Eeuo pipefail

# Корни переопределяются только в тесте (src/infra/vps-grant-root.spec.ts): на
# сервере обе переменные не заданы, и пути такие, как были.
ROOT_HOME="${GRANT_ROOT_HOME:-/root}"
ETC="${GRANT_ETC:-/etc}"
DROPIN="$ETC/ssh/sshd_config.d/10-schemehappens-root.conf"
SRC="$HOME/.ssh/authorized_keys"

log() { echo "[grant-root] $*"; }
die() { echo "[grant-root] ОШИБКА: $*" >&2; exit 1; }

sudo -n true 2> /dev/null || die "sudo без пароля недоступен пользователю «$(id -un)»: добавьте его в sudoers с NOPASSWD"

# Пустой или без единого ключа файл: заменить им root значило бы закрыть себе
# вход совсем, поэтому проверяем до любой записи.
if ! { [ -s "$SRC" ] && grep -qE '^[[:space:]]*[^#[:space:]]' "$SRC"; }; then
  die "у пользователя «$(id -un)» нет ~/.ssh/authorized_keys с ключом: нечего переносить в root"
fi

# ── 1–2. Ключи ───────────────────────────────────────────────────────────────
log "ключи: ~/.ssh/authorized_keys → root"
sudo -n install -d -m 700 -o root -g root "$ROOT_HOME/.ssh"
sudo -n install -m 600 -o root -g root "$SRC" "$ROOT_HOME/.ssh/authorized_keys"
log "ключей у root: $(grep -cE '^[[:space:]]*[^#[:space:]]' "$SRC")"

# ── 3. PermitRootLogin ───────────────────────────────────────────────────────
permit_root() {
  sudo -n sshd -T 2> /dev/null | awk '$1 == "permitrootlogin" { print $2 }'
}
CURRENT=$(permit_root) || true
[ -n "$CURRENT" ] || die "sshd -T не вернул permitrootlogin (sshd не установлен или конфиг не читается)"

if [ "$CURRENT" = "no" ]; then
  log "sshd: PermitRootLogin no → prohibit-password (drop-in)"
  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT
  echo "PermitRootLogin prohibit-password" > "$TMP"
  sudo -n install -d -m 755 -o root -g root "$ETC/ssh/sshd_config.d"
  sudo -n install -m 644 -o root -g root "$TMP" "$DROPIN"
  sudo -n sshd -t || die "sshd отверг конфиг с drop-in'ом; reload не делался"
  sudo -n systemctl reload ssh || sudo -n systemctl reload sshd \
    || die "не удалось перезагрузить sshd (ни юнит ssh, ни sshd)"
  # Drop-in читается по порядку: если основной конфиг задаёт значение раньше
  # include'а, наше ничего не меняет, и root всё равно закрыт.
  AFTER=$(permit_root) || true
  [ "$AFTER" != "no" ] || die "после drop-in'а permitrootlogin по-прежнему no: значение задано в sshd_config выше include"
  log "sshd: перезагружен, permitrootlogin = $AFTER"
else
  log "sshd: permitrootlogin = $CURRENT, менять не нужно"
fi

log "готово"
