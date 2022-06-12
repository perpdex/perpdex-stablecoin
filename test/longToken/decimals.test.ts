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
    let longTokenDecimals: number
    let market: TestPerpdexMarket
    let exchange: TestPerpdexExchange
    let weth: TestERC20
    let wethDecimals: number
    let owner: Wallet
    let alice: Wallet
    let bob: Wallet

    async function before(decimals: number = 18) {
        fixture = await loadFixture(
            createPerpdexExchangeFixture({
                wethDecimals: decimals,
            }),
        )

        longToken = fixture.perpdexLongToken
        longTokenDecimals = await longToken.decimals()
        market = fixture.perpdexMarket
        exchange = fixture.perpdexExchange

        weth = fixture.weth
        wethDecimals = await weth.decimals()

        owner = fixture.owner
        alice = fixture.alice
        bob = fixture.bob

        // alice approve longToken of max assets
        await weth.connect(alice).approve(longToken.address, ethers.constants.MaxUint256)
    }

    // for assets
    function parseAssets(amount: string) {
        return parseUnits(amount, wethDecimals)
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
            depositAssets: parseUnits("100", 6),

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
        },
    ].forEach(test => {
        describe(`assetDecimals == ${test.assetDecimals}\t`, async () => {
            beforeEach(async () => {
                await before(test.assetDecimals)

                await initPool(fixture, parse18(test.pool.base), parse18(test.pool.quote))

                // alice deposit to perpdex
                if (test.depositAssets.gt(0)) {
                    // mint balance
                    await weth.connect(owner).mint(alice.address, test.depositAssets)
                    await longToken.connect(alice).deposit(test.depositAssets, alice.address)
                }

                // change market allowance
                await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
            })

            it("asset", async () => {
                expect(await longToken.asset()).to.eq(await exchange.settlementToken())
            })

            it("totalSupply", async () => {
                expect(await longToken.totalSupply()).to.eq(test.totalSupply.expected)
            })

            it("totalAssets", async () => {
                expect(await longToken.totalAssets()).to.eq(test.totalAssets.expected)
            })

            it("convertToShares", async () => {
                expect(await longToken.convertToShares(test.convertToShares.assets)).to.eq(
                    test.convertToShares.expected,
                )
            })

            it("convertToAssets", async () => {
                expect(await longToken.convertToAssets(test.convertToAssets.shares)).to.eq(
                    test.convertToAssets.expected,
                )
            })

            it("previewDeposit", async () => {
                expect(await longToken.previewDeposit(test.previewDeposit.assets)).to.eq(test.previewDeposit.expected)
            })

            it("previewMint", async () => {
                expect(await longToken.previewMint(test.previewMint.shares)).to.eq(test.previewMint.expected)
            })
        })
    })
})
