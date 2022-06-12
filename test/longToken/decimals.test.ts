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

    it("asset", async () => {
        await before(18)
        expect(await longToken.asset()).to.eq(await exchange.settlementToken())
    })

    describe("decimals scenario tests", async () => {
        ;[
            {
                assetDecimals: 6,
                title: "account value is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarketAllowed: true,
                depositAssets: parseUnits("0", 6),

                // args
                convertToSharesAssets: 0,

                // expected value
                expectedTotalAssets: 0,
                expectedConvertToShares: 0,
            },
            {
                assetDecimals: 6,
                title: "account value > 0",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarketAllowed: true,
                depositAssets: parseUnits("100", 6),

                // args
                convertToSharesAssets: parseUnits("50", 6),

                // expected value
                expectedTotalAssets: parseUnits("100.999999", 6),
                expectedConvertToShares: parseUnits("49.014802955641123273", 18),
            },
        ].forEach(test => {
            it(`(assetDecimals == ${test.assetDecimals})\t` + test.title, async () => {
                await before(test.assetDecimals)

                await initPool(fixture, parse18(test.pool.base), parse18(test.pool.quote))

                // alice deposit to perpdex
                if (test.depositAssets.gt(0)) {
                    // mint balance
                    await weth.connect(owner).mint(alice.address, test.depositAssets)
                    await longToken.connect(alice).deposit(test.depositAssets, alice.address)
                }

                if (test.isMarketAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarketAllowed)
                }

                expect(await longToken.totalAssets()).to.eq(test.expectedTotalAssets)
                expect(await longToken.convertToShares(test.convertToSharesAssets)).to.eq(test.expectedConvertToShares)
            })
        })
    })
})
