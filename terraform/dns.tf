# route to k8s cluster
resource "cloudflare_record" "k8s" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name = "k8s.${var.ROOT_DOMAIN}"
  value = "${hcloud_server.kubenode.ipv4_address}"
  type = "A"
  ttl = 3600
}

# website
resource "cloudflare_record" "root" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name = "${var.ROOT_DOMAIN}"
  value = "${hcloud_server.kubenode.ipv4_address}"
  type = "A"
  ttl = 3600
}

# link-shortener
resource "cloudflare_record" "link" {
  zone_id = "94d9f474ce48a61513a68744b663f5e5"
  name = "link.${var.ROOT_DOMAIN}"
  value = "${hcloud_server.kubenode.ipv4_address}"
  type = "A"
  ttl = 3600
}
