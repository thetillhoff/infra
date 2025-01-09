data "hcloud_image" "packer_snapshot" {
  with_architecture = "x86"
  #   with_architecture = "arm"
  most_recent = true
  id          = "206520018"
}

resource "hcloud_server" "kubenodes" {
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

resource "time_sleep" "wait_for_vm_creation" {
  depends_on      = [hcloud_server.kubenodes]
  create_duration = "10s"
}
