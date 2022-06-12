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
            title: "unbalanced pool base quote tests",
            assetDecimalsList: [6, 18],
            quoteDecimals: 18,
            pool: {
                base: "10000",
                quote: "40000",
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
                        shares: parseUnits("49", 18),
                    },

                    previewWithdraw: {
                        assets: parseUnits("50", 6),
                    },

                    previewRedeem: {
                        shares: parseUnits("49", 18),
                    },

                    maxDeposit: {},

                    maxMint: {},

                    maxWithdraw: {},

                    maxRedeem: {},
                },
            },
        },
    ].forEach(test => {
        describe(test.title, async () => {
            test.assetDecimalsList.forEach(assetDecimals => {
                describe(`assetDecimals == ${assetDecimals}\t`, async () => {
                    beforeEach(async () => {
                        await setupEnvironment(assetDecimals, test.quoteDecimals, test.pool.base, test.pool.quote)
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

                        var refVal = await longToken.convertToShares(test.deposit.assets)
                        var refNum = toNumber(refVal, test.quoteDecimals)
                        var num = toNumber(await longToken.balanceOf(balanceOfOwner.address), test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("totalSupply", async () => {
                        await doDeposit()

                        var refVal = await longToken.convertToShares(test.deposit.assets)
                        var refNum = toNumber(refVal, test.quoteDecimals)
                        var num = toNumber(await longToken.totalSupply(), test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("totalAssets", async () => {
                        await doDeposit()
                        var refNum = toNumber(test.deposit.assets, assetDecimals)
                        var num = toNumber(await longToken.totalAssets(), assetDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("convertToShares", async () => {
                        var markSharePriceEst = Number(test.pool.base) / Number(test.pool.quote)

                        var argVal = test.deposit.expects.convertToShares.assets
                        // quote -> base
                        var refNum = toNumber(argVal, assetDecimals) * markSharePriceEst

                        // total supply == 0
                        var val = await longToken.convertToShares(argVal)
                        var num = toNumber(val, test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)

                        await doDeposit()

                        // total supply > 0
                        var val = await longToken.convertToShares(argVal)
                        var num = toNumber(val, test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("convertToAssets", async () => {
                        var markPriceEst = Number(test.pool.quote) / Number(test.pool.base)

                        var argVal = test.deposit.expects.convertToAssets.shares
                        // base -> quote
                        var refNum = toNumber(argVal, test.quoteDecimals) * markPriceEst

                        // total supply == 0
                        var val = await longToken.convertToAssets(argVal)
                        var num = toNumber(val, assetDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)

                        await doDeposit()

                        // total supply > 0
                        var val = await longToken.convertToAssets(argVal)
                        var num = toNumber(val, assetDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("previewDeposit", async () => {
                        await doDeposit()
                        var argVal = test.deposit.expects.previewDeposit.assets
                        var refVal = await longToken.convertToShares(argVal)
                        var val = await longToken.previewDeposit(argVal)

                        var refNum = toNumber(refVal, test.quoteDecimals)
                        var num = toNumber(val, test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("previewMint", async () => {
                        await doDeposit()
                        var argVal = test.deposit.expects.previewMint.shares
                        var refVal = await longToken.convertToAssets(argVal)
                        var val = await longToken.previewMint(argVal)

                        var refNum = toNumber(refVal, assetDecimals)
                        var num = toNumber(val, assetDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("previewWithdraw", async () => {
                        await doDeposit()
                        var argVal = test.deposit.expects.previewWithdraw.assets
                        var refVal = await longToken.convertToShares(argVal)
                        var val = await longToken.previewWithdraw(argVal)

                        var refNum = toNumber(refVal, test.quoteDecimals)
                        var num = toNumber(val, test.quoteDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("previewRedeem", async () => {
                        await doDeposit()
                        var argVal = test.deposit.expects.previewRedeem.shares
                        var refVal = await longToken.convertToAssets(argVal)
                        var val = await longToken.previewRedeem(argVal)

                        var refNum = toNumber(refVal, assetDecimals)
                        var num = toNumber(val, assetDecimals)
                        expect(num).to.within(refNum * 0.95, refNum * 1.05)
                    })

                    it("maxDeposit", async () => {
                        await doDeposit()
                        var poolInfo = await market.poolInfo()
                        var [refBaseVal, _] = await market.getLiquidityValue(poolInfo.totalLiquidity)
                        var val = await longToken.maxDeposit(alice.address)

                        var refNum = toNumber(refBaseVal, test.quoteDecimals) // pool base decimals == pool quote decimals
                        var num = toNumber(val, assetDecimals)

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

                        var refNum = toNumber(refVal, assetDecimals)
                        var num = toNumber(val, assetDecimals)

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
    })
})
