# How to upgrade talos nodegroups

## 0. Log in to Cloud Provider and check that new instances are available

## Check available Talos versions

<https://github.com/siderolabs/talos/releases/latest>

## Check compatibility with kubernetes versions

<https://docs.siderolabs.com/talos/v1.11/getting-started/support-matrix>

## 1. Build new talos image via packer

- Update the `talos_version` in the `*pkrvars.hcl` files in the `packer/` folder.
- Build new images for the desired architecture with `task build ARCH=arm64 HCLOUD_TOKEN=...`.

## 2. Create a new nodegroup

- Add a new nodegroup in the `pulumi/index.ts`. It should reference the new image ID that was build with packer.
  Make sure all the other parameters match. For example location and instance type.
- Create a new patchfile for the new nodegroup in `pulumi/hcloud-talos-nodegroup-component/configPatches/<name>.yaml`.
- Run `task deploy`, verify only additions happen, then approve the changes.
- Connect to one of the nodes and read the logs. Check for any errors.

## 3. Make the new nodegroup the primary one

- In the `pulumi/index.ts`, change the primary nodegroup to the new one.
- Run `task deploy`, even if no resources are changed. Otherwise `task configure-files` will not find use the new nodegroup.
- Run `task configure-files`.
- Run `task configure-env | source /dev/stdin` to set the talosconfig and kubeconfig paths.

## 4. Remove nodes from kubernetes

- Run `kubectl get nodes -owide` to double check which nodes to remove.
- Run `task delete-nodes -- <nodename>` to remove the old ones.
  Or (tested last times)

  ```sh
  kubectl get nodes -owide
  kubectl drain --ignore-daemonsets --delete-emptydir-data <nodename>
  # Verify that there is nothing important running on the node any more, especially pvcs and pvs!
  kubectl delete node nodename
  ```

Please note, that at this point, the nodes are shutdown, but still listed in DNS. Continue with the next step to fix this.

## 5. Remove nodes

- Remove the old nodegroup from the `pulumi/index.ts`.
- Run `task deploy`, verify only the old nodes are removed, then approve and deploy.

## 6. Cleanup

- Remove the `pulumi/hcloud-talos-nodegroup-component/configPatches/<name>.yaml` patchfile of the old nodegroup.
- Commit the changes to the codebase and push.
- Check the pipeline for errors.
