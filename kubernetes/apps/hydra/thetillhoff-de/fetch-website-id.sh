#!/bin/bash
# Writes the umami website id into an env file for the site container.
# Fails open: on any error the pod starts without the id, so the page loads without tracking.
set -o pipefail
api=http://umami.umami.svc.cluster.local
domain=thetillhoff.de

body=$(jq -n --arg u "$USERNAME" --arg p "$PASSWORD" '{username: $u, password: $p}')
token=$(curl -sf -X POST "$api/api/auth/login" -H 'Content-Type: application/json' -d "$body" | jq -er .token) || { echo "umami login failed"; exit 0; }
auth="Authorization: Bearer $token"

# A view-only user sees websites through its teams, not through /api/websites.
user_id=$(curl -sf -H "$auth" "$api/api/me" | jq -er .user.id) || { echo "umami user lookup failed"; exit 0; }
for team in $(curl -sf -H "$auth" "$api/api/users/$user_id/teams" | jq -r '.data[].id'); do
  id=$(curl -sf -H "$auth" "$api/api/teams/$team/websites" | jq -r --arg d "$domain" '.data[] | select(.domain == $d) | .id' | head -n 1)
  [ -n "$id" ] && break
done
[ -n "${id:-}" ] || { echo "website $domain not found"; exit 0; }

# fileKeyRef accepts only single-quoted values.
echo "UMAMI_WEBSITE_ID='$id'" > /config/config.env
echo "wrote id for $domain"
