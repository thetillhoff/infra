terraform {
  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
    }

    cloudflare = {
      source = "cloudflare/cloudflare"
    }

    talos = {
      source = "siderolabs/talos"
    }
  }
}
