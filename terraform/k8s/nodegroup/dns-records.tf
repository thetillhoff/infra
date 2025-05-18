# routes to nodes of nodegroup
resource "cloudflare_record" "nodes_ipv4" {
  for_each = hcloud_server.nodes

  zone_id = var.cloudflare_zone_id
  type    = "A"
  name    = "hydra.k8s.thetillhoff.de"
  content = each.value.ipv4_address
  ttl     = 60

  proxied = false

  lifecycle {
    replace_triggered_by = [
      hcloud_server.nodes
    ]
  }
}

resource "cloudflare_record" "nodes_ipv6" {
  for_each = hcloud_server.nodes

  zone_id = var.cloudflare_zone_id
  type    = "AAAA"
  name    = "hydra.k8s.thetillhoff.de"
  content = each.value.ipv6_address
  ttl     = 60

  proxied = false

  lifecycle {
    replace_triggered_by = [
      hcloud_server.nodes
    ]
  }
}

resource "time_sleep" "wait_for_dns" {
  depends_on = [
    cloudflare_record.nodes_ipv4,
    cloudflare_record.nodes_ipv6
  ]

  lifecycle {
    replace_triggered_by = [
      cloudflare_record.nodes_ipv4,
      cloudflare_record.nodes_ipv6
    ]
  }

  create_duration = "60s"
}
