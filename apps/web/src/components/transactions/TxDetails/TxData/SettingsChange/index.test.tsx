import { SettingsInfoType } from '@safe-global/store/gateway/types'
import { render } from '@/tests/test-utils'
import SettingsChangeTxInfo from '.'

jest.mock('@/components/common/EthHashInfo', () => ({
  __esModule: true,
  default: ({ address }: { address: string }) => <span>{address}</span>,
}))

jest.mock('@/hooks/useHasUntrustedFallbackHandler', () => ({
  useHasUntrustedFallbackHandler: () => false,
}))

describe('SettingsChangeTxInfo', () => {
  it('renders a module guard address when one is set', () => {
    const moduleGuard = '0x000000000000000000000000000000000000c0de'
    const { getByText } = render(
      <SettingsChangeTxInfo
        settingsInfo={{
          type: SettingsInfoType.SET_MODULE_GUARD,
          moduleGuard: { value: moduleGuard },
        }}
      />,
    )

    expect(getByText('Set module guard:')).toBeInTheDocument()
    expect(getByText(moduleGuard)).toBeInTheDocument()
  })

  it('renders module guard removal', () => {
    const { getByText } = render(<SettingsChangeTxInfo settingsInfo={{ type: SettingsInfoType.DELETE_MODULE_GUARD }} />)

    expect(getByText('Delete module guard')).toBeInTheDocument()
  })
})
