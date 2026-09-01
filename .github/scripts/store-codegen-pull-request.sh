#!/usr/bin/env bash

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${DRIFT_FILES_PATH:?DRIFT_FILES_PATH is required}"

base_branch="${BASE_BRANCH:-dev}"
automation_branch="${AUTOMATION_BRANCH:-automation/store-codegen-drift}"
pr_title="chore: refresh store codegen snapshot"

codegen_targets=(
  "packages/store/scripts/api-schema/schema.json"
  "packages/store/src/gateway/AUTO_GENERATED/"
)

is_codegen_path() {
  local candidate="$1"

  [[ "${candidate}" == "packages/store/scripts/api-schema/schema.json" ]] ||
    [[ "${candidate}" == packages/store/src/gateway/AUTO_GENERATED/* ]]
}

unexpected_paths=()
while IFS= read -r -d '' status_entry; do
  changed_path="${status_entry:3}"
  if ! is_codegen_path "${changed_path}"; then
    unexpected_paths+=("${changed_path}")
  fi
done < <(git status --porcelain=v1 -z --untracked-files=all)

if (( ${#unexpected_paths[@]} > 0 )); then
  echo "Refusing to create an automation PR with changes outside the codegen allowlist:" >&2
  printf '  %s\n' "${unexpected_paths[@]}" >&2
  exit 1
fi

if git diff --quiet -- "${codegen_targets[@]}"; then
  echo "No store codegen drift found."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -B "${automation_branch}"
git add -- "${codegen_targets[@]}"
git commit -m "${pr_title}"

gh auth setup-git

remote_sha="$(git ls-remote --heads origin "refs/heads/${automation_branch}" | awk '{print $1}')"
if [[ -n "${remote_sha}" ]]; then
  git fetch --depth=1 origin \
    "refs/heads/${automation_branch}:refs/remotes/origin/${automation_branch}"
  git push \
    --force-with-lease="refs/heads/${automation_branch}:${remote_sha}" \
    origin "HEAD:refs/heads/${automation_branch}"
else
  git push origin "HEAD:refs/heads/${automation_branch}"
fi

body_file="$(mktemp)"
trap 'rm -f "${body_file}"' EXIT
{
  echo "The Store Codegen Drift workflow detected an upstream schema change and regenerated the checked-in gateway client snapshot."
  echo
  echo "Changed generated files:"
  sed 's/^/- `/' "${DRIFT_FILES_PATH}" | sed 's/$/`/'
  echo
  echo "This PR is automation-created, but it is intentionally not auto-merged."
} > "${body_file}"

pr_number="$(
  gh pr list \
    --repo "${GITHUB_REPOSITORY}" \
    --base "${base_branch}" \
    --head "${automation_branch}" \
    --state open \
    --json number \
    --jq '.[0].number // empty'
)"

if [[ -n "${pr_number}" ]]; then
  gh pr edit "${pr_number}" \
    --repo "${GITHUB_REPOSITORY}" \
    --title "${pr_title}" \
    --body-file "${body_file}"
else
  gh pr create \
    --repo "${GITHUB_REPOSITORY}" \
    --base "${base_branch}" \
    --head "${automation_branch}" \
    --title "${pr_title}" \
    --body-file "${body_file}"
fi
