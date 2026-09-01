#!/usr/bin/env bash

set -euo pipefail

generated_spaces="packages/store/src/gateway/AUTO_GENERATED/spaces.ts"

grep -Fq 'entitlementsGetEntitlementsV1: build.query<' "${generated_spaces}"
grep -Fq 'export type EntitlementsResponse = {' "${generated_spaces}"
grep -Fq 'useEntitlementsGetEntitlementsV1Query' "${generated_spaces}"

echo "PASS: required Store endpoints are generated"
