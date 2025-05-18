resource "hcloud_network" "cluster_network" {
  name     = "${var.cluster_name}-network"
  ip_range = var.network_cidr
}

resource "hcloud_network_subnet" "cluster_network_subnet" {
  network_id   = hcloud_network.cluster_network.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = var.subnet_cidr
}
