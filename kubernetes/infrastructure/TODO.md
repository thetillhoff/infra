- webscan https://hydra.k8s.thetillhoff.de showed that the nodes are listening on port 443 on ipv4, but not on ipv6.

- storage
  - localstorage (data lost on node rotation)
  - *longhorn* <- choosen
  - ceph/rook (requires raw block devices)
  - custom (although longhorn pretty much does the same thing)
    - write custom storage operator/controller, that wraps around hostPath & local disks and implements replicas & erasure coding storage classes.
    - New kinds to map host storage: `RawBlockDevice`, `FilesystemMount`
    - NodeMountPath
      - mount path must be unique per cluster
      - option to include namespace in mount path
      - option to include node annotion/label filters
    - New StorageClass: `Replicated`
    - New StorageClass: `ErasureCoded`
    - Configure priority of storage-related pods
    - Configure pod affinity & anti-affinity of storage-related pods
      https://kubernetes.io/blog/2018/04/13/local-persistent-volumes-beta/
    - "[...] leverage local disks in your StatefulSets. You can specify directly-attached local disks as PersistentVolumes [...]"
    - local disk as PersistentVolume
      https://github.com/kubernetes-sigs/sig-storage-local-static-provisioner
    - requires manual creation of PVs per disk that shall be mounted.
      This could be automated with a custom operator/controller.
- monitoring
  - metrics via prometheus (or similar, like grafana-alternative)
    including node metrics, so something like `kubectl top node` and `kubectl top pod` works
  - visible via grafana
  - logging via loki
  - alerts via alertmanager, ...
  - tracing via jaeger
- logging, visible via grafana

---

cilium-hubble?

- Set up cert-manager as tls provider for hubble, so its certificates are auto-renewed as necessary instead of helm rotating them on every update
  https://docs.cilium.io/en/v1.15/gettingstarted/hubble-configuration/#auto-generated-certificates-via-cert-manager

---

- set up observability

- deploy apps
- migrate data from old node to new cluster
- Move dns pointers to new cluster
- Delete old cluster

---

- ipv6 dualstack ( test locally with kind first )

---

hardening
