SHELL := /bin/bash
LOG := video-management-$(shell date +%Y-%m-%d_%H-%M-%S).log

IMAGE := video-management
# DATA: path to the directory to transcode, e.g. DATA=/var/mnt/public/videos

.PHONY: help run build-local run-local

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

run: ## Run transcoding on the fileserver (via docker compose)
	set -o pipefail; docker compose run --rm video-management 2>&1 | tee $(LOG)

build-local: ## Build the transcoding container image
	docker build -t $(IMAGE) .

run-local: ## Transcode a directory using the local AMD GPU (DATA=<path> required)
	@test -n "$(DATA)" || { echo "Error: DATA is required, e.g. make run-local DATA=/var/mnt/public/videos"; exit 1; }
	set -o pipefail; docker run --rm \
		--device /dev/dri/renderD128:/dev/dri/renderD128 \
		--security-opt label=disable \
		-v "$(CURDIR)/script.py":/script.py:ro \
		-v "$(shell echo $(DATA))":/data:rw \
		-e PYTHONUNBUFFERED=1 \
		$(IMAGE) \
		python3 /script.py \
		2>&1 | tee "$(LOG)"
