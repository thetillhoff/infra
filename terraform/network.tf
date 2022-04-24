resource "hcloud_network" "kubernetes" {
  name = "${var.CLUSTER_NAME}"
  ip_range = "10.8.0.0/16"
}
