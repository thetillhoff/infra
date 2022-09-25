# How to check the status of the ZFS pools
```
zpool status
```

# Example pod configuration with ZFS and Kubernetes `hostPath`
```
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
  - image: registry.k8s.io/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /test-pd
      name: test-volume
  volumes:
  - name: test-volume
    hostPath:
      path: /mnt/hot/test
      type: DirectoryOrCreate
```
