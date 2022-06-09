// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken deposit", async () => {
    let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
    let fixture

    let longToken: PerpdexLongToken
    let longTokenDecimals: number
    let market: TestPerpdexMarket
    let exchange: TestPerpdexExchange
    let weth: TestERC20
    let wethDecimals: number
    let owner: Wallet
    let alice: Wallet
    let bob: Wallet

    beforeEach(async () => {
        fixture = await loadFixture(createPerpdexExchangeFixture())

        longToken = fixture.perpdexLongToken
        longTokenDecimals = await longToken.decimals()
        market = fixture.perpdexMarket
        exchange = fixture.perpdexExchange

        weth = fixture.weth
        wethDecimals = await weth.decimals()

        owner = fixture.owner
        alice = fixture.alice
        bob = fixture.bob
    })

    function parseAssets(amount: string) {
        return parseUnits(amount, wethDecimals)
    }

    function parseShares(amount: string) {
        return parseUnits(amount, longTokenDecimals)
    }

    describe("maxDeposit", async () => {
        ;[
            {
                title: "returns 0 when market is not allowed",
                pool: {
                    base: "0",
                    quote: "0",
                },
                isMarkeAllowed: false,
                expected: "0",
            },
            {
                title: "returns 0 when pool liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                expected: "0",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10",
                    quote: "10",
                },
                expected: "0.240999270514668206",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                if (test.isMarkeAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)
                }

                expect(await longToken.maxDeposit(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewDeposit", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            // {
            //   title: "TODO: returns 0 if market disabled",
            //   pool: {
            //     base: "10",
            //     quote: "10",
            //   },
            //   aliceQuoteAssets: "1000",
            //   depositAssets: "100",
            //   mintedShares: "0",
            // },
            {
                title: "returns 0 if assets is zero",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "0",
                mintedShares: "0",
            },
            {
                title: "TODO: returns partial shares when pool does not have enough liquidity",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                mintedShares: "9.090909090909090909",
            },
            {
                title: "success",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "500",
                depositAssets: "10",
                mintedShares: "9.990009990009990009",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice deposit preview
                var depositAssets = parseAssets(test.depositAssets)
                var mintedShares = parseShares(test.mintedShares)
                expect(await longToken.connect(alice).previewDeposit(depositAssets)).to.eq(mintedShares)
            })
        })
    })

    describe("deposit", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when pool does not have enough liquidity",
                pool: {
                    base: "1",
                    quote: "1",
                },
                aliceQuoteAssets: "100",
                depositAssets: "10",
                revertedWith: "TL_OP: normal order price limit",
            },
            {
                title: "reverts when alice does not have enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "5",
                depositAssets: "10",
                revertedWith: "ERC20: transfer amount exceeds balance",
            },
            {
                title: "successes when alice has enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "50",
                depositAssets: "20",
                mintedShares: "19.960079840319361277",
                totalAssetsAfter: "20.039999999999999999",
                aliceAssetsAfter: "30",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice deposit preview
                var depositAssets = parseAssets(test.depositAssets)
                var previewRes = await longToken.connect(alice).previewDeposit(depositAssets)

                // alice deposits
                var depositRes = expect(longToken.connect(alice).deposit(depositAssets, alice.address))

                // assert
                if (test.revertedWith !== void 0) {
                    await depositRes.to.revertedWith(test.revertedWith)
                } else {
                    var mintedShares = parseShares(test.mintedShares)
                    // event
                    await depositRes.to
                        .emit(longToken, "Deposit")
                        .withArgs(alice.address, alice.address, depositAssets, mintedShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(mintedShares)
                    expect(await longToken.balanceOf(alice.address)).to.eq(mintedShares)

                    // asset
                    expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssetsAfter))
                    expect(await weth.balanceOf(alice.address)).to.eq(parseAssets(test.aliceAssetsAfter))

                    // preview <= shares
                    expect(previewRes).to.lte(mintedShares)
                }
            })
        })
    })
})
