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
                isMarketAllowed: false,
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
                expected: "0.246950765959598383",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                expect(await longToken.maxDeposit(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewDeposit", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when market is not allowed",
                pool: {
                    base: "10",
                    quote: "10",
                },
                isMarketAllowed: false,
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PE_CMA: market not allowed",
            },
            {
                title: "reverts when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PM_PS: too large amount",
            },
            {
                title: "reverts when assets is zero",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "0",
                revertedWith: "PL_SD: output is zero",
            },
            {
                title: "reverts when assets is too large",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PM_PS: too large amount",
            },
            {
                title: "succeeds",
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
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice deposit preview
                var depositAssets = parseAssets(test.depositAssets)
                var subject = longToken.connect(alice).previewDeposit(depositAssets)

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(subject).to.revertedWith(test.revertedWith)
                } else {
                    expect(await subject).to.eq(parseShares(test.mintedShares))
                }
            })
        })
    })

    describe("deposit", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when market is not allowed",
                pool: {
                    base: "10",
                    quote: "10",
                },
                isMarketAllowed: false,
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PE_CMA: market not allowed",
            },
            {
                title: "reverts when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PM_S: too large amount", // maxDeposit == 0
            },
            {
                title: "reverts when assets is zero",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "0",
                revertedWith: "VL_D: zero amount",
            },
            {
                title: "reverts when assets is too large",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                depositAssets: "100",
                revertedWith: "PM_S: too large amount",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "500",
                depositAssets: "10",
                mintedShares: "9.990009990009990009",
                totalAssetsAfter: "10.009999999999999999", // price impact
                aliceAssetsAfter: "490.000000000000000000",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice deposit preview
                var depositAssets = parseAssets(test.depositAssets)
                var previewSubject = longToken.connect(alice).previewDeposit(depositAssets)

                // alice deposits
                var depositSubject = longToken.connect(alice).deposit(depositAssets, alice.address)

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(previewSubject).to.be.reverted
                    await expect(depositSubject).to.revertedWith(test.revertedWith)
                } else {
                    var mintedShares = parseShares(test.mintedShares)
                    // event
                    expect(await depositSubject)
                        .to.emit(longToken, "Deposit")
                        .withArgs(alice.address, alice.address, depositAssets, mintedShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(mintedShares)
                    expect(await longToken.balanceOf(alice.address)).to.eq(mintedShares)

                    // asset
                    expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssetsAfter))
                    expect(await weth.balanceOf(alice.address)).to.eq(parseAssets(test.aliceAssetsAfter))

                    // preview <= shares
                    expect(await previewSubject).to.lte(mintedShares)
                }
            })
        })
    })
})
