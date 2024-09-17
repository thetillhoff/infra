#!/bin/bash

# cat >> /etc/samba/smb.conf << EOL

# [public]
#     path = /mnt/NVME
#     public = yes
#     # valid users = username
#     read only = no
#     browsable = yes

# EOL

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
# --no-process-group: Run as the main process (not a sub-process) -> Else there's an error `Failed to create session`
