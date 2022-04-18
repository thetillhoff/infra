module "kubenode" {
  source = "./kubenode"
  count = var.kubenode_master_instances

  name = "${var.CLUSTER_NAME}-kubenode-${count.index}"
  location = "nbg1"

  master = true
  storagesize = 10

  SSH_PUBLIC_KEY = var.SSH_PUBLIC_KEY
  SSH_PRIVATE_KEY = var.SSH_PRIVATE_KEY

  HCLOUD_TOKEN = var.HCLOUD_TOKEN
}
