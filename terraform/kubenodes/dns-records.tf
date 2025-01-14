# route to k8s cluster
resource "cloudflare_record" "k8s-hydra" {
  for_each = hcloud_server.kubenodes
  zone_id  = var.cloudflare_zone_id
  type     = "A"
  name     = "hydra.k8s.thetillhoff.de"
  content  = each.value.ipv4_address
  ttl      = 60

  lifecycle {
    replace_triggered_by = [
      hcloud_server.kubenodes
    ]
  }
}

resource "time_sleep" "wait_for_dns" {
  depends_on = [
    cloudflare_record.k8s-hydra
  ]

  lifecycle {
    replace_triggered_by = [
      cloudflare_record.k8s-hydra
    ]
  }

  create_duration = "60s"
}
