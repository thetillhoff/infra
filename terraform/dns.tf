# route to k8s cluster
resource "cloudflare_record" "k8s" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "k8s.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

# grafana
resource "cloudflare_record" "grafana" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "logs.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

# website
resource "cloudflare_record" "root" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

# link-shortener
resource "cloudflare_record" "link" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "link.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

# vaultwarden
resource "cloudflare_record" "vaultwarden" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "pw.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

# umami
resource "cloudflare_record" "umami" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name    = "analytics.thetillhoff.de"
  value   = hcloud_server.kubenode.ipv4_address
  type    = "A"
  ttl     = 3600
}

