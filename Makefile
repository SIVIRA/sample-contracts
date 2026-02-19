.PHONY: setup
setup: deps

.PHONY: deps
deps:
	pnpm install --frozen-lockfile

.PHONY: commit
commit:
	pnpm czg

.PHONY: test
test:
	pnpm hardhat test --gas-stats

.PHONY: build
build: clean
	pnpm hardhat build --no-tests

.PHONY: clean
clean:
	pnpm hardhat clean
