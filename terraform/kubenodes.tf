module "kubenodes" {
  source = "./kubenode"
  count = var.kubenode_master_instances

  depends_on = [hcloud_load_balancer.kubernetes]

  cluster-name = "${var.CLUSTER_NAME}"
  index = "${count.index}"
  location = var.location
  nodetype = "cx21"
  network_id = hcloud_network.kubernetes.id
  ssh_key_id = hcloud_ssh_key.infra.id
  load_balancer_id = hcloud_load_balancer.kubernetes.id

  storagesize = 10

  SSH_PUBLIC_KEY = var.SSH_PUBLIC_KEY
  SSH_PRIVATE_KEY = var.SSH_PRIVATE_KEY

  HCLOUD_TOKEN = var.HCLOUD_TOKEN
}
