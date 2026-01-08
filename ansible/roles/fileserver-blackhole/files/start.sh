#!/bin/bash

# Exit on any error
set -e

echo "Starting Samba with host system authentication..."

# Check if users file exists
users_file="/mnt/cold/users.txt"
if [ ! -f "$users_file" ]; then
    echo "Error: Users file not found: $users_file"
    exit 1
fi

echo "Reading users from file: $users_file"

# Loop over users and perform required operations
while IFS=':' read -r username password; do
    # Skip empty lines and comments
    [ -z "$username" ] && continue
    [[ "$username" =~ ^#.*$ ]] && continue

    echo "Creating Samba user: $username"
    # Create Samba user with custom password (unattended)
    echo -e "$password\n$password" | smbpasswd -a "$username"

    echo "Setting user directory permissions: /mnt/cold/$username"
    chown "$username:$username" "/mnt/cold/$username"
    chmod 755 "/mnt/cold/$username"

    # Add share definition to smb.conf
    echo "Adding share definition for: $username"
    cat >> /etc/samba/smb.conf << EOF

[$username]
   # Private share for $username
   path = /mnt/cold/$username

   # Do not allow guest access to this share
   public = no

   # Only allow the '$username' account to access this share
   valid users = $username

   # Allow write access to the share
   writeable = yes

   # Make this share visible when browsing the server
   browsable = yes

   # File creation mask: permissions for new files (0664 = rw-rw-r--)
   # Owner and group can read/write, others can only read
   create mask = 0664

   # Directory creation mask: permissions for new directories (0775 = rwxrwxr-x)
   # Owner and group can read/write/execute, others can read/execute
   directory mask = 0775
EOF
done < "$users_file"

# Test Samba configuration
echo "Testing Samba configuration..."
testparm -s > /dev/null
if [ $? -eq 0 ]; then
    echo "Samba configuration is valid"
else
    echo "Error: Samba configuration is invalid"
    exit 1
fi

# Start Samba daemon
echo "Starting Samba daemon..."
exec /usr/sbin/smbd --foreground --debug-stdout --no-process-group
# /usr/sbin/smbd --foreground --no-process-group
# --foreground: Keep the process in the foreground so Docker can see its output
# --debug-stdout: Log to stdout
# --no-process-group: Run as the main process (not a sub-process) -> Else there might be an error `Failed to create session`
