locals {
  kubenodes = tomap({
    for idx in range(var.node_count) : idx => "kubenode-${idx}"
  })
}
