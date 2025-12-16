FROM jrottenberg/ffmpeg:8.0-ubuntu-edge@sha256:3707e6a2d7abc945af25084ea391039b65c8eda4f6dcbde31684b85f44775ad7

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
