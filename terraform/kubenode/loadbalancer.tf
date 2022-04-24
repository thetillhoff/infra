resource "hcloud_load_balancer_target" "kubenode" {
  type = "server"
  load_balancer_id = "${var.load_balancer_id}"
  server_id = hcloud_server.kubenode.id

  use_private_ip = true
}
