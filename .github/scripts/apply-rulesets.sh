#!/usr/bin/env bash
set -euo pipefail

# Apply repository rulesets from .github/rulesets/ using the GitHub CLI.
#
# Prerequisites:
#   - gh auth login (account must have admin access to the repo)
#   - jq installed
#
# Usage:
#   ./.github/scripts/apply-rulesets.sh [owner/repo]
#
# If owner/repo is omitted, gh uses the current repository.

REPO="${1:-}"
RULESET_FILE=".github/rulesets/main-protection.json"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is required. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required." >&2
  exit 1
fi

if [[ ! -f "$RULESET_FILE" ]]; then
  echo "error: ruleset file not found: $RULESET_FILE" >&2
  exit 1
fi

API_PATH="/repos/{owner}/{repo}/rulesets"
if [[ -n "$REPO" ]]; then
  API_PATH="/repos/${REPO}/rulesets"
fi

echo "Applying ruleset from ${RULESET_FILE}..."

# Remove an existing ruleset with the same name so the script is idempotent.
RULESET_NAME="$(jq -r '.name' "$RULESET_FILE")"
if [[ -n "$REPO" ]]; then
  EXISTING="$(gh api "/repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" || true)"
else
  EXISTING="$(gh api "/repos/{owner}/{repo}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" || true)"
fi

while IFS= read -r ruleset_id; do
  [[ -z "$ruleset_id" ]] && continue
  echo "Deleting existing ruleset id=${ruleset_id} (${RULESET_NAME})..."
  if [[ -n "$REPO" ]]; then
    gh api --method DELETE "/repos/${REPO}/rulesets/${ruleset_id}"
  else
    gh api --method DELETE "/repos/{owner}/{repo}/rulesets/${ruleset_id}"
  fi
done <<< "$EXISTING"

if [[ -n "$REPO" ]]; then
  gh api --method POST "/repos/${REPO}/rulesets" --input "$RULESET_FILE"
else
  gh api --method POST "$API_PATH" --input "$RULESET_FILE"
fi

cat <<'EOF'

Ruleset applied.

Next steps:
1. Merge or push a PR so the "typecheck" status check runs at least once on main.
2. In GitHub → Settings → Rules → Rulesets, confirm "Protect main" is active.
3. Open a test PR from a collaborator account and verify:
   - direct pushes to main are blocked
   - merge is blocked until you approve
   - merge is blocked until "typecheck" passes

Note: required status check names must exactly match the job name in
.github/workflows/ci.yml (currently "typecheck").
EOF
