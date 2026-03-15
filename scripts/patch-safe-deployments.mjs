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

    content.networkAddresses[CHAIN_ID] = 'canonical'
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
    console.log(`  [ok] ${contractName} → canonical`)
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

// Patch v1.4.1 assets in safe-deployments (both src and dist)
let totalPatched = 0
for (const subdir of ['dist/assets/v1.4.1', 'src/assets/v1.4.1']) {
  const assetsDir = join(deploymentsDir, subdir)
  try {
    const files = readdirSync(assetsDir)
    let patched = 0
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const contractName = file.replace('.json', '')
      if (patchFile(join(assetsDir, file), contractName)) patched++
    }
    console.log(`Patched ${patched} files in safe-deployments/${subdir} for chain ${CHAIN_ID}`)
    totalPatched += patched
  } catch (e) {
    console.log(`Could not read ${subdir}: ${e.message}`)
  }
}

// Also patch @safe-global/types-kit which has its own copy of contract assets
// Protocol-kit uses types-kit to resolve contract addresses
function patchTypesKit() {
  const typesKitCandidates = [
    join(__dirname, '..', 'node_modules', '@safe-global', 'types-kit'),
    join(__dirname, '..', 'apps', 'web', 'node_modules', '@safe-global', 'types-kit'),
  ]

  let typesKitDir = null
  for (const dir of typesKitCandidates) {
    try { readdirSync(dir); typesKitDir = dir; break } catch {}
  }
  if (!typesKitDir) {
    console.log('types-kit not found, skipping')
    return
  }

  console.log(`Patching types-kit at: ${typesKitDir}`)

  // types-kit stores assets as JS modules (not JSON), need different approach
  const contractDirs = {
    'MultiSend': { versions: ['v1.3.0', 'v1.4.1'], files: ['multi_send'] },
    'MultiSendCallOnly': { versions: ['v1.3.0', 'v1.4.1'], files: ['multi_send_call_only'] },
    'Safe': { versions: ['v1.3.0', 'v1.4.1'], files: ['safe', 'safe_l2'] },
    'SafeProxyFactory': { versions: ['v1.3.0', 'v1.4.1'], files: ['safe_proxy_factory'] },
    'CompatibilityFallbackHandler': { versions: ['v1.3.0', 'v1.4.1'], files: ['compatibility_fallback_handler'] },
    'SignMessageLib': { versions: ['v1.3.0', 'v1.4.1'], files: ['sign_message_lib'] },
    'CreateCall': { versions: ['v1.3.0', 'v1.4.1'], files: ['create_call'] },
    'SimulateTxAccessor': { versions: ['v1.3.0', 'v1.4.1'], files: ['simulate_tx_accessor'] },
  }

  let patched = 0
  for (const [dirName, config] of Object.entries(contractDirs)) {
    for (const version of config.versions) {
      // Only patch v1.4.1 (contracts we actually deployed)
      if (version !== 'v1.4.1') continue
      for (const fileName of config.files) {
        const jsFile = join(typesKitDir, 'dist', 'src', 'contracts', 'assets', dirName, version, `${fileName}.js`)
        try {
          let content = readFileSync(jsFile, 'utf-8')
          if (content.includes(`"${CHAIN_ID}"`)) {
            console.log(`  [skip] types-kit ${dirName}/${version}/${fileName} already has ${CHAIN_ID}`)
            continue
          }
          // JS file exports an object with networkAddresses. Insert 7979: "canonical"
          // Find the pattern "7897": "canonical" and add after it
          if (content.includes('"7897"')) {
            content = content.replace('"7897": "canonical"', `"7897": "canonical",\n    "${CHAIN_ID}": "canonical"`)
          } else {
            // Fallback: add before closing of networkAddresses
            content = content.replace(/("networkAddresses":\s*\{[^}]*)(})/, `$1,\n    "${CHAIN_ID}": "canonical"\n$2`)
          }
          writeFileSync(jsFile, content)
          console.log(`  [ok] types-kit ${dirName}/${version}/${fileName}`)
          patched++
        } catch (e) {
          // File might not exist for this version/contract combo
        }
      }
    }
  }
  console.log(`Patched ${patched} files in types-kit for chain ${CHAIN_ID}`)
}

patchTypesKit()
