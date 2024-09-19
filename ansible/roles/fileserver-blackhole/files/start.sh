#!/bin/bash

# loop over users and passwords to create them in the container and samba - make sure uid and gid are settable from config
# Loop over shares, each with their own config

useradd user
(echo abc; echo abc) | smbpasswd -a user

# /mnt is empty by default, and every share should be mounted into it
chmod 0777 /mnt -R

# From smb.conf:
# NOTE: Whenever you modify this file you should run the command
# "testparm" to check that you have not made any basic syntactic 
# errors.
testparm -s > /dev/null

# Start samba
/usr/sbin/smbd --foreground --debug-stdout --no-process-group
# /usr/sbin/smbd --foreground --no-process-group
# --foreground: Keep the process in the foreground so Docker can see its output
# --debug-stdout: Log to stdout
# --no-process-group: Run as the main process (not a sub-process) -> Else there might be an error `Failed to create session`
