module "kubenodes" {
  source = "./kubenode"

  cluster-name = var.CLUSTER_NAME
  location = var.location
  nodetype = "cx21"
  ssh_key_id = hcloud_ssh_key.infra.id

  SSH_PUBLIC_KEY = var.SSH_PUBLIC_KEY
  SSH_PRIVATE_KEY = var.SSH_PRIVATE_KEY

  HCLOUD_TOKEN = var.HCLOUD_TOKEN
}
