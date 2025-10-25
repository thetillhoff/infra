docker run \
  --rm \
  -v ./script.sh:/script.sh \
  -v /mnt/cold/public/videos:/data \
  -w /data \
  --entrypoint 'bash' \
  jrottenberg/ffmpeg:7.1-ubuntu-edge \
  /script.sh
