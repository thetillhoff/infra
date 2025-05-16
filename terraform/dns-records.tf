# caa letsencrypt
resource "cloudflare_record" "caa" {
  lifecycle {
    ignore_changes = [
      data,
    ]
  }

  zone_id = var.cloudflare_zone_id
  type    = "CAA"
  name    = "thetillhoff.de"
  content = "0 issue \"letsencrypt.org\""
  ttl     = 3600
}

# route to k8s cluster
resource "cloudflare_record" "k8s" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "k8s.thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# grafana
resource "cloudflare_record" "grafana" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "logs.thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# website
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}
resource "cloudflare_record" "root-aaaa" {
  zone_id = var.cloudflare_zone_id
  type    = "AAAA"
  name    = "thetillhoff.de"
  content = hcloud_server.kubenode.ipv6_address
  ttl     = 3600
}

# www website
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "www.thetillhoff.de"
  content = "thetillhoff.de"
  ttl     = 3600
}

# link-shortener
resource "cloudflare_record" "link" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "link.thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# vaultwarden
resource "cloudflare_record" "vaultwarden" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "pw.thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# umami
resource "cloudflare_record" "umami" {
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "analytics.thetillhoff.de"
  content = hcloud_server.kubenode.ipv4_address
  ttl     = 3600
}

# m365 config
resource "cloudflare_record" "spf" {
  zone_id = var.cloudflare_zone_id
  type    = "TXT"
  name    = "thetillhoff.de"
  content = "\"v=spf1 include:spf.protection.outlook.com -all\""
  ttl     = 3600
}
resource "cloudflare_record" "outlook-autodiscover" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "autodiscover.thetillhoff.de"
  content = "autodiscover.outlook.com"
  ttl     = 3600
}
resource "cloudflare_record" "mx" {
  zone_id = var.cloudflare_zone_id
  type    = "MX"
  name    = "thetillhoff.de"
  content = "thetillhoff-de.mail.protection.outlook.com"
  ttl     = 3600
}
resource "cloudflare_record" "dkim1" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "selector1._domainkey.thetillhoff.de"
  content = "selector1-thetillhoff-de._domainkey.thetillhoff.onmicrosoft.com"
  ttl     = 3600
}
resource "cloudflare_record" "dkim2" {
  zone_id = var.cloudflare_zone_id
  type    = "CNAME"
  name    = "selector2._domainkey.thetillhoff.de"
  content = "selector2-thetillhoff-de._domainkey.thetillhoff.onmicrosoft.com"
  ttl     = 3600
}

# google site verification
resource "cloudflare_record" "google-site-verification" {
  zone_id = var.cloudflare_zone_id
  type    = "TXT"
  name    = "thetillhoff.de"
  content = "\"google-site-verification=2HI_U5cyyFCcB2OlrH1Ir1BahesDBofU35pVikOQQvg\""
  ttl     = 3600
}

# bluesky verification
resource "cloudflare_record" "bluesky-verification" {
  zone_id = var.cloudflare_zone_id
  type    = "TXT"
  name    = "_atproto.thetillhoff.de"
  content = "\"did=did:plc:yfywvq4oa4bx5gtd2fk3uenw\""
  ttl     = 3600
}
