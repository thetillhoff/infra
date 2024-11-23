data "hcloud_image" "packer_snapshot" {
  provider = hcloud.hcloud-hydra

  with_architecture = "x86"
  #   with_architecture = "arm"
  most_recent = true
}

resource "hcloud_server" "kubenodes" {
  provider = hcloud.hcloud-hydra

  count       = 3
  name        = "kubenode-${count.index}"
  server_type = "cx22"
  image       = data.hcloud_image.packer_snapshot.id
  location    = var.location
  user_data   = data.talos_machine_configuration.controlplane.machine_configuration
  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}
