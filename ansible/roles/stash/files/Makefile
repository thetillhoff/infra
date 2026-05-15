.PHONY: help
help:
	@grep -E '^[[:alpha:]].*:' Makefile | cat # Get all targets in this file, without color-coding the matching letters

start:
	UID="$(id -u)" GID="$(id -g)" docker compose up -d

stop:
	docker compose down --remove-orphans

restart:
	@$(MAKE) --no-print-directory stop
	@$(MAKE) --no-print-directory start

dev-start:
	mkdir -p dev-data/videos dev-data/config
	docker compose -f docker-compose.dev.yml up

dev-stop:
	docker compose -f docker-compose.dev.yml down --remove-orphans

dev-restart:
	@$(MAKE) --no-print-directory dev-stop
	@$(MAKE) --no-print-directory dev-start

dev-clean:
	docker compose -f docker-compose.dev.yml down --remove-orphans --volumes
	rm -rf dev-data/
