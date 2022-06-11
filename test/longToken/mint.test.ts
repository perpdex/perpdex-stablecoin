// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken mint", async () => {
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

    describe("maxMint", async () => {
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
                expected: "0.240999270514668206",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                expect(await longToken.maxMint(alice.address)).to.eq(parseShares(test.expected))
            })
        })
    })

    describe("previewMint", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
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
                mintShares: "100",
                revertedWith: "PE_CMA: market not allowed",
            },
            {
                title: "reverts when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                aliceQuoteAssets: "1000",
                mintShares: "100",
                revertedWith: "PM_PS: too large amount",
            },
            {
                title: "reverts when assets is zero",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                mintShares: "0",
                revertedWith: "PL_SD: output is zero",
            },
            {
                title: "reverts when assets is too large",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                mintShares: "100",
                revertedWith: "PM_PS: too large amount",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "500",
                mintShares: "10",
                depositedAssets: "10.010010010010010011",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice preview mint
                var mintShares = parseShares(test.mintShares)
                var subject = longToken.connect(alice).previewMint(mintShares)

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(subject).to.revertedWith(test.revertedWith)
                } else {
                    expect(await subject).to.eq(parseShares(test.depositedAssets))
                }
            })
        })
    })

    describe("mint", async () => {
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
                mintShares: "100",
                revertedWith: "PM_PS: too large amount", // maxMint == 0
            },
            {
                title: "reverts when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                aliceQuoteAssets: "1000",
                mintShares: "100",
                revertedWith: "PM_PS: too large amount", // maxMint == 0
            },
            {
                title: "reverts when assets is zero",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                mintShares: "0",
                revertedWith: "PL_SD: output is zero",
            },
            {
                title: "reverts when assets is too large",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceQuoteAssets: "1000",
                mintShares: "100",
                revertedWith: "PM_PS: too large amount",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceQuoteAssets: "50",
                mintShares: "20",
                depositedAssets: "20.040080160320641283",
                totalAssetsAfter: "20.080240641603848980",
                aliceAssetsAfter: "29.959919839679358717",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceQuoteAssets))

                // alice mint preview
                var mintShares = parseShares(test.mintShares)
                var previewSubject = longToken.connect(alice).previewMint(mintShares)

                // alice mints
                var mintSubject = longToken.connect(alice).mint(mintShares, alice.address)

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(previewSubject).to.reverted
                    await expect(mintSubject).to.revertedWith(test.revertedWith)
                } else {
                    var depositedAssets = parseAssets(test.depositedAssets)
                    // event
                    expect(await mintSubject)
                        .to.emit(longToken, "Deposit")
                        .withArgs(alice.address, alice.address, depositedAssets, mintShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(mintShares)
                    expect(await longToken.balanceOf(alice.address)).to.eq(mintShares)

                    // asset
                    expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssetsAfter))
                    expect(await weth.balanceOf(alice.address)).to.eq(parseAssets(test.aliceAssetsAfter))

                    // preview >= assets
                    expect(await previewSubject).to.gte(depositedAssets)
                }
            })
        })
    })
})
