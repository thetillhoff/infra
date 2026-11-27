# tape

The tracker of the `tape` repo (`tracker/`) and its Postgres. The tracker reads the `handles` table, watches
each handle that is not ignored and not `off`, and logs status, viewers, followers and tips. It keeps no video,
audio or chat. Full recording is not in the cluster.

- The tracker needs the session cookie of a logged-in account for the room data and the tips. Replace the
  placeholder in `tape-session.secret.yaml` with `sops edit`. The cookie is `TAPE_SESSIONID` in `~/tape.conf`.
  An expired cookie makes the tracker stop with an error and the pod restart, so a crash loop means the cookie is dead.
- The table `handles` is empty at first. The one-way import of `handles.txt` is in `tracker/README.md` of the tape repo.
- The tracker creates its tables at start. A change to an existing table needs a migration, which does not exist yet.
- One replica with `Recreate`: two trackers at once would write every viewer row twice.
- Nothing is exposed. There is no HTTPRoute and no UI yet.
- The memory and CPU values of the tracker are start values. Read `kubectl top` after a day with real handles.
