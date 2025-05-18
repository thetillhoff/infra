.PHONY: list
list:
	@grep -E '^[[:alpha:]].*:' Makefile | cat # Get all targets in this file, without color-coding the matching letters

reconcile:
	flux reconcile source git flux-system
