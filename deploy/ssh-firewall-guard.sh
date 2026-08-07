#!/usr/bin/env bash
# Re-asserts the ufw rules that keep SSH reachable on nigserHP.
#
# Why this exists: ufw is enabled with DEFAULT_INPUT_POLICY=DROP and its persistent
# config (/etc/ufw/user.rules) shipped with no rule for port 22. Any runtime fix
# (ufw disable, rule delete) is wiped on reboot and SSH dies again. The website keeps
# working the whole time because Funnel traffic is proxied by tailscaled out of
# localhost, so nothing looks broken until you try to log in.
#
# Installed to /usr/local/sbin/ and run at every boot by ssh-firewall-guard.service.
# Idempotent: ufw skips rules that already exist, so re-running is free.
#
# Deliberately NOT `set -e` on the ufw calls. ufw reports backend failures as a bare
# "ERROR: problem running" with no detail, and some rule forms (interface-scoped,
# commented, v6) fail on this box while plainer ones succeed. So each form is tried in
# turn and the script only fails if *every* one failed to leave port 22 open.
set -uo pipefail

LAN_CIDR="192.168.1.0/24"
DIAG=/var/log/ssh-firewall-guard.log

log() { printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$DIAG"; }

try() {
  local desc="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    log "OK   [$desc] $*"
    [ -n "$out" ] && printf '       %s\n' "$out" >>"$DIAG"
    return 0
  fi
  log "FAIL [$desc] $*"
  printf '       %s\n' "${out:-<no output from ufw>}" | tee -a "$DIAG"
  return 1
}

port22_open() { ufw status 2>/dev/null | grep -qE '(^|[^0-9])22(/tcp)?[[:space:]].*ALLOW'; }

log "=== ssh-firewall-guard start (ufw $(ufw version 2>&1 | head -1)) ==="

# Preferred: scoped to the tailnet interface and the LAN, least exposure.
try "tailscale0+comment" ufw allow in on tailscale0 to any port 22 proto tcp comment 'ssh over tailscale (guard)' \
  || try "tailscale0" ufw allow in on tailscale0 to any port 22 proto tcp

try "lan+comment" ufw allow from "$LAN_CIDR" to any port 22 proto tcp comment 'ssh from LAN (guard)' \
  || try "lan" ufw allow from "$LAN_CIDR" to any port 22 proto tcp

# Fallback: plain port rule. Still not internet-exposed — the router forwards nothing to
# 22, and Tailscale Funnel only publishes 443. This reaches LAN + tailnet only.
if ! port22_open; then
  log "scoped rules did not take; falling back to a plain port rule"
  try "plain 22/tcp" ufw allow 22/tcp
fi

# The real failure seen on 2026-08-06: ufw.conf said ENABLED=yes and ufw.service reported
# active, but `ufw status` was inactive with an empty iptables (INPUT policy ACCEPT). In
# that state every `ufw allow` still writes user.rules but fails to apply, reporting a
# bare "ERROR: problem running". Re-enabling loads user.rules and everything takes.
# Rules are added BEFORE this point on purpose — enabling a DROP-default firewall that
# has no port 22 rule is exactly how you lock yourself out.
if grep -q '^ENABLED=yes' /etc/ufw/ufw.conf 2>/dev/null && ! ufw status 2>/dev/null | grep -q '^Status: active'; then
  log "ufw is configured ENABLED=yes but reports inactive; re-enabling"
  try "force enable" ufw --force enable
fi

if port22_open; then
  log "RESULT: port 22 is allowed"
  ufw status | sed 's/^/       /' >>"$DIAG"
  exit 0
fi

log "RESULT: FAILED - no port 22 allow rule could be installed. Diagnostics:"
{
  echo "--- ufw status verbose ---";  ufw status verbose 2>&1
  echo "--- ufw version ---";         ufw version 2>&1
  echo "--- iptables ---";            iptables --version 2>&1; iptables -L INPUT -n 2>&1 | head -20
  echo "--- ip6tables ---";           ip6tables --version 2>&1
  echo "--- /etc/default/ufw ---";    grep -vE '^\s*#|^\s*$' /etc/default/ufw 2>&1
  echo "--- interfaces ---";          ip -brief link 2>&1
} >>"$DIAG" 2>&1
chmod 0644 "$DIAG" 2>/dev/null || true
echo "full diagnostics written to $DIAG" >&2
exit 1
