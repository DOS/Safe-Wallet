import chains from '@safe-global/utils/config/chains'
import { getSafeL2SingletonDeployments, getSafeSingletonDeployments } from '@safe-global/safe-deployments'
import ExternalStore from '@safe-global/utils/services/ExternalStore'
import { Gnosis_safe__factory } from '@safe-global/utils/types/contracts'
import Safe, { type ContractNetworksConfig } from '@safe-global/protocol-kit'
import { isValidMasterCopy } from '@safe-global/utils/services/contracts/safeContracts'
import { isPredictedSafeProps, isReplayedSafeProps } from '@/features/counterfactual/services'
import { isLegacyVersion } from '@safe-global/utils/services/contracts/utils'
import { isInDeployments } from '@safe-global/utils/hooks/coreSDK/utils'
import { getCanonicalMultiSendContractNetworks } from '@safe-global/utils/hooks/coreSDK/contractNetworks'
import type { SafeCoreSDKProps } from '@safe-global/utils/hooks/coreSDK/types'
import { keccak256 } from 'ethers'
import {
  getL2MasterCopyVersionByCodeHash,
  isL2MasterCopyCodeHash,
} from '@safe-global/utils/services/contracts/deployments'
import { logError, Errors } from '@/services/exceptions'

// Safe Core SDK
export const initSafeSDK = async ({
  provider,
  chainId,
  address,
  version,
  implementationVersionState,
  implementation,
  undeployedSafe,
}: SafeCoreSDKProps): Promise<Safe | undefined> => {
  const providerNetwork = (await provider.getNetwork()).chainId
  if (providerNetwork !== BigInt(chainId)) {
    return
  }

  let safeVersion = version ?? (await Gnosis_safe__factory.connect(address, provider).VERSION())
  let isL1SafeSingleton = chainId === chains.eth
  let contractNetworks: ContractNetworksConfig | undefined

  // If it is an official deployment we should still initiate the safeSDK
  if (!isValidMasterCopy(implementationVersionState)) {
    const masterCopy = implementation

    const safeL1Deployment = getSafeSingletonDeployments({ network: chainId, version: safeVersion })
    const safeL2Deployment = getSafeL2SingletonDeployments({ network: chainId, version: safeVersion })

    isL1SafeSingleton = isInDeployments(masterCopy, safeL1Deployment?.networkAddresses[chainId])
    const isL2SafeMasterCopy = isInDeployments(masterCopy, safeL2Deployment?.networkAddresses[chainId])

    if (!isL1SafeSingleton && !isL2SafeMasterCopy) {
      try {
        const code = await provider.getCode(masterCopy)

        if (!code || code === '0x') {
          console.warn(`[SafeSDK] No bytecode found for mastercopy at ${masterCopy}`)
          return
        }

        const codeHash = keccak256(code)
        const isUpgradeableL2MasterCopy = isL2MasterCopyCodeHash(codeHash)

        if (!isUpgradeableL2MasterCopy) {
          console.warn(`[SafeSDK] Mastercopy at ${masterCopy} is not a recognized L2 mastercopy`)
          return
        }

        const upgradeableVersion = getL2MasterCopyVersionByCodeHash(codeHash)

        if (!upgradeableVersion) {
          console.warn(`[SafeSDK] Could not determine version for L2 mastercopy at ${masterCopy}`)
          return
        }

        // Use the custom mastercopy address with the SDK
        contractNetworks = {
          [chainId]: {
            safeSingletonAddress: masterCopy,
          },
        }

        safeVersion = upgradeableVersion
        isL1SafeSingleton = false
      } catch (error) {
        logError(Errors._808, error)
        return
      }
    }

    if (isL2SafeMasterCopy) {
      isL1SafeSingleton = false
    }
  }
  // Legacy Safe contracts
  if (isLegacyVersion(safeVersion)) {
    isL1SafeSingleton = true
  }

  contractNetworks = getCanonicalMultiSendContractNetworks({
    implementationAddress: implementation,
    chainId,
    safeVersion,
    contractNetworks,
  })

  // For self-hosted chains not in safe-deployments, provide contract addresses explicitly
  // This bypasses the safe-deployments lookup that fails for custom chains
  if (!contractNetworks?.[chainId]) {
    contractNetworks = {
      ...contractNetworks,
      [chainId]: {
        ...contractNetworks?.[chainId],
        multiSendAddress: '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526',
        multiSendCallOnlyAddress: '0x9641d764fc13c8B624c04430C7356C1C7C8102e2',
        safeSingletonAddress: '0x41675C099F32341bf84BFc5382aF534df5C7461a',
        safeSingletonL2Address: '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762',
        safeProxyFactoryAddress: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67',
        fallbackHandlerAddress: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99',
        signMessageLibAddress: '0xd53cd0aB83D845Ac265BE939c57F53AD838012c9',
        createCallAddress: '0x9b35Af71d77eaf8d7e40252370304687390A1A52',
        simulateTxAccessorAddress: '0x3d4BA2E0884aa488718476ca2FB8Efc291A46199',
      },
    }
  }

  if (undeployedSafe) {
    if (isPredictedSafeProps(undeployedSafe.props) || isReplayedSafeProps(undeployedSafe.props)) {
      return Safe.init({
        provider: provider._getConnection().url,
        isL1SafeSingleton,
        ...(contractNetworks ? { contractNetworks } : {}),
        predictedSafe: undeployedSafe.props,
      })
    }
    // We cannot initialize a Core SDK for replayed Safes yet.
    return
  }

  return Safe.init({
    provider: provider._getConnection().url,
    safeAddress: address,
    isL1SafeSingleton,
    ...(contractNetworks ? { contractNetworks } : {}),
  })
}

export const {
  getStore: getSafeSDK,
  setStore: setSafeSDK,
  useStore: useSafeSDK,
} = new ExternalStore<Safe | undefined>()
