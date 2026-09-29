#!/usr/bin/env bash
# Installs a pinned upstream rclone for the backup workflows (TASK-157).
#
# Not Ubuntu's package: rclone 1.60 (the 24.04 package) reads every upload
# back with HEAD ?versionId=, which R2 answers 501 Not Implemented. The file
# lands intact but is reported failed, and only a retry turns the run green.
#
# The checksum is pinned here rather than fetched from the same server as
# the zip, so a tampered download fails. To upgrade, take both values from
# https://downloads.rclone.org/<version>/SHA256SUMS.

set -euo pipefail

RCLONE_VERSION=v1.75.1
RCLONE_SHA256=982b5aa772841168f8e380f139e9e787b2a105403e32b94da8676a0e1c0a13ab

zip="rclone-${RCLONE_VERSION}-linux-amd64.zip"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL -o "$tmp/$zip" "https://downloads.rclone.org/${RCLONE_VERSION}/${zip}"
echo "${RCLONE_SHA256}  $tmp/$zip" | sha256sum -c -
unzip -q "$tmp/$zip" -d "$tmp"
sudo install -m 755 "$tmp/${zip%.zip}/rclone" /usr/local/bin/rclone
rclone version | head -1
