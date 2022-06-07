// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract } from "@defi-wonderland/smock"
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
    let longTokenMock: MockContract<PerpdexLongToken>
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
        longTokenMock = fixture.perpdexLongTokenMock
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
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "return owner's shares",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                expected: "9.990009990009990009",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                await weth.connect(owner).mint(alice.address, parseAssets(test.depositAssets))
                await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)

                // alice maxRedeem
                expect(await longToken.maxRedeem(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewRedeem", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
            await weth.approveForce(exchange.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "returns 0 when redeem is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                redeemShares: "0",
                withdrawAssets: "0",
            },
            {
                title: "returns ideal shares",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
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
                await longToken.connect(alice).deposit(depositAssets, alice.address)

                // alice withdraws
                expect(await longToken.connect(alice).previewRedeem(parseShares(test.redeemShares))).to.eq(
                    parseAssets(test.withdrawAssets),
                )
            })
        })
    })
})
