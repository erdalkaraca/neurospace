#!/usr/bin/env bash
# Build actr-cheerpx ext2 chunks from the i386 Debian Dockerfile.
# Requires: docker, mkfs.ext2 (e2fsprogs), split, tar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG="${IMAGE_TAG:-neurospace/actr-cheerpx:rootfs}"
CONTAINER_NAME="${CONTAINER_NAME:-actr-cheerpx-rootfs-build}"
OUTPUT="${OUTPUT:-${SCRIPT_DIR}/dist/actr-cheerpx.ext2}"
CHUNK_DIR="${CHUNK_DIR:-${SCRIPT_DIR}/dist/actr-cheerpx}"
IMAGE_BASENAME="${IMAGE_BASENAME:-actr-cheerpx.ext2}"
# Rootfs is ~130M after Dockerfile trim; 192M leaves headroom for ext2 metadata.
IMAGE_SIZE="${IMAGE_SIZE:-192M}"
# 128K is required for CheerpX GitHubDevice in the browser; 1M chunks yield a corrupt
# ext2 overlay (ELF execution failed [-2] on /bin/sh, /opt/ecl/bin/ecl, etc.).
CHUNK_BYTES="${CHUNK_BYTES:-128K}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require mkfs.ext2
require split
require docker

split_ext2_for_github_pages() {
  local ext2="$1"
  mkdir -p "$CHUNK_DIR"
  rm -f "$CHUNK_DIR/${IMAGE_BASENAME}.meta" "$CHUNK_DIR/${IMAGE_BASENAME}.c"[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].txt
  split -b "$CHUNK_BYTES" -a 6 -x --additional-suffix=.txt \
    "$ext2" "$CHUNK_DIR/${IMAGE_BASENAME}.c"
  stat -c%s "$ext2" > "$CHUNK_DIR/${IMAGE_BASENAME}.meta"
  rm -f "$ext2"
  local count
  count="$(find "$CHUNK_DIR" -maxdepth 1 -name "${IMAGE_BASENAME}.c*.txt" | wc -l | tr -d ' ')"
  echo "Wrote $count chunks + .meta in $CHUNK_DIR ($(du -sh "$CHUNK_DIR" | awk '{print $1}'))"
}

mkdir -p "$(dirname "$OUTPUT")"
WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK_DIR"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

build_docker_rootfs_image() {
  if [[ "${ACTR_DOCKER_GHA_CACHE:-}" == "1" ]]; then
    echo "Building i386 rootfs with Docker (BuildKit + GHA cache)..."
    docker buildx inspect actr-cheerpx-builder >/dev/null 2>&1 \
      || docker buildx create --use --name actr-cheerpx-builder --driver docker-container
    docker buildx use actr-cheerpx-builder
    docker buildx build --platform linux/i386 \
      --cache-from "type=gha,scope=actr-cheerpx-rootfs" \
      --cache-to "type=gha,mode=max,scope=actr-cheerpx-rootfs" \
      -f "$SCRIPT_DIR/Dockerfile" \
      -t "$IMAGE_TAG" \
      --load \
      "$SCRIPT_DIR"
    return
  fi
  echo "Building i386 rootfs with Docker..."
  docker build --platform linux/i386 -f "$SCRIPT_DIR/Dockerfile" -t "$IMAGE_TAG" "$SCRIPT_DIR"
}

build_with_docker() {
  build_docker_rootfs_image
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  cid="$(docker create --name "$CONTAINER_NAME" "$IMAGE_TAG")"
  docker export "$cid" | tar -xf - -C "$WORK_DIR"
  docker rm "$cid" >/dev/null
}

build_with_docker

ROOT_SIZE="$(du -sh "$WORK_DIR" | awk '{print $1}')"
echo "Rootfs size: $ROOT_SIZE (allocating $IMAGE_SIZE for ext2)"
mkfs.ext2 -b 4096 -d "$WORK_DIR" "$OUTPUT" "$IMAGE_SIZE"
split_ext2_for_github_pages "$OUTPUT"
