#!/usr/bin/env bash
#
# deliver-client-repos.sh
#
# Duplicates Code-Brew-AI repositories to the client's GitHub account
# (techhelpdesk-commbitz) as HISTORY-FREE snapshots of the code as it
# stood on the cutoff date (3 months ago). For each repo this script:
#
#   1. Clones the source repo (default branch)
#   2. Checks out the last commit made BEFORE the cutoff date
#   3. Deletes the entire git history
#   4. Creates a single fresh commit (neutral author, no dev identities)
#   5. Creates a private repo of the same name under the client account
#   6. Pushes the snapshot
#
# A delivery-report.txt is written next to this script recording, for
# each repo, which source commit the snapshot was taken from — keep it
# for your internal records (the client never sees it).
#
# REQUIREMENTS
#   - git, curl installed; `git lfs install` if any repo uses LFS
#   - GH_SOURCE_TOKEN : a GitHub PAT with read access to Code-Brew-AI
#   - GH_TARGET_TOKEN : a GitHub PAT with repo-create + push rights on
#                       techhelpdesk-commbitz (can be the same token if
#                       one account has access to both)
#
# USAGE
#   export GH_SOURCE_TOKEN=ghp_xxx
#   export GH_TARGET_TOKEN=ghp_yyy
#   bash deliver-client-repos.sh

set -uo pipefail

SOURCE_ORG="Code-Brew-AI"
TARGET_OWNER="techhelpdesk-commbitz"
TARGET_IS_ORG=false              # set to true if techhelpdesk-commbitz is an organization, not a user account
CUTOFF_DATE="2026-03-10"         # client receives code as of this date (exclusive)
COMMIT_AUTHOR_NAME="Code Brew Labs"
COMMIT_AUTHOR_EMAIL="delivery@code-brew.com"
COMMIT_MESSAGE="Initial code delivery (snapshot as of ${CUTOFF_DATE})"

: "${GH_SOURCE_TOKEN:?Set GH_SOURCE_TOKEN (read access to ${SOURCE_ORG})}"
: "${GH_TARGET_TOKEN:?Set GH_TARGET_TOKEN (create/push access to ${TARGET_OWNER})}"

REPOS=(
  Commbitz-backend
  commbitz_crm
  commbitz_updated_user_website
  commbitz_simcards_trading
  leap_scholar_website
  commbitz_admin
  ace_telecom
  european_travel
  globaltix_website
  university_living_website
  gurukirpa
  hoi
  commbitz_flexways
  commbitz_air_india
  commbitz_zolve_admin
  zolve_uk
  globaltixjapan_combitz
  commbitz_travelx
  holiday_tribe_web
  globaltix_free_sim
  roam_website
  globaltix_commbitz_10gb
  commbitz_redbus
  commbitz_backend
  zolve_website
  tata_neu
  basin_travel
  vfs_commbitz
  niyo_commbitz
  hoshi_frontend
  azgo
  asego
  orthox-backend
  commbitz-android
  Commbitz-ios
  Commbitz-knowledge-base
  commbitz_yocket
  commbitz_crm_php
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT="${SCRIPT_DIR}/delivery-report.txt"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Delivery run $(date -u +%Y-%m-%dT%H:%M:%SZ) — cutoff ${CUTOFF_DATE}" > "$REPORT"
echo "Source: ${SOURCE_ORG}  Target: ${TARGET_OWNER}" >> "$REPORT"
echo "----------------------------------------------------------------" >> "$REPORT"

create_target_repo() {
  local name="$1" endpoint
  if [ "$TARGET_IS_ORG" = true ]; then
    endpoint="https://api.github.com/orgs/${TARGET_OWNER}/repos"
  else
    endpoint="https://api.github.com/user/repos"
  fi
  # 422 means the repo already exists — that's fine, we just push into it
  curl -fsS -o /dev/null \
    -H "Authorization: Bearer ${GH_TARGET_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"${name}\",\"private\":true}" \
    "$endpoint" || true
}

push_with_retry() {
  local delay=2
  for _ in 1 2 3 4 5; do
    git push -u origin main && return 0
    echo "    push failed, retrying in ${delay}s..."
    sleep "$delay"; delay=$((delay * 2))
  done
  return 1
}

process_repo() {
  local repo="$1"
  local src="https://x-access-token:${GH_SOURCE_TOKEN}@github.com/${SOURCE_ORG}/${repo}.git"
  local dst="https://x-access-token:${GH_TARGET_TOKEN}@github.com/${TARGET_OWNER}/${repo}.git"
  local dir="${WORKDIR}/${repo}"

  git clone --quiet "$src" "$dir" || { echo "  CLONE FAILED"; return 1; }
  cd "$dir" || return 1

  local snapshot
  snapshot="$(git rev-list -1 --before="${CUTOFF_DATE} 00:00:00" HEAD)"
  if [ -z "$snapshot" ]; then
    echo "  SKIPPED — no commits before ${CUTOFF_DATE}"
    echo "${repo}: SKIPPED (no commit before cutoff)" >> "$REPORT"
    return 0
  fi

  local snap_date
  snap_date="$(git show -s --format=%ci "$snapshot")"
  git checkout --quiet "$snapshot"

  rm -rf .git
  git init --quiet -b main
  git add -A
  git -c user.name="$COMMIT_AUTHOR_NAME" -c user.email="$COMMIT_AUTHOR_EMAIL" \
      commit --quiet -m "$COMMIT_MESSAGE"

  create_target_repo "$repo"
  git remote add origin "$dst"
  push_with_retry || { echo "  PUSH FAILED"; echo "${repo}: PUSH FAILED" >> "$REPORT"; return 1; }

  echo "  pushed snapshot of ${snapshot:0:10} (${snap_date})"
  echo "${repo}: delivered from source commit ${snapshot} (${snap_date})" >> "$REPORT"
}

FAILED=()
for repo in "${REPOS[@]}"; do
  echo "=== ${repo} ==="
  ( process_repo "$repo" ) || FAILED+=("$repo")
done

echo
echo "Done. Report written to ${REPORT}"
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "FAILED repos (re-run after fixing access): ${FAILED[*]}"
  exit 1
fi
