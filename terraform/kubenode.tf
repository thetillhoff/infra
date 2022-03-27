module "kubenode" {
  source = "./kubenode"
  count = var.kubenode_master_instances

  name = "kubenode-master-${count.index}"
  location = "nbg1"

  master = true
  storagesize = 10

  SSH_PUBLIC_KEY = var.SSH_PUBLIC_KEY
  SSH_PRIVATE_KEY = var.SSH_PRIVATE_KEY

  HCLOUD_TOKEN = var.HCLOUD_TOKEN

  CLOUDFLARE_EMAIL = var.CLOUDFLARE_EMAIL
  CLOUDFLARE_APIKEY = var.CLOUDFLARE_APIKEY
}
