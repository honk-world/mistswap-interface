import { AddressZero } from '@ethersproject/constants'
import { formatUnits, parseUnits } from '@ethersproject/units'
import { ChainId, JSBI } from '@mistswapdex/sdk'
import { useSushiRollContract } from '../../hooks/useContract'
import { useLingui } from '@lingui/react'
import React, { useCallback, useEffect, useState } from 'react'
import { ChevronRight } from 'react-feather'
import { Button, ButtonConfirmed } from '../../components/Button'
import DoubleCurrencyLogo from '../../components/DoubleLogo'
import { Input } from '../../components/Input'
import QuestionHelper from '../../components/QuestionHelper'
import Dots from '../../components/Dots'
import { useActiveWeb3React } from '../../hooks'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import useMigrateState, { MigrateState } from '../../hooks/useMigrateState'
import CloseIcon from '../../components/CloseIcon';
import LPToken from '../../types/LPToken'
import MetamaskError from '../../types/MetamaskError'
import Head from 'next/head'
import Typography from '../../components/Typography'
import Badge from '../../components/Badge'
import Container from '../../components/Container'
import { AutoColumn } from '../../components/Column'

const ZERO = JSBI.BigInt(0)

const AmountInput = ({ state }: { state: MigrateState }) => {
    const onPressMax = useCallback(() => {
        if (state.selectedLPToken) {
            let balance = state.selectedLPToken.balance.raw
            if (state.selectedLPToken.address === AddressZero) {
                // Subtract 0.01 ETH for gas fee
                const fee = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(16))
                balance = JSBI.greaterThan(balance, fee) ? JSBI.subtract(balance, fee) : ZERO
            }

            state.setAmount(formatUnits(balance.toString(), state.selectedLPToken.decimals))
        }
    }, [state])

    useEffect(() => {
        if (!state.mode || state.lpTokens.length === 0 || !state.selectedLPToken) {
            state.setAmount('')
        }
    }, [state])

    if (!state.mode || state.lpTokens.length === 0 || !state.selectedLPToken) {
        return null
    }

    return (
        <>
            <Typography variant="caption" className="text-secondary">
                Amount of Tokens
            </Typography>

            <div className="flex items-center relative w-full mb-4">
                <Input.Numeric
                    className="w-full p-3 bg-input rounded focus:ring focus:ring-pink"
                    value={state.amount}
                    onUserInput={val => state.setAmount(val)}
                />
                <Button
                    variant="outlined"
                    color="pink"
                    size="small"
                    onClick={onPressMax}
                    className="absolute right-4 focus:ring focus:ring-pink"
                >
                    MAX
                </Button>
            </div>
        </>
    )
}

interface PositionCardProps {
    lpToken: LPToken
    onToggle: (lpToken: LPToken) => void
    isSelected: boolean
    updating: boolean
    exchange: string | undefined
}

const LPTokenSelect = ({ lpToken, onToggle, isSelected, updating, exchange }: PositionCardProps) => {
    return (
        <div
            key={lpToken.address}
            className="cursor-pointer flex justify-between items-center rounded px-3 py-5 bg-dark-800 hover:bg-dark-700"
            onClick={() => onToggle(lpToken)}
        >
            <div className="flex items-center space-x-3">
                <DoubleCurrencyLogo currency0={lpToken.tokenA} currency1={lpToken.tokenB} size={20} />
                <Typography
                    variant="body"
                    className="text-primary"
                >{`${lpToken.tokenA.symbol}/${lpToken.tokenB.symbol}`}</Typography>
                {lpToken.version && <Badge color="pink">{lpToken.version}</Badge>}
            </div>
            {isSelected ? <CloseIcon /> : <ChevronRight />}
        </div>
    )
}

const MigrateModeSelect = ({ state }: { state: MigrateState }) => {
    function toggleMode(mode = undefined) {
        state.setMode(mode !== state.mode ? mode : undefined)
    }

    const items = [
        {
            key: 'permit',
            text: 'Non-hardware Wallet',
            description: 'Migration is done in one-click using your signature (permit)'
        },
        {
            key: 'approve',
            text: 'Hardware Wallet',
            description: 'You need to first approve LP tokens and then migrate it'
        }
    ]

    return (
        <>
            {items.reduce((acc: any, { key, text, description }: any) => {
                if (state.mode === undefined || key === state.mode)
                    acc.push(
                        <div
                            key={key}
                            className="cursor-pointer flex justify-between items-center rounded p-3 bg-dark-800 hover:bg-dark-700"
                            onClick={() => toggleMode(key)}
                        >
                            <div>
                                <div>
                                    <Typography variant="caption">{text}</Typography>
                                </div>
                                <div>
                                    <Typography variant="caption2" className="text-secondary">
                                        {description}
                                    </Typography>
                                </div>
                            </div>
                            {key === state.mode ? <CloseIcon /> : <ChevronRight />}
                        </div>
                    )
                return acc
            }, [])}
        </>
    )
}

const MigrateButtons = ({ state, exchange }: { state: MigrateState; exchange: string | undefined }) => {
    const [error, setError] = useState<MetamaskError>({})
    const sushiRollContract = useSushiRollContract(
        state.selectedLPToken?.version ? state.selectedLPToken?.version : undefined
    )
    console.log(
        'sushiRollContract address',
        sushiRollContract?.address,
        state.selectedLPToken?.balance,
        state.selectedLPToken?.version
    )

    const [approval, approve] = useApproveCallback(state.selectedLPToken?.balance, sushiRollContract?.address)
    const noLiquidityTokens = !!state.selectedLPToken?.balance && state.selectedLPToken?.balance.equalTo(ZERO)
    const isButtonDisabled = !state.amount

    useEffect(() => {
        setError({})
    }, [state.selectedLPToken])

    if (!state.mode || state.lpTokens.length === 0 || !state.selectedLPToken) {
        return <span />
    }

    const insufficientAmount = JSBI.lessThan(
        state.selectedLPToken.balance.raw,
        JSBI.BigInt(parseUnits(state.amount || '0', state.selectedLPToken.decimals).toString())
    )

    const onPress = async () => {
        setError({})
        try {
            await state.onMigrate()
        } catch (e) {
            console.log(e)
            setError(e)
        }
    }

    return (
        <div className="space-y-4">
            {insufficientAmount ? (
                <div className="text-sm text-primary">Insufficient Balance</div>
            ) : state.loading ? (
                <Dots>Loading</Dots>
            ) : (
                <>
                    <div className="flex justify-between">
                        <div className="text-sm text-secondary">
                            Balance:{' '}
                            <span className="text-primary">{state.selectedLPToken.balance.toSignificant(4)}</span>
                        </div>
                    </div>
                    {state.mode === 'approve' && (
                        <ButtonConfirmed
                            onClick={approve}
                            confirmed={approval === ApprovalState.APPROVED}
                            disabled={approval !== ApprovalState.NOT_APPROVED || isButtonDisabled}
                            altDisabledStyle={approval === ApprovalState.PENDING}
                        >
                            {approval === ApprovalState.PENDING ? (
                                <Dots>Approving</Dots>
                            ) : approval === ApprovalState.APPROVED ? (
                                'Approved'
                            ) : (
                                'Approve'
                            )}
                        </ButtonConfirmed>
                    )}
                    {((state.mode === 'approve' && approval === ApprovalState.APPROVED) || state.mode === 'permit') && (
                        <ButtonConfirmed
                            disabled={noLiquidityTokens || state.isMigrationPending || isButtonDisabled}
                            onClick={onPress}
                        >
                            {state.isMigrationPending ? <Dots>Migrating</Dots> : 'Migrate'}
                        </ButtonConfirmed>
                    )}
                </>
            )}
            {error.message && error.code !== 4001 && (
                <div className="text-red text-center font-medium">{error.message}</div>
            )}
            <div className="text-xs text-low-emphesis text-center">
                {`Your ${exchange} ${state.selectedLPToken.tokenA.symbol}/${state.selectedLPToken.tokenB.symbol} liquidity will become SushiSwap ${state.selectedLPToken.tokenA.symbol}/${state.selectedLPToken.tokenB.symbol} liquidity.`}
            </div>
        </div>
    )
}

const ExchangeLiquidityPairs = ({ state, exchange }: { state: MigrateState; exchange: undefined | string }) => {
    function onToggle(lpToken: LPToken) {
        state.setSelectedLPToken(state.selectedLPToken !== lpToken ? lpToken : undefined)
        state.setAmount('')
    }

    if (!state.mode) {
        return null
    }

    if (state.lpTokens.length === 0) {
        return (
            <AutoColumn style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
                <div className="font-medium">
                    No Liquidity found.
                </div>
            </AutoColumn>
        )
    }

    return (
        <>
            {state.lpTokens.reduce<JSX.Element[]>((acc, lpToken) => {
                if (lpToken.balance && JSBI.greaterThan(lpToken.balance.raw, JSBI.BigInt(0))) {
                    acc.push(
                        <LPTokenSelect
                            lpToken={lpToken}
                            onToggle={onToggle}
                            isSelected={state.selectedLPToken === lpToken}
                            updating={state.updatingLPTokens}
                            exchange={exchange}
                        />
                    )
                }
                return acc
            }, [])}
        </>
    )
}

export default function MigrateV2() {
  const { i18n } = useLingui()
  const { account, chainId } = useActiveWeb3React()

  const state = useMigrateState()

  let exchange

  if (chainId === ChainId.SMARTBCH) {
      exchange = 'BenSwap'
  } else if (chainId === ChainId.SMARTBCH_AMBER) {
      exchange = 'BenSwap Amber'
  }

  return (
    <Container id="migrate-page" className="py-4 space-y-6 md:py-8 lg:py-12" maxWidth="2xl">
      <Head>
          <title key="title">Migrate LP tokens | Mist</title>
          <meta
            key="description"
            name="description"
            content="Migrate LP tokens to Mist LP tokens"
          />
          <meta key="twitter:url" name="twitter:url" content="https://app.mistswap.fi/migrate" />
          <meta key="twitter:title" name="twitter:title" content="MIGRATE LP" />
          <meta
            key="twitter:description"
            name="twitter:description"
            content="Migrate LP tokens to Mist LP tokens"
          />
          <meta key="twitter:image" name="twitter:image" content="https://app.mistswap.fi/xmist-sign.png" />
          <meta key="og:title" property="og:title" content="MIGRATE LP" />
          <meta key="og:url" property="og:url" content="https://app.mistswap.fi/migrate" />
          <meta key="og:image" property="og:image" content="https://app.mistswap.fi/xmist-sign.png" />
          <meta
            key="og:description"
            property="og:description"
            content="Migrate LP tokens to Mist LP tokens"
          />
      </Head>

      <div className="p-4 mb-3 space-y-3 text-center">
        <Typography component="h1" variant="h2">
          Migrate {exchange} Liquidity
        </Typography>
      </div>


      <div className="p-4 space-y-4 rounded bg-dark-900">
          {!account ? (
              <Typography variant="body" className="text-primary text-center p-4">
                  Connect to a wallet to view your liquidity.
              </Typography>
          ) : state.loading ? (
              <Typography variant="body" className="text-primary text-center p-4">
                  <Dots>Loading your {exchange} liquidity positions</Dots>
              </Typography>
          ) : (
              <>
                  {!state.loading && <Typography variant="body">Your Wallet</Typography>}
                  <MigrateModeSelect state={state} />
                  {!state.loading && state.mode && (
                      <div>
                          <Typography variant="body">Your Liquidity</Typography>
                          <Typography variant="caption" className="text-secondary">
                              Click on a pool below, input the amount you wish to migrate or select max, and click
                              migrate.
                          </Typography>
                      </div>
                  )}

                  <ExchangeLiquidityPairs state={state} exchange={exchange} />
                  <AmountInput state={state} />
                  <MigrateButtons state={state} exchange={exchange} />
              </>
          )}
      </div>
    </Container>
  )
}
