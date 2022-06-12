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

    beforeEach(async () => {
        fixture = await loadFixture(
            createPerpdexExchangeFixture({
                wethDecimals: 6,
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
    })

    // for assets
    function parseAssets(amount: string) {
        return parseUnits(amount, wethDecimals)
    }

    // for shares, perpdex base and quote
    function parse18(amount: string) {
        return parseUnits(amount, 18)
    }

    it("asset", async () => {
        expect(await longToken.asset()).to.eq(await exchange.settlementToken())
    })

    describe("totalAssets", async () => {
        ;[
            {
                title: "no balance",
                balance: "0",
                totalAssets: "0",
            },
            {
                title: "balance 10 WETH",
                balance: "10",
                totalAssets: "10",
            },
            {
                title: "balance -10 WETH",
                balance: "-10",
                totalAssets: "0",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // force contract balance to be deposit
                await exchange.setAccountInfo(
                    longToken.address,
                    {
                        collateralBalance: parseAssets(test.balance),
                    },
                    [],
                )
                expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssets))
            })
        })
    })

    describe("convertToShares", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "totalSupply == 0",
                pool: {
                    base: "0",
                    quote: "0",
                },
                depositAssets: "0",
                convertAssets: "5",
                expected: "5",
            },
            {
                title: "totalSupply != 0",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "100",
                convertAssets: "50",
                expected: "49.014802470346044505",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(fixture, parse18(test.pool.base), parse18(test.pool.quote))

                // alice deposits
                var depositAssets = parseAssets(test.depositAssets)
                if (depositAssets.gt(0)) {
                    await weth.connect(owner).mint(alice.address, depositAssets)
                    await longToken.connect(alice).deposit(depositAssets, alice.address)
                }
                console.log((await longToken.totalAssets()).toString())
                console.log((await longToken.totalSupply()).toString())

                expect(await longToken.convertToShares(parseAssets(test.convertAssets))).to.eq(parse18(test.expected))
            })
        })
    })

    describe("convertToAssets", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "totalSupply == 0",
                pool: {
                    base: "0",
                    quote: "0",
                },
                depositAssets: "0",
                convertShares: "5",
                expected: "5",
            },
            {
                title: "totalSupply != 0",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "100",
                convertShares: "49.014802470346044505",
                expected: "49.999999999999999999",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.quote))

                // alice deposits
                var depositAssets = parseAssets(test.depositAssets)
                if (depositAssets.gt(0)) {
                    await weth.connect(owner).mint(alice.address, depositAssets)
                    await longToken.connect(alice).deposit(depositAssets, alice.address)
                }

                expect(await longToken.convertToAssets(parseShares(test.convertShares))).to.eq(
                    parseAssets(test.expected),
                )
            })
        })
    })
})
