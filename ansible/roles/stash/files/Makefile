.PHONY: list
list:
	@grep -E '^[[:alpha:]].*:' Makefile | cat # Get all targets in this file, without color-coding the matching letters

start:
	UID="$(id -u)" GID="$(id -g)" docker compose up -d

stop:
	docker compose down --remove-orphans

restart:
	@$(MAKE) --no-print-directory stop
	@$(MAKE) --no-print-directory start
