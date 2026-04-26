FROM jrottenberg/ffmpeg:8.1-ubuntu-edge@sha256:fff391e2c40a6cf128d4594b8de3bddcf180b5032b2286d6530048850ff479c1

# Install Python 3 and pip
# Clean up in the same layer to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create symlink for convenience (python3 is already available)
RUN ln -sf /usr/bin/python3 /usr/bin/python
