#!/usr/bin/env bash
set -euo pipefail
# A usable preinstalled Chrome needs no apt refresh. If dependencies are missing,
# the official installer gets two bounded attempts, each followed by a real check.
if node scripts/check-installed-chrome.mjs; then
  exit 0
fi
for attempt in 1 2; do
  echo "Chrome dependency installation attempt ${attempt}/2 (180-second limit)."
  if timeout --kill-after=10s 180s npx --no-install playwright install-deps chromium; then
    echo 'Official dependency installer completed; verifying Chrome.'
  else
    echo 'Dependency installation failed or timed out; checking the actual Chrome runtime.'
  fi
  if node scripts/check-installed-chrome.mjs; then
    exit 0
  fi
done
echo 'Chrome runtime is still unavailable after bounded dependency setup.' >&2
exit 1
