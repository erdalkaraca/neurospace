#!/usr/bin/env bash
# Release CI: build ACT-R CheerpX chunks, then the Neurospace app (copies chunks into dist).
set -euo pipefail

sudo apt-get update
sudo apt-get install -y e2fsprogs

export ACTR_DOCKER_GHA_CACHE=1
npm run cheerpx:build-image -w @kispace-io/extension-actr
npm run build
