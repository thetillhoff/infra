# Longhorn

## Backups

Both jobs write to the backup target `s3://hydra-k8s-backup@backblaze/` and keep 7 copies.

| Job | Time (UTC) | Content |
| --- | --- | --- |
| `daily` (`recurringJob-daily.yaml`) | 05:00 | One backup of each volume in the group `default`: the data. |
| `system-backup` (`recurringJob-system-backup.yaml`) | 06:40 | The Longhorn settings and objects, and the PVs, PVCs and StorageClasses that tie the newest volume backups to their apps. |

A volume backup alone restores the data, but you must create the PV and PVC for it by hand. A system backup restores the volumes together with their PVs and PVCs, so that each app finds its data under the old PVC name. The system backup does not copy the data again: it points to the newest volume backup of each volume.

## Restore after a cluster rebuild

The restore skips a PVC that already exists. Flux creates the PVCs of the apps at once and empty, so keep the apps that own PVCs suspended until the restore completes. The steps are not tested yet.

1. Before the rebuild, suspend the Kustomizations that own PVCs in git, then push:

   ```sh
   for f in kubernetes/clusters/hydra/app-{federated-cloud-platform,manga-scraper,trading,umami,vaultwarden,wedding-website}.yaml kubernetes/clusters/hydra/resource-monitoring.yaml; do
     awk '{print} /^spec:$/ {print "  suspend: true"}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
   done
   ```

2. Rebuild the cluster (`task deploy`). Wait until the backup target is available and the system backups show up from the bucket:

   ```sh
   kubectl -n longhorn get backuptargets
   kubectl -n longhorn get systembackups
   ```

3. Restore the newest system backup:

   ```sh
   backup=<name of the newest system backup>
   kubectl -n longhorn create -f - <<EOF
   apiVersion: longhorn.io/v1beta2
   kind: SystemRestore
   metadata:
     name: restore-$backup
   spec:
     systemBackup: $backup
   EOF
   kubectl -n longhorn get systemrestores -w
   ```

4. When the state is `Completed`, check that each PVC is `Bound` (`kubectl get pvc -A`). Then revert the commit of step 1, push and run `task reconcile`.

An automatic order (Flux waits for the restore) needs a Job that finds the newest system backup and a `dependsOn` from every app on that Job. On a running cluster the Job has nothing to do, but a failure of it would block every app. The manual steps above avoid that.
