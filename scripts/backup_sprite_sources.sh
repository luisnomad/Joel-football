#!/bin/zsh
# Mirror the sprite-pipeline work files (clips, poses, studio runs, sheets; kept out of git) to the NAS.
# Safe to re-run: copies only what changed and never deletes anything on the NAS.
#   scripts/backup_sprite_sources.sh [--dry-run]
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/source-assets/sprite-pipeline/"
DEST="/Volumes/QNAP8TB/Backup/head-soccer/sprite-pipeline"
[[ -d /Volumes/QNAP8TB ]] || { echo "NAS not mounted at /Volumes/QNAP8TB"; exit 1; }
[[ -d "$SRC" ]] || { echo "nothing to back up yet ($SRC missing)"; exit 0; }
mkdir -p "$DEST"
# exFAT: no owners/permissions, 2 s timestamp resolution
rsync -rt --modify-window=2 --exclude '.DS_Store' --stats "$@" "$SRC" "$DEST/" | grep -E "Number of (regular )?files|transferred|Total file size"
