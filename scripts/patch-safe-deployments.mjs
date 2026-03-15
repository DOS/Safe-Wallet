#!/usr/bin/env node
/**
 * Patch @safe-global/safe-deployments to add DOS Chain (7979)
 * to Safe v1.4.1 networkAddresses.
 *
 * Safe v1.4.1 contracts deployed on DOS Chain 7979:
 *   - SafeProxyFactory:     0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
 *   - Safe (singleton):     0x41675C099F32341bf84BFc5382aF534df5C7461a
 *   - CompatibilityFallbackHandler: 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
 *   - MultiSend:            0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526
 *   - MultiSendCallOnly:    0x9641d764fc13c8B624c04430C7356C1C7C8102e2
 *   - SignMessageLib:        0xd53cd0aB83D845Ac265BE939c57F53AD838012c9
 *   - CreateCall:           0x9b35Af71d77eaf8d7e40252370304687390A1A52
 *
 * Run: node scripts/patch-safe-deployments.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHAIN_ID = '7979'

// DOS Chain 7979 contract addresses (Safe v1.4.1)
const DOS_ADDRESSES = {
  'safe-l2': '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  'safe': '0x41675C099F32341bf84BFc5382aF534df5C7461a',
  'proxy-factory': '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
  'compatibility-fallback-handler': '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
  'multi-send': '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
  'multi-send-call-only': '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
  'sign-message-lib': '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
  'create-call': '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
}

function findDeploymentsDir() {
  // Look for safe-deployments in various locations
  const candidates = [
    join(__dirname, '..', 'node_modules', '@safe-global', 'safe-deployments'),
    join(__dirname, '..', 'apps', 'web', 'node_modules', '@safe-global', 'safe-deployments'),
  ]
  for (const dir of candidates) {
    try {
      readdirSync(dir)
      return dir
    } catch {}
  }
  return null
}

function patchFile(filePath, contractName) {
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (!content.networkAddresses) return false

    const addr = DOS_ADDRESSES[contractName]
    if (!addr) return false

    if (content.networkAddresses[CHAIN_ID]) {
      console.log(`  [skip] ${contractName} already has chain ${CHAIN_ID}`)
      return false
    }

    content.networkAddresses[CHAIN_ID] = addr
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
    console.log(`  [ok] ${contractName} → ${addr}`)
    return true
  } catch (e) {
    console.log(`  [err] ${contractName}: ${e.message}`)
    return false
  }
}

const deploymentsDir = findDeploymentsDir()
if (!deploymentsDir) {
  console.log('safe-deployments not found, skipping patch')
  process.exit(0)
}

console.log(`Patching safe-deployments at: ${deploymentsDir}`)

// Patch v1.4.1 assets
const assetsDir = join(deploymentsDir, 'dist', 'assets', 'v1.4.1')
try {
  const files = readdirSync(assetsDir)
  let patched = 0
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const contractName = file.replace('.json', '')
    if (patchFile(join(assetsDir, file), contractName)) patched++
  }
  console.log(`Patched ${patched} files for chain ${CHAIN_ID}`)
} catch (e) {
  console.log(`Could not read assets dir: ${e.message}`)
}
