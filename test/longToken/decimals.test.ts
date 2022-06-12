// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { BigNumber, Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken decimals", async () => {
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

    async function setupEnvironment(
        settlementToken: string,
        assetDecimals: number,
        quoteDecimals: number,
        poolBase: string,
        poolQuote: string,
    ) {
        fixture = await loadFixture(
            createPerpdexExchangeFixture({
                settlementToken: settlementToken,
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

    // alice deposit to perpdex by wETH
    async function depositByWeth(test, deposit) {
        // mint balance
        await weth.connect(owner).mint(alice.address, deposit.assets)

        // deposit
        var receiver = toWallet(deposit.receiver)
        await longToken.connect(alice).deposit(deposit.assets, receiver.address)

        // change market allowance
        await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
    }

    // alice deposit to perpdex
    async function depositByETH(test, deposit) {
        // deposit
        var receiver = toWallet(deposit.receiver)
        await longToken.connect(alice).depositETH(receiver.address, { value: deposit.assets })

        // change market allowance
        await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
    }

    function toNumber(x: BigNumber, decimals: number) {
        return x.div(BigNumber.from(10).pow(decimals)).toNumber()
    }

    ;[
        /*
        {
            settlementToken: "weth",
            assetDecimals: 6,
            quoteDecimals: 18,
            pool: {
                base: "10000",
                quote: "40000",
            },
            isMarketAllowed: true,

            deposit: {
                depositFunc: depositByWeth,
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
        */
        {
            settlementToken: "ETH",
            assetDecimals: 18,
            quoteDecimals: 18,
            pool: {
                base: "10000",
                quote: "40000",
            },
            isMarketAllowed: true,

            deposit: {
                depositFunc: depositByETH,
                assets: parseUnits("100", 18),
                receiver: "alice",
                expects: {
                    balanceOf: {
                        owner: "alice",
                    },

                    totalSupply: {},
                    totalAssets: {},

                    convertToShares: {
                        assets: parseUnits("50", 18),
                    },

                    convertToAssets: {
                        shares: parseUnits("50", 18),
                    },

                    previewDeposit: {
                        assets: parseUnits("50", 18),
                    },

                    previewMint: {
                        shares: parseUnits("49", 18),
                    },

                    previewWithdraw: {
                        assets: parseUnits("50", 18),
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
        describe(`assetDecimals == ${test.assetDecimals}\t`, async () => {
            beforeEach(async () => {
                await setupEnvironment(
                    test.settlementToken,
                    test.assetDecimals,
                    test.quoteDecimals,
                    test.pool.base,
                    test.pool.quote,
                )
            })

            it("balanceOf", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var balanceOfOwner = toWallet(test.deposit.expects.balanceOf.owner)

                var refVal = await longToken.convertToShares(test.deposit.assets)
                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(await longToken.balanceOf(balanceOfOwner.address), test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("totalSupply", async () => {
                await test.deposit.depositFunc(test, test.deposit)

                var refVal = await longToken.convertToShares(test.deposit.assets)
                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(await longToken.totalSupply(), test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("totalAssets", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var refNum = toNumber(test.deposit.assets, test.assetDecimals)
                var num = toNumber(await longToken.totalAssets(), test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            /*
            it("convertToShares", async () => {
                var markSharePriceEst = Number(test.pool.base) / Number(test.pool.quote)

                var argVal = test.deposit.expects.convertToShares.assets
                // quote -> base
                var refNum = toNumber(argVal, test.assetDecimals) * markSharePriceEst

                // total supply == 0
                var val = await longToken.convertToShares(argVal)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)

                await test.deposit.depositFunc(test, test.deposit)

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
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)

                await test.deposit.depositFunc(test, test.deposit)

                // total supply > 0
                var val = await longToken.convertToAssets(argVal)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewDeposit", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var argVal = test.deposit.expects.previewDeposit.assets
                var refVal = await longToken.convertToShares(argVal)
                var val = await longToken.previewDeposit(argVal)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewMint", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var argVal = test.deposit.expects.previewMint.shares
                var refVal = await longToken.convertToAssets(argVal)
                var val = await longToken.previewMint(argVal)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewWithdraw", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var argVal = test.deposit.expects.previewWithdraw.assets
                var refVal = await longToken.convertToShares(argVal)
                var val = await longToken.previewWithdraw(argVal)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("previewRedeem", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var argVal = test.deposit.expects.previewRedeem.shares
                var refVal = await longToken.convertToAssets(argVal)
                var val = await longToken.previewRedeem(argVal)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.assetDecimals)
                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("maxDeposit", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var poolInfo = await market.poolInfo()
                var [refBaseVal, _] = await market.getLiquidityValue(poolInfo.totalLiquidity)
                var val = await longToken.maxDeposit(alice.address)

                var refNum = toNumber(refBaseVal, test.quoteDecimals) // pool base decimals == pool quote decimals
                var num = toNumber(val, test.assetDecimals)

                expect(num).to.within(refNum * 0.01, refNum * 0.05)
            })

            it("maxMint", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var poolInfo = await market.poolInfo()
                var [_, refQuoteVal] = await market.getLiquidityValue(poolInfo.totalLiquidity)
                var val = await longToken.maxMint(alice.address)

                var refNum = toNumber(refQuoteVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)

                expect(num).to.within(refNum * 0.01, refNum * 0.05)
            })

            it("maxWithdraw", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var refVal = await longToken.totalAssets()
                var val = await longToken.maxWithdraw(alice.address)

                var refNum = toNumber(refVal, test.assetDecimals)
                var num = toNumber(val, test.assetDecimals)

                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })

            it("maxRedeem", async () => {
                await test.deposit.depositFunc(test, test.deposit)
                var refVal = await longToken.totalSupply()
                var val = await longToken.maxRedeem(alice.address)

                var refNum = toNumber(refVal, test.quoteDecimals)
                var num = toNumber(val, test.quoteDecimals)

                expect(num).to.within(refNum * 0.95, refNum * 1.05)
            })
            */
        })
    })
})
