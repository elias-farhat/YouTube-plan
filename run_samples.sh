#!/usr/bin/env bash
# Render one sample Short per channel into samples/output/
set -euo pipefail
cd "$(dirname "$0")"
python3 -m pipeline render samples/scripts/*.txt -o samples/output "$@"
