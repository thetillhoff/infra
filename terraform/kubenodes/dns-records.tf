# route to k8s cluster
resource "cloudflare_record" "k8s-hydra" {
  count   = length(hcloud_server.kubenodes)
  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "hydra.k8s.thetillhoff.de"
  content = hcloud_server.kubenodes[count.index].ipv4_address
  ttl     = 60
}

resource "time_sleep" "wait_for_dns" {
  depends_on = [
    cloudflare_record.k8s-hydra
  ]

  create_duration = "60s"
}
