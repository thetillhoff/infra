locals {
  nodes = [
    for i in range(var.node_count) : {
      index = i
      name  = "${var.nodegroup_name}-${i + 1}"
    }
  ]
}
