#!/usr/bin/env bash
# One-shot installer. Run once as root:
#   sudo bash ~/remato-online/deploy/install-ssh-guard.sh
#
# Makes SSH into nigserHP survive reboots permanently:
#   1. adds the persistent ufw allow rules for port 22
#   2. installs a boot-time guard that re-adds them if they ever go missing
# Safe to re-run. Never aborts early on a rule failure - it reports what went wrong.
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIAG=/var/log/ssh-firewall-guard.log

if [ "$(id -u)" -ne 0 ]; then
  echo "must run as root:  sudo bash $SRC/install-ssh-guard.sh" >&2
  exit 1
fi

echo "==> installing guard script"
install -m 0755 "$SRC/ssh-firewall-guard.sh" /usr/local/sbin/ssh-firewall-guard.sh || exit 1

echo "==> installing systemd unit"
install -m 0644 "$SRC/ssh-firewall-guard.service" /etc/systemd/system/ssh-firewall-guard.service || exit 1
systemctl daemon-reload
systemctl enable ssh-firewall-guard.service

echo "==> applying the rules now"
systemctl restart ssh-firewall-guard.service
rc=$?

echo "==> making sure sshd itself is enabled at boot"
systemctl enable --now sshd

echo
echo "==> resulting firewall state"
ufw status verbose | sed 's/^/    /'

echo
echo "==> guard log"
[ -f "$DIAG" ] && tail -40 "$DIAG" | sed 's/^/    /'
chmod 0644 "$DIAG" 2>/dev/null || true

echo
if ufw status 2>/dev/null | grep -qE '(^|[^0-9])22(/tcp)?[[:space:]].*ALLOW'; then
  echo "DONE. SSH is allowed through ufw and the guard re-applies it on every boot."
  echo "  from anywhere:  ssh nigser380e@100.103.217.72"
  echo "  on home wifi:   ssh nigser380e@192.168.1.3"
  exit 0
fi

echo "STILL BROKEN - ufw would not accept a port 22 rule (exit $rc)."
echo "Full diagnostics are in $DIAG - paste them back."
exit 1
