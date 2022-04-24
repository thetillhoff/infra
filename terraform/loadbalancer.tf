resource "hcloud_load_balancer" "kubernetes" {
  depends_on = hcloud_network.kubernetes
  name = "kubernetes"
  load_balancer_type = "lb11"
  location = "${var.location}"

  algorithm {
    type = "least_connections"
  }
}

resource "hcloud_load_balancer_network" "kubernetes" {
  load_balancer_id = hcloud_load_balancer.kubernetes.id
  network_id = hcloud_network.kubernetes.id
  ip = "10.8.0.1"
}

resource "hcloud_load_balancer_service" "https" {
  load_balancer_id = hcloud_load_balancer.kubernetes.id
  protocol = "tcp"
  listen_port = 443
  destination_port = 443

  health_check {
    protocol = "tcp"
    port = 443
    interval = 5
    timeout = 5
    retries = 3
  }
}
