resource "hcloud_network" "kubernetes" {
  name = var.CLUSTER_NAME
  ip_range = "10.0.0.0/8"
}

resource "hcloud_network_subnet" "kubernetes" {
  network_id   = hcloud_network.kubernetes.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.8.0.0/16"
}
