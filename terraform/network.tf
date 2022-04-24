resource "hcloud_network" "kubernetes" {
  name = var.CLUSTER_NAME
  ip_range = "10.0.0.0/8"
}
