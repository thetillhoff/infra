#!/bin/sh
set -eu
SELF=home.internal.thetillhoff.de

list_links() {
  while read -r host; do
    [ -z "$host" ] && continue
    printf '<a href="https://%s"><b>%s</b><span>%s</span></a>\n' "$host" "${host%%.*}" "$host"
  done
}

render() {
  cat <<'HEAD'
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>internal</title>
<style>
  :root { color-scheme: light dark; --fg: #111; --bg: #fafafa; --card: #fff; --line: #e3e3e3; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e8e8e8; --bg: #16171a; --card: #202226; --line: #34363b; }
  }
  body { margin: 0; padding: 3rem 1.5rem; background: var(--bg); color: var(--fg);
         font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
       opacity: .5; margin: 1.75rem 0 1.25rem; }
  h1:first-child { margin-top: 0; }
  a { display: flex; align-items: baseline; gap: .75rem; text-decoration: none; color: inherit;
      background: var(--card); border: 1px solid var(--line); border-radius: .5rem;
      padding: .9rem 1.1rem; margin-bottom: .5rem; }
  a:hover { border-color: currentColor; }
  a b { font-weight: 600; }
  a span { font-size: .85rem; opacity: .5; margin-left: auto; }
</style>
<main>
<h1>internal</h1>
HEAD
  kubectl get services -n private-endpoints \
    -o jsonpath='{range .items[*]}{.metadata.annotations.external-dns\.alpha\.kubernetes\.io/hostname}{"\n"}{end}' \
    | grep -v '^$' | grep -vx "$SELF" | sort | list_links

  echo '<h1>external</h1>'
  kubectl get gateway https-gateway-thetillhoff-de -n gateways \
    -o jsonpath='{range .spec.listeners[*]}{.hostname}{"\n"}{end}' \
    | grep -v '^$' | sort | list_links

  echo '</main>'
}

# ponytail: poll loop, not a watch — a handful of endpoints, added maybe monthly.
while :; do
  render > /srv/.index.tmp && mv /srv/.index.tmp /srv/index.html
  sleep 60
done
