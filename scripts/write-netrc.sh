#!/usr/bin/env bash
set -euo pipefail

# Accept either RNMAPBOX_MAPS_DOWNLOAD_TOKEN (preferred by @rnmapbox/maps)
# or MAPBOX_DOWNLOADS_TOKEN (older name) and propagate both so every tool
# (Pod install, config plugin, CocoaPods downloader) can see the token.
TOKEN="${RNMAPBOX_MAPS_DOWNLOAD_TOKEN:-${MAPBOX_DOWNLOADS_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "Mapbox download token missing. Set RNMAPBOX_MAPS_DOWNLOAD_TOKEN (or MAPBOX_DOWNLOADS_TOKEN) in EAS secrets."
  exit 1
fi

export MAPBOX_DOWNLOADS_TOKEN="$TOKEN"
export RNMAPBOX_MAPS_DOWNLOAD_TOKEN="$TOKEN"

printf "machine api.mapbox.com\n  login mapbox\n  password %s\n" "$TOKEN" > ~/.netrc
chmod 600 ~/.netrc
echo "Mapbox ~/.netrc created."
# Debug without leaking the token itself
echo "Mapbox token length: ${#TOKEN}"
