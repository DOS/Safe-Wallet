#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_path="$(cd "${script_dir}/.." && pwd)/store-codegen-pull-request.sh"
test_root="$(mktemp -d)"

cleanup() {
  rm -rf "${test_root}"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local needle="$1"
  local file="$2"
  grep -Fq -- "${needle}" "${file}" || fail "Expected ${file} to contain: ${needle}"
}

remote_path="${test_root}/remote.git"
repo_path="${test_root}/repo"
stub_bin="${test_root}/bin"
gh_log="${test_root}/gh.log"
drift_files="${test_root}/drift-files.txt"

codegen_paths=(
  "packages/store/scripts/api-schema/schema.json"
  "packages/store/src/gateway/AUTO_GENERATED/.schema-hash"
  "packages/store/src/gateway/AUTO_GENERATED/auth.ts"
  "packages/store/src/gateway/AUTO_GENERATED/relay.ts"
  "packages/store/src/gateway/AUTO_GENERATED/spaces.ts"
  "packages/store/src/gateway/AUTO_GENERATED/transactions.ts"
)

git init --bare "${remote_path}" >/dev/null
git init --initial-branch=dev "${repo_path}" >/dev/null
git -C "${repo_path}" config user.name "Test User"
git -C "${repo_path}" config user.email "test@example.com"

for path in "${codegen_paths[@]}"; do
  mkdir -p "${repo_path}/$(dirname "${path}")"
  printf 'initial\n' > "${repo_path}/${path}"
done
printf 'baseline\n' > "${repo_path}/README.md"
git -C "${repo_path}" add .
git -C "${repo_path}" commit -m "initial" >/dev/null
git -C "${repo_path}" remote add origin "${remote_path}"
git -C "${repo_path}" push --set-upstream origin dev >/dev/null

mkdir -p "${stub_bin}"
printf '%s\n' '#!/usr/bin/env bash' > "${stub_bin}/gh"
printf '%s\n' 'set -euo pipefail' >> "${stub_bin}/gh"
printf '%s\n' 'printf "%s\\n" "$*" >> "${GH_STUB_LOG}"' >> "${stub_bin}/gh"
printf '%s\n' 'if [[ "${1:-}" == "pr" && "${2:-}" == "list" ]]; then' >> "${stub_bin}/gh"
printf '%s\n' '  printf "%s" "${GH_STUB_PR_NUMBER:-}"' >> "${stub_bin}/gh"
printf '%s\n' 'elif [[ "${1:-}" == "pr" && "${2:-}" == "create" ]]; then' >> "${stub_bin}/gh"
printf '%s\n' '  printf "%s\\n" "https://github.com/DOS/Safe-Wallet/pull/123"' >> "${stub_bin}/gh"
printf '%s\n' 'elif [[ "${1:-}" == "pr" && "${2:-}" == "edit" ]]; then' >> "${stub_bin}/gh"
printf '%s\n' '  printf "%s\\n" "https://github.com/DOS/Safe-Wallet/pull/${3:-42}"' >> "${stub_bin}/gh"
printf '%s\n' 'fi' >> "${stub_bin}/gh"
chmod +x "${stub_bin}/gh"

printf '%s\n' "${codegen_paths[@]}" > "${drift_files}"

run_script() {
  (
    cd "${repo_path}"
    PATH="${stub_bin}:${PATH}" \
      GH_TOKEN="test-token" \
      GH_STUB_LOG="${gh_log}" \
      GH_STUB_PR_NUMBER="${GH_STUB_PR_NUMBER:-}" \
      GITHUB_REPOSITORY="DOS/Safe-Wallet" \
      BASE_BRANCH="dev" \
      AUTOMATION_BRANCH="automation/store-codegen-drift" \
      DRIFT_FILES_PATH="${drift_files}" \
      bash "${script_path}"
  )
}

for path in "${codegen_paths[@]}"; do
  printf 'first refresh\n' > "${repo_path}/${path}"
done

run_script

first_remote_sha="$(git --git-dir="${remote_path}" rev-parse refs/heads/automation/store-codegen-drift)"
[[ -n "${first_remote_sha}" ]] || fail "Automation branch was not created"
[[ "$(git --git-dir="${remote_path}" show "${first_remote_sha}:${codegen_paths[0]}")" == "first refresh" ]] || fail "Generated content was not pushed"
assert_contains "pr create" "${gh_log}"
if grep -Fq "pr edit" "${gh_log}"; then
  fail "First run must create a PR, not edit one"
fi

git -C "${repo_path}" checkout dev >/dev/null
for path in "${codegen_paths[@]}"; do
  printf 'second refresh\n' > "${repo_path}/${path}"
done
: > "${gh_log}"
GH_STUB_PR_NUMBER=42 run_script

second_remote_sha="$(git --git-dir="${remote_path}" rev-parse refs/heads/automation/store-codegen-drift)"
[[ "${second_remote_sha}" != "${first_remote_sha}" ]] || fail "Automation branch was not updated"
[[ "$(git --git-dir="${remote_path}" show "${second_remote_sha}:${codegen_paths[0]}")" == "second refresh" ]] || fail "Updated generated content was not pushed"
assert_contains "pr edit 42" "${gh_log}"

git -C "${repo_path}" checkout dev >/dev/null
printf 'unexpected change\n' > "${repo_path}/README.md"
printf 'third refresh\n' > "${repo_path}/${codegen_paths[0]}"
: > "${gh_log}"
if GH_STUB_PR_NUMBER=42 run_script; then
  fail "Script accepted a change outside the codegen allowlist"
fi

final_remote_sha="$(git --git-dir="${remote_path}" rev-parse refs/heads/automation/store-codegen-drift)"
[[ "${final_remote_sha}" == "${second_remote_sha}" ]] || fail "Rejected run changed the remote branch"

echo "PASS: store codegen PR automation"
