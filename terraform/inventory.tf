resource "local_file" "ansible_inventory" {
  content = templatefile("inventory.ini.tpl", {
    kubenodes = [ join(",", module.kubenode.*.public_ipv4_address) ]
  })
  filename = "../inventory.ini"
}
