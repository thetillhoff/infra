# caa letsencrypt
resource "cloudflare_record" "caa" {
  zone_id = var.cloudflare_zone_id
  type    = "CAA"
  name    = "thetillhoff.de"
  value   = "0 issue \"letsencrypt.org\""
  ttl     = 3600
}

# route to k8s cluster
resource "cloudflare_record" "k8s" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "k8s.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# grafana
resource "cloudflare_record" "grafana" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "logs.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# website
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}
resource "cloudflare_record" "root-aaaa" {
  zone_id = var.cloudflare_zone_id
  type    = "AAAA"
  name    = "thetillhoff.de"
  value   = hcloud_server.kubenode.ipv6_address
  ttl     = 3600
}

# www website
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "www.thetillhoff.de"
  value   = "thetillhoff.de"
  ttl     = 3600
}

# link-shortener
resource "cloudflare_record" "link" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "link.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# vaultwarden
resource "cloudflare_record" "vaultwarden" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "pw.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# umami
resource "cloudflare_record" "umami" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "analytics.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# m365 config
resource "cloudflare_record" "spf" {
  zone_id = var.cloudflare_zone_id
  type    = "TXT"
  name    = "thetillhoff.de"
  value   = "v=spf1 include:spf.protection.outlook.com -all"
  ttl     = 3600
}
resource "cloudflare_record" "outlook-autodiscover" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "autodiscover.thetillhoff.de"
  value   = "autodiscover.outlook.com"
  ttl     = 3600
}
resource "cloudflare_record" "mx" {
  zone_id = var.cloudflare_zone_id
  type    = "MX"
  name    = "thetillhoff.de"
  value   = "thetillhoff-de.mail.protection.outlook.com"
  ttl     = 3600
}
resource "cloudflare_record" "dkim1" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "selector1._domainkey.thetillhoff.de"
  value   = "selector1-thetillhoff-de._domainkey.thetillhoff.onmicrosoft.com"
  ttl     = 3600
}
resource "cloudflare_record" "dkim2" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "selector2._domainkey.thetillhoff.de"
  value   = "selector2-thetillhoff-de._domainkey.thetillhoff.onmicrosoft.com"
  ttl     = 3600
}

# google site verification
resource "cloudflare_record" "google-site-verification" {
  zone_id = var.cloudflare_zone_id
  type    = "TXT"
  name    = "thetillhoff.de"
  value   = "google-site-verification=2HI_U5cyyFCcB2OlrH1Ir1BahesDBofU35pVikOQQvg"
  ttl     = 3600
}
