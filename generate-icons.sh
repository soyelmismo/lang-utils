#!/bin/bash
# Generate PNG icons from SVG
cd "$(dirname "$0")"
magick icons/icon-48.svg icons/icon-48.png
magick icons/icon-96.svg icons/icon-96.png
echo "Icons regenerated"