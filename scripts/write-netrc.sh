#!/usr/bin/env bash
set -euo pipefail
if [ -n "${MAPBOX_DOWNLOADS_TOKEN:-}" ]; then
  printf "machine api.mapbox.com\n  login mapbox\n  password %s\n" "$MAPBOX_DOWNLOADS_TOKEN" > ~/.netrc
  chmod 600 ~/.netrc
  echo "Mapbox ~/.netrc created."
  # debug minimal (sans afficher le token)
  echo "MAPBOX_DOWNLOADS_TOKEN length: ${#MAPBOX_DOWNLOADS_TOKEN}"
else
  echo "MAPBOX_DOWNLOADS_TOKEN is empty. Abort."
  exit 1
fi