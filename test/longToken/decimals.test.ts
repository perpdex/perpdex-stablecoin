// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { Wallet } from "ethers"
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

    async function before(decimals: number = 18) {
        fixture = await loadFixture(
            createPerpdexExchangeFixture({
                wethDecimals: decimals,
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
    }

    // for shares, perpdex base and quote
    function parse18(amount: string) {
        return parseUnits(amount, 18)
    }

    ;[
        {
            assetDecimals: 6,
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
                        expected: parseUnits("99.009900990099009900", 18),
                    },

                    totalSupply: {
                        expected: parseUnits("99.009900990099009900", 18),
                    },

                    totalAssets: {
                        expected: parseUnits("100.999999", 6),
                    },

                    convertToShares: {
                        assets: parseUnits("50", 6),
                        expected: parseUnits("49.014802955641123273", 18),
                    },

                    convertToAssets: {
                        shares: parseUnits("50", 18),
                        expected: parseUnits("51.004999", 6),
                    },

                    previewDeposit: {
                        assets: parseUnits("50", 6),
                        expected: parseUnits("48.773350241428083695", 18),
                    },

                    previewMint: {
                        shares: parseUnits("48.773350241428083695", 18),
                        expected: parseUnits("50", 6),
                    },

                    previewWithdraw: {
                        assets: parseUnits("50", 6),
                        expected: parseUnits("49.258657209004482538", 18),
                    },

                    previewRedeem: {
                        shares: parseUnits("49.258657209004482538", 18),
                        expected: parseUnits("50", 6),
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
                await before(test.assetDecimals)

                await initPool(fixture, parse18(test.pool.base), parse18(test.pool.quote))

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
            })

            it("asset", async () => {
                expect(await longToken.asset()).to.eq(await exchange.settlementToken())
            })

            it("balanceOf", async () => {
                var owner_ = toWallet(test.balanceOf.owner)
                expect(await longToken.balanceOf(owner_.address)).to.eq(test.balanceOf.expected)
            })

            it("totalSupply", async () => {
                expect(await longToken.totalSupply()).to.eq(test.deposit.expects.totalSupply.expected)
            })

            it("totalAssets", async () => {
                expect(await longToken.totalAssets()).to.eq(test.deposit.expects.totalAssets.expected)
            })

            it("convertToShares", async () => {
                expect(await longToken.convertToShares(test.deposit.expects.convertToShares.assets)).to.eq(
                    test.deposit.expects.convertToShares.expected,
                )
            })

            it("convertToAssets", async () => {
                expect(await longToken.convertToAssets(test.deposit.expects.convertToAssets.shares)).to.eq(
                    test.deposit.expects.convertToAssets.expected,
                )
            })

            it("previewDeposit", async () => {
                expect(await longToken.previewDeposit(test.deposit.expects.previewDeposit.assets)).to.eq(
                    test.deposit.expects.previewDeposit.expected,
                )
            })

            it("previewMint", async () => {
                expect(await longToken.previewMint(test.deposit.expects.previewMint.shares)).to.eq(
                    test.deposit.expects.previewMint.expected,
                )
            })

            it("previewWithdraw", async () => {
                expect(await longToken.previewWithdraw(test.deposit.expects.previewWithdraw.assets)).to.eq(
                    test.deposit.expects.previewWithdraw.expected,
                )
            })

            it("previewRedeem", async () => {
                expect(await longToken.previewRedeem(test.deposit.expects.previewRedeem.shares)).to.eq(
                    test.deposit.expects.previewRedeem.expected,
                )
            })

            it("maxDeposit", async () => {
                expect(await longToken.maxDeposit(alice.address)).to.eq(test.deposit.expects.maxDeposit.expected)
            })

            it("maxMint", async () => {
                expect(await longToken.maxMint(alice.address)).to.eq(test.deposit.expects.maxMint.expected)
            })

            it("maxWithdraw", async () => {
                expect(await longToken.maxWithdraw(alice.address)).to.eq(test.deposit.expects.maxWithdraw.expected)
            })

            it("maxRedeem", async () => {
                expect(await longToken.maxRedeem(alice.address)).to.eq(test.deposit.expects.maxRedeem.expected)
            })
        })
    })
})
