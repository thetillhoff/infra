terraform {
  required_providers {
    local = {
      source = "hashicorp/local"
    }

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
