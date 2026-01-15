# Variables
PLAYBOOK ?= blackhole.yaml
INVENTORY ?= inventory.yaml
ANSIBLE_OPTS ?= -bK
ANSIBLE_CMD = ansible-playbook

.PHONY: help run run-local install check syntax lint clean

.DEFAULT_GOAL := help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-15s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Execution

run: ## Run the ansible playbook (default: blackhole.yaml)
	$(ANSIBLE_CMD) $(PLAYBOOK) -i $(INVENTORY) $(ANSIBLE_OPTS)

run-local: ANSIBLE_OPTS =
run-local: run ## Run playbook locally without sudo

##@ Setup

install: ## Install ansible requirements from requirements.yaml
	ansible-galaxy install -r requirements.yaml

##@ Validation

check: syntax lint ## Run all validation checks

syntax: ## Check playbook syntax
	$(ANSIBLE_CMD) $(PLAYBOOK) -i $(INVENTORY) --syntax-check

lint: ## Lint the playbook (requires ansible-lint)
	@command -v ansible-lint >/dev/null 2>&1 || { echo "ansible-lint not found. Install with: pip install ansible-lint"; exit 1; }
	ansible-lint $(PLAYBOOK)
