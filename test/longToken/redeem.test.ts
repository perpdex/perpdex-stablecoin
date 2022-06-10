// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken redeem", async () => {
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

    describe("maxRedeem", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "returns 0 when market is not allowed",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: false,
                depositAssets: "10",
                expected: "0",
            },
            {
                title: "TODO: returns 0 when pool liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                expected: "0",
            },
            {
                title: "returns owner's shares",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                expected: "9.990009990009990009",
            },
            {
                title: "returns owner's 0 shares",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "0",
                expected: "0",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)

                // alice deposits
                await weth.connect(owner).mint(alice.address, parseAssets(test.depositAssets))

                // deposit only when market is allowed and pool has liquidity
                if (test.isMarkeAllowed && test.pool.base !== "0" && test.depositAssets !== "0") {
                    await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)
                }

                // alice maxRedeem
                expect(await longToken.connect(alice).maxRedeem(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewRedeem", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when market is not allowed",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: false,
                depositAssets: "10",
                redeemShares: "5",
                revertedWith: "PE_CMA: market not allowed",
            },
            {
                title: "reverts when shares is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                redeemShares: "0",
                revertedWith: "", // math error without message
            },
            {
                title: "reverts when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                isMarkeAllowed: true,
                depositAssets: "0",
                redeemShares: "100",
                revertedWith: "PL_SD: output is zero",
            },
            {
                title: "reverts when liquidity is not enought(shares is large)",
                pool: {
                    base: "100",
                    quote: "100",
                },
                isMarkeAllowed: true,
                depositAssets: "1",
                redeemShares: "100",
                revertedWith: "PLL_C: price limit",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                redeemShares: "4.992508740634677667",
                withdrawAssets: "5",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                var depositAssets = parseAssets(test.depositAssets)
                await weth.connect(owner).mint(alice.address, depositAssets)

                // deposit only when pool has liquidity
                if (test.pool.base !== "0" && test.depositAssets !== "0") {
                    await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)
                }

                if (test.isMarkeAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)
                }

                // alice previews redeem
                var subject = longToken.connect(alice).previewRedeem(parseShares(test.redeemShares))

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(subject).to.revertedWith(test.revertedWith)
                } else {
                    expect(await subject).to.eq(parseAssets(test.withdrawAssets))
                }
            })
        })
    })

    describe("redeem", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when market is not allowed",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: false,
                depositAssets: "10",
                removeLiquidity: 0,
                redeemShares: "5",
                revertedWith: "PLT_R: redeem more than max", // maxRedeem is zero
            },
            {
                title: "reverts when shares is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                redeemShares: "0",
                revertedWith: "PLT_R: redeem is zero",
            },
            {
                title: "reverts when shares is more than max",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                redeemShares: "100",
                revertedWith: "PLT_R: redeem more than max",
            },
            {
                title: "succeeds",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                redeemShares: "4.992508740634677667",
                withdrawAssets: "5",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                var depositAssets = parseAssets(test.depositAssets)
                await weth.connect(owner).mint(alice.address, depositAssets)

                // deposit only when pool has liquidity
                if (test.pool.base !== "0" && test.depositAssets !== "0") {
                    await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)
                }

                if (test.isMarkeAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)
                }

                // owner remove liquidity
                if (test.removeLiquidity > 0) {
                    await exchange.connect(owner).removeLiquidity({
                        trader: owner.address,
                        market: market.address,
                        liquidity: test.removeLiquidity,
                        minBase: 0,
                        minQuote: 0,
                        deadline: ethers.constants.MaxUint256,
                    })
                }

                // alice redeem
                var assetsBefore = await weth.balanceOf(alice.address)
                var sharesBefore = await longToken.balanceOf(alice.address)
                var totalAssetsBefore = await longToken.totalAssets()
                var totalSharesBefore = await longToken.totalSupply()

                var redeemShares = parseShares(test.redeemShares)
                var previewSubject = longToken.connect(alice).previewRedeem(redeemShares)
                var redeemSubject = longToken.connect(alice).redeem(redeemShares, alice.address, alice.address)

                // assert
                if (test.revertedWith !== void 0) {
                    await expect(redeemSubject).to.revertedWith(test.revertedWith)
                } else {
                    var withdrawAssets = parseAssets(test.withdrawAssets)

                    // event
                    expect(await redeemSubject)
                        .to.emit(longToken, "Withdraw")
                        .withArgs(alice.address, alice.address, alice.address, withdrawAssets, redeemShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(totalSharesBefore.sub(redeemShares))
                    expect(await longToken.balanceOf(alice.address)).to.eq(sharesBefore.sub(redeemShares))

                    // asset
                    expect(await longToken.totalAssets()).to.lt(totalAssetsBefore)
                    expect(await weth.balanceOf(alice.address)).to.eq(assetsBefore.add(withdrawAssets))

                    // preview <= assets
                    expect(await previewSubject).to.lte(withdrawAssets)
                }
            })
        })
    })
})
