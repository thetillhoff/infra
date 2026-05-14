SHELL := /bin/bash
LOG := video-management-$(shell date +%Y-%m-%d_%H-%M-%S).log

.PHONY: run

run:
	set -o pipefail; docker compose run --rm video-management 2>&1 | tee $(LOG)
