#!/usr/bin/env bash
# Post-boot health check for RematoOnline.
# Run after a reboot (or any time) to confirm the server came back fully:
#   bash ~/remato-online/deploy/verify-server.sh
# Every line should read OK. Anything marked FAIL needs attention.

URL=https://rematoonline.tailfb28ba.ts.net
fail=0
ok()   { printf '  OK    %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1"; fail=$((fail+1)); }

echo "=== 1. services came back on their own ==="
for s in docker tailscaled nginx; do
  [ "$(systemctl is-active $s)" = "active" ] && ok "$s active" || bad "$s NOT active"
done

echo
echo "=== 2. containers restarted unattended ==="
for c in remato-online-postgres-1 remato-online-backend-1 remato-online-frontend-1; do
  st=$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null)
  [ "$st" = "healthy" ] && ok "$c healthy" || bad "$c health=${st:-missing}"
done

echo
echo "=== 3. tailscale + funnel came back ==="
[ "$(tailscale status --json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin).get("BackendState"))')" = "Running" ] \
  && ok "tailscaled connected" || bad "tailscaled not connected"
tailscale serve status 2>/dev/null | grep -q "Funnel on" \
  && ok "Funnel on" || bad "Funnel OFF (site unreachable from internet)"

echo
echo "=== 4. local edge nginx routing ==="
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1/)
[ "$code" = "200" ] && ok "/ -> SPA ($code)" || bad "/ -> $code"
ct=$(curl -s -o /dev/null -m 15 -w '%{content_type}' 'http://127.0.0.1/api/auctions?limit=1')
case "$ct" in
  application/json*) ok "/api -> JSON ($ct)" ;;
  *)                 bad "/api -> $ct  (HTML here means the /api route is broken)" ;;
esac

echo
echo "=== 5. public URL (through Tailscale Funnel) ==="
pub=$(dig +short @8.8.8.8 rematoonline.tailfb28ba.ts.net A 2>/dev/null | head -1)
if [ -n "$pub" ]; then
  code=$(curl -s -o /tmp/vs.json -m 60 --resolve "rematoonline.tailfb28ba.ts.net:443:$pub" -w '%{http_code}' "$URL/api/auctions?limit=1")
  [ "$code" = "200" ] && ok "public API ($code via $pub)" || bad "public API -> $code"
else
  bad "no public DNS record"
fi

echo
echo "=== 6. data intact ==="
docker exec -i remato-online-postgres-1 psql -U rematoonline -d rematoonline -tAc \
 "select 'users='||(select count(*) from users)||
        ' auctions='||(select count(*) from auctions)||
        ' bids='||(select count(*) from bids)||
        ' payments='||(select count(*) from payments)||
        ' images='||(select count(*) from auction_images)" 2>/dev/null | sed 's/^/  /'
echo "  (expected at migration: users=47 auctions=25 bids=22 payments=16 images=12)"

echo
echo "=== 7. reliability settings survived ==="
[ "$(systemctl is-enabled sleep.target 2>&1)" = "masked" ] && ok "sleep masked" || bad "sleep NOT masked"
[ "$(systemctl show -p RuntimeWatchdogUSec --value)" != "0" ] && ok "watchdog armed" || bad "watchdog off"
[ "$(sysctl -n kernel.panic)" != "0" ] && ok "panic auto-reboot on" || bad "panic auto-reboot off"

echo
echo "=== 8. SSH still reachable ==="
# The reboot that proved everything else worked also silently killed SSH once:
# ufw defaults to DROP and its persistent config had no port 22 rule.
[ "$(systemctl is-active sshd)" = "active" ] && ok "sshd active" || bad "sshd NOT active"
if ufw status 2>/dev/null | grep -q '22.*ALLOW'; then
  ok "ufw allows port 22"
elif [ "$(id -u)" -ne 0 ]; then
  if grep -qE '^-A ufw-user-input .*--dport 22 -j ACCEPT|^### tuple ### allow tcp 22' /etc/ufw/user.rules 2>/dev/null; then
    ok "ufw allows port 22 (from user.rules; run as root for live check)"
  else
    bad "no port 22 rule in ufw - SSH will be dead after reboot (run deploy/install-ssh-guard.sh)"
  fi
else
  bad "no port 22 rule in ufw - SSH will be dead after reboot (run deploy/install-ssh-guard.sh)"
fi
[ "$(systemctl is-enabled ssh-firewall-guard.service 2>&1)" = "enabled" ] \
  && ok "ssh-firewall-guard armed" || bad "ssh-firewall-guard NOT installed"

# Public SSH via Funnel TCP 10000 (TLS-terminated) - the from-any-laptop path.
if tailscale funnel status 2>/dev/null | grep -q 'tcp://.*:10000'; then
  ok "SSH funnel configured on :10000"
  pub2=$(dig +short @8.8.8.8 rematoonline.tailfb28ba.ts.net A 2>/dev/null | head -1)
  if [ -n "$pub2" ]; then
    banner=$(timeout 25 openssl s_client -quiet -servername rematoonline.tailfb28ba.ts.net \
             -connect "$pub2:10000" </dev/null 2>/dev/null | grep -am1 '^SSH-')
    case "$banner" in
      SSH-*) ok "public SSH reachable (${banner})" ;;
      *)     bad "SSH funnel up but no banner from the internet" ;;
    esac
  fi
else
  bad "SSH funnel NOT configured (no from-any-laptop access)"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL CHECKS PASSED - server is fully operational."
else
  echo "$fail CHECK(S) FAILED - see FAIL lines above."
fi
exit $fail
