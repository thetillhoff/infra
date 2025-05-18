terraform {
  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
    }

    talos = {
      source = "siderolabs/talos"
    }
  }
}
