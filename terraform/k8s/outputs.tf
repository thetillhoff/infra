output "ipv4_addresses" {
  value = flatten([
    for nodegroup in values(module.nodegroup) : [
      for node in values(nodegroup.nodes) : node.ipv4_address
    ]
  ])
}

output "ipv6_addresses" {
  value = flatten([
    for nodegroup in values(module.nodegroup) : [
      for node in values(nodegroup.nodes) : node.ipv6_address
    ]
  ])
}
