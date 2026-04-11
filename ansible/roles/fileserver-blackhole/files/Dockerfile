FROM ubuntu:24.04@sha256:84e77dee7d1bc93fb029a45e3c6cb9d8aa4831ccfcc7103d36e876938d28895b

# Install Samba (v4.15.13-Ubuntu at time of writing)
RUN \
  apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y samba samba-common-bin samba-vfs-modules && \
  rm -rf /var/lib/apt/lists/*

# Copy configuration and startup script
COPY --chmod=0744 start.sh /start.sh
COPY smb.conf /etc/samba/smb.conf

CMD ["/usr/bin/bash", "-c", "/start.sh"]

# Then access with `\\ip-address\share` for windows or `smb://ip-address/share` for linux and mac
#   The `\` for windows is important
# `net use i: \\192.168.1.177\share /user:username password /p:yes
# `net use i: /delete` # (or just `/d`)
# for windows: please note, that credentials are per hostname, so all shares of the same host need to use the same credentials
