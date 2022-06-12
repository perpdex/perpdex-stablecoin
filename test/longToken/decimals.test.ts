// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { BigNumber, Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken base decimals", async () => {
    let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
    let fixture

    let longToken: PerpdexLongToken
    let market: TestPerpdexMarket
    let exchange: TestPerpdexExchange
    let weth: TestERC20
    let owner: Wallet
    let alice: Wallet
    let bob: Wallet

    function toWallet(who: string) {
        if (who === "alice") {
            return alice
        }
        if (who === "bob") {
            return bob
        }
    }

    async function setupEnvironment(assetDecimals: number, quoteDecimals: number, poolBase: string, poolQuote: string) {
        fixture = await loadFixture(
            createPerpdexExchangeFixture({
                wethDecimals: assetDecimals,
            }),
        )

        longToken = fixture.perpdexLongToken
        market = fixture.perpdexMarket
        exchange = fixture.perpdexExchange

        weth = fixture.weth

        owner = fixture.owner
        alice = fixture.alice
        bob = fixture.bob

        // alice approve longToken of max assets
        await weth.connect(alice).approve(longToken.address, ethers.constants.MaxUint256)

        // init pool
        await initPool(fixture, parseUnits(poolBase, quoteDecimals), parseUnits(poolQuote, quoteDecimals))
    }

    ;[
        {
            assetDecimals: 6,
            quoteDecimals: 18,
            pool: {
                base: "10000",
                quote: "10000",
            },
            isMarketAllowed: true,

            deposit: {
                assets: parseUnits("100", 6),
                receiver: "alice",
                expects: {
                    balanceOf: {
                        owner: "alice",
                    },

                    totalSupply: {},
                    totalAssets: {},

                    convertToShares: {
                        assets: parseUnits("50", 6),
                    },

                    convertToAssets: {
                        shares: parseUnits("50", 18),
                    },

                    previewDeposit: {
                        assets: parseUnits("50", 6),
                    },

                    previewMint: {
                        shares: parseUnits("48.773350241428083695", 18),
                    },

                    previewWithdraw: {
                        assets: parseUnits("50", 6),
                    },

                    previewRedeem: {
                        shares: parseUnits("49.258657209004482538", 18),
                    },

                    maxDeposit: {
                        expected: parseUnits("238.613139", 6),
                    },

                    maxMint: {
                        expected: parseUnits("249.420273619194367053", 18),
                    },

                    maxWithdraw: {
                        expected: parseUnits("257.211406", 6),
                    },

                    maxRedeem: {
                        expected: parseUnits("99.009900990099009900", 18),
                    },
                },
            },
        },
    ].forEach(test => {
        describe(`assetDecimals == ${test.assetDecimals}\t`, async () => {
            beforeEach(async () => {
                await setupEnvironment(test.assetDecimals, test.quoteDecimals, test.pool.base, test.pool.quote)
            })

            async function doDeposit() {
                // alice deposit to perpdex
                if (test.deposit !== void 0 && test.deposit.assets.gt(0)) {
                    // mint balance
                    await weth.connect(owner).mint(alice.address, test.deposit.assets)

                    // deposit
                    var receiver = toWallet(test.deposit.receiver)
                    await longToken.connect(alice).deposit(test.deposit.assets, receiver.address)
                }

                // change market allowance
                await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
            }

            function toNumber(x: BigNumber, decimals: number) {
                return x.div(BigNumber.from(10).pow(decimals)).toNumber()
            }

            it("balanceOf", async () => {
                await doDeposit()
                var balanceOfOwner = toWallet(test.deposit.expects.balanceOf.owner)
                var refNum = toNumber(test.deposit.assets, test.assetDecimals)
                var num = toNumber(await longToken.balanceOf(balanceOfOwner.address), test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("totalSupply", async () => {
                await doDeposit()
                var refNum = toNumber(test.deposit.assets, test.assetDecimals)
                var num = toNumber(await longToken.totalSupply(), test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("totalAssets", async () => {
                await doDeposit()
                var refNum = toNumber(test.deposit.assets, test.assetDecimals)
                var num = toNumber(await longToken.totalAssets(), test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("convertToShares", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.convertToShares.assets
                var val = await longToken.convertToShares(refVal)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("convertToAssets", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.convertToAssets.shares
                var val = await longToken.convertToAssets(refVal)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewDeposit", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.previewDeposit.assets
                var val = await longToken.previewDeposit(refVal)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewMint", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.previewMint.shares
                var val = await longToken.previewMint(refVal)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewWithdraw", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.previewWithdraw.assets
                var val = await longToken.previewWithdraw(refVal)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewRedeem", async () => {
                await doDeposit()
                var refVal = test.deposit.expects.previewRedeem.shares
                var val = await longToken.previewRedeem(refVal)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("maxDeposit", async () => {
                await doDeposit()
                var poolInfo = await market.poolInfo()
                var [refBaseVal, _] = await market.getLiquidityValue(poolInfo.totalLiquidity)
                var val = await longToken.maxDeposit(alice.address)

                var refNum = toNumber(refBaseVal, test.quoteDecimals)
                var num = toNumber(val, test.assetDecimals)

                expect(num).to.within(refNum * 0.01, refNum * 0.05)
            })

            it("maxMint", async () => {
                await doDeposit()
                var poolInfo = await market.poolInfo()
                var [_, refQuoteVal] = await market.getLiquidityValue(poolInfo.totalLiquidity)
                var val = await longToken.maxMint(alice.address)

                var refNum = toNumber(refQuoteVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)

                expect(num).to.within(refNum * 0.01, refNum * 0.05)
            })

            it("maxWithdraw", async () => {
                await doDeposit()
                var refVal = await longToken.totalAssets()
                var val = await longToken.maxWithdraw(alice.address)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.assetDecimals)

                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("maxRedeem", async () => {
                await doDeposit()
                var refVal = await longToken.totalSupply()
                var val = await longToken.maxRedeem(alice.address)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)

                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })
        })
    })
})
