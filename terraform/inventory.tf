resource "local_file" "ansible_inventory" {

  lifecycle {
    ignore_changes = all
  }

  content = templatefile("inventory.ini.tpl", {
    kubenodes = [hcloud_server.kubenode.ipv4_address]
  })
  filename = "../inventory.ini"
}
