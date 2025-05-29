packer {
  required_plugins {
    hcloud = {
      version = "1.6.0"
      source  = "github.com/hetznercloud/hcloud" # https://github.com/hetznercloud/packer-plugin-hcloud
    }
  }
}

variable "talos_version" {
  type    = string
}

variable "arch" {
  type    = string
}

variable "image_id" {
  type    = string
}

variable "server_type" {
  type    = string
}

variable "server_location" {
  type    = string
  default = "nbg1"
}

variable "HCLOUD_TOKEN" {
  type    = string
  sensitive = true
}

source "hcloud" "talos" {
  token        = var.HCLOUD_TOKEN

  rescue       = "linux64"
  image        = "debian-12"
  location     = var.server_location
  server_type  = var.server_type
  ssh_username = "root"
  temporary_key_pair_type = "ed25519"
  # Don't disable any public ip, as your isp might only support either or for your connection

  snapshot_name = "talos-${var.talos_version}-${var.arch}"
}

build {
  sources = ["source.hcloud.talos"]

  provisioner "shell" {
    inline = [
      "apt-get install -y wget",
      "wget -O /tmp/talos.raw.xz https://factory.talos.dev/image/${var.image_id}/${var.talos_version}/hcloud-${var.arch}.raw.xz",
      "xz -d -c /tmp/talos.raw.xz | dd of=/dev/sda && sync",
    ]
  }
}
