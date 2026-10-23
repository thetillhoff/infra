#!/bin/bash
# Writes the umami website id into an env file for the site container.
# Fails open: on any error the pod starts without the id, so the page loads without tracking.
# kubelet rejects a missing or empty env file even with optional: true, so a placeholder file always exists.
set -o pipefail
echo "UMAMI_UNAVAILABLE='1'" > /config/config.env

api=http://umami.umami.svc.cluster.local
domain=thetillhoff.de

# A request that hangs (umami down, a policy that drops the call) must not block the pod start.
api_curl() { curl -sf --connect-timeout 3 --max-time 5 "$@"; }

body=$(jq -n --arg u "$USERNAME" --arg p "$PASSWORD" '{username: $u, password: $p}')
token=$(api_curl -X POST "$api/api/auth/login" -H 'Content-Type: application/json' -d "$body" | jq -er .token) || { echo "umami login failed"; exit 0; }
auth="Authorization: Bearer $token"

# A view-only user sees websites through its teams, not through /api/websites.
user_id=$(api_curl -H "$auth" "$api/api/me" | jq -er .user.id) || { echo "umami user lookup failed"; exit 0; }
for team in $(api_curl -H "$auth" "$api/api/users/$user_id/teams" | jq -r '.data[].id'); do
  id=$(api_curl -H "$auth" "$api/api/teams/$team/websites" | jq -r --arg d "$domain" '.data[] | select(.domain == $d) | .id' | head -n 1)
  [ -n "$id" ] && break
done
[ -n "${id:-}" ] || { echo "website $domain not found"; exit 0; }
[[ "$id" =~ ^[0-9a-f-]{36}$ ]] || { echo "website id has an unexpected format"; exit 0; }

# fileKeyRef accepts only single-quoted values. The rename keeps a half-written file from being read.
echo "UMAMI_WEBSITE_ID='$id'" > /config/config.env.tmp
mv /config/config.env.tmp /config/config.env
echo "wrote id for $domain"
