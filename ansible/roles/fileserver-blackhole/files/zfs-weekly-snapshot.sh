#!/bin/bash
set -euo pipefail
LABEL="weekly-$(date +%Y%m%d_%H%M%S)"
KEEP=8

for pool in hot cold; do
  zfs snapshot -r "${pool}@${LABEL}"
  zfs list -t snapshot -o name -s creation | \
    grep "^${pool}@weekly-" | \
    head -n "-${KEEP}" | \
    xargs -r zfs destroy
done
