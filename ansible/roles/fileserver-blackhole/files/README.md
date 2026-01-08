# User management

By mounting /etc/passwd etc into the container, the username:userid mapping from the host systems are used.
To make those users work with samba, they are mapped into samba by reading from a `users.txt` file.
Creating a new user/share requires to run
`sudo adduser --no-create-home --disabled-password --disabled-login <username>`
on the host machine first (while leaving all the prompts on default settings), then add an entry to the `users.txt` file and restart the container.

If you need to remotely access the share via ssh, too, skip the `--no-create-home` and `--disabled-password` flags and instead run:

```sh
sudo adduser <username>
sudo su <username>
ssh-keygen -t ed25519 -C "<username>"
cp ~/.ssh/id_ed25519.pub ~/.ssh/authorized_keys
```

Requires the `users.txt` to be unencrypted on the host system and mounted into the container at `/mnt/config/users.txt`.
It can be decrypted from the `users.secret.txt` in this folder via sops (`sops decrypt users.secret.txt --output /mnt/cold/users.txt`).
This is not done automatically.

A user-specific share is created per user. The configuration for this happens in the `start.sh`.
The container expects the corresponding folders at `/mnt/<username>/`.

In case any userid change (reinstall of host OS): `chown` and `chmod` are run on all the shares during startup.
