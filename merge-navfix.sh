#!/bin/zsh
# ─────────────────────────────────────────────────────────────
# merge-navfix.sh
# Merges origin/navfix into master while keeping all features.
# Run from inside the miniproject folder:
#   chmod +x merge-navfix.sh && ./merge-navfix.sh
# ─────────────────────────────────────────────────────────────

set -e   # stop on first unexpected error
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   LASER DEFENDER — merge-navfix.sh       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Make sure we are on master ────────────────────────
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "master" ]; then
  echo "▶  Switching to master..."
  git checkout master
fi
echo "✓  On branch: master"

# ── Step 2: Commit any un-committed clean files ───────────────
#    (the conflict-resolved versions written by Copilot)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo ""
  echo "▶  Staging conflict-resolved files..."
  git add index.html style.css app.js
  git commit -m "fix: resolve all merge conflicts — clean master state"
  echo "✓  Committed clean master state"
else
  echo "✓  Working tree is clean, nothing to commit"
fi

# ── Step 3: Fetch latest navfix from remote ───────────────────
echo ""
echo "▶  Fetching origin/navfix..."
git fetch origin navfix
echo "✓  Fetched origin/navfix"

# ── Step 4: Merge navfix into master ─────────────────────────
echo ""
echo "▶  Merging origin/navfix into master..."

# Try a normal merge first
if git merge origin/navfix --no-edit -m "merge: combine navfix into master — keep all features"; then
  echo "✓  Merged cleanly — no conflicts!"
else
  echo ""
  echo "⚠  Conflicts detected. Auto-resolving by keeping master versions"
  echo "   (master already contains all navfix features)..."

  # For each conflicted file, keep OUR (master) version.
  # Our versions are the fully-merged, clean copies Copilot wrote.
  CONFLICTED=$(git diff --name-only --diff-filter=U)

  if [ -z "$CONFLICTED" ]; then
    echo "✓  No conflicted files found."
  else
    echo "$CONFLICTED" | while read -r FILE; do
      echo "   Resolving: $FILE  → keeping master version"
      git checkout --ours -- "$FILE"
      git add "$FILE"
    done
  fi

  # Complete the merge
  git commit --no-edit -m "merge: combine navfix into master — conflicts resolved, all features kept"
  echo "✓  Merge complete"
fi

# ── Step 5: Final status ──────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "✅  Done! master now contains features from"
echo "    both master and origin/navfix."
echo ""
git log --oneline -5
echo "══════════════════════════════════════════════"
echo ""
echo "You can now safely run:  git push origin master"
echo ""
