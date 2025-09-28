# How to Upgrade

## 1. Build new talos image via packer.

- Update the `talos_version` in the `*pkrvars.hcl` files in the `packer/` folder.
- Build new images for the desired architecture.

## 2. Create a new nodegroup

- Add a new nodegroup in the `pulumi/index.ts`. It should reference the new image ID that was build with packer.
  Make sure all the other parameters match. For example location and instance type.
- Create a new patchfile for the new nodegroup in `pulumi/hcloud-talos-nodegroup-component/configPatches/<name>.yaml`.
- Run `task deploy`, verify only additions happen, then approve the changes.

## 3. Make the new nodegroup the primary one

- In the `pulumi/index.ts`, change the primary nodegroup to the new one.
- Run `task deploy`, verify nothing happens, then approve the changes (approving might not be necessary, since only the talosconfigfile output changes).
- Run `task configure-files`.

## 4. Remove nodes from kubernetes

- Run `kubectl get nodes -owide` to double check which nodes to remove.
- Run `task delete-nodes -- <nodename>` to remove the old ones.

Please note, that at this point, the nodes are shutdown, but still listed in DNS. Continue with the next step to fix this.

## 5. Remove nodes

- Remove the old nodegroup from the `pulumi/index.ts`.
- Run `task deploy`, verify only the old nodes are removed, then approve and deploy.

## 6. Cleanup

- Remove the `pulumi/hcloud-talos-nodegroup-component/configPatches/<name>.yaml` patchfile of the old nodegroup.
- Commit the changes to the codebase and push.
- Check the pipeline for errors.