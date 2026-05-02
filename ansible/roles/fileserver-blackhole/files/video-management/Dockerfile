FROM jrottenberg/ffmpeg:8.1-ubuntu-edge@sha256:e8660287070825e8e7aa1e897360dbbfc5c1ac45fc027689f2a00c279b9725a9

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
