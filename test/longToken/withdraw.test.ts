// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract } from "@defi-wonderland/smock"
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken withdraw", async () => {
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

    describe("maxWithdraw", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "return owner's assets when pool has some liquidity",
                pool: {
                    base: "100",
                    quote: "100",
                },
                depositAssets: "1",
                expected: "1.009999999999999999",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                await weth.connect(owner).mint(alice.address, parseAssets(test.depositAssets))
                await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)

                expect(await longToken.maxWithdraw(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewDeposit", async () => {
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
                title: "returns 0 when withdraw is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "0",
                burnedShares: "0",
            },
            {
                title: "returns ideal shares even if alice does not have enough assets",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "5",
                removeLiquidity: 0,
                withdrawAssets: "10",
                burnedShares: "10.000002500000625001",
            },
            {
                title: "returns ideal shares when alice has enough assets",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "5",
                burnedShares: "4.992508740634677667",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                var depositAssets = parseAssets(test.depositAssets)
                await weth.connect(owner).mint(alice.address, depositAssets)
                await longToken.connect(alice).deposit(depositAssets, alice.address)

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

                // alice withdraws
                expect(await longToken.connect(alice).previewWithdraw(parseAssets(test.withdrawAssets))).to.eq(
                    parseShares(test.burnedShares),
                )
            })
        })
    })

    describe("withdraw", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, alice.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
            await weth.approveForce(exchange.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when withdraw is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "0",
                revertedWith: "PLT_W: withdraw is zero",
            },
            {
                title: "reverts when withdraw assets is more than max",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "20",
                revertedWith: "PLT_W: withdraw more than max",
            },
            // TODO: overflow occurred when removing liquidity
            // {
            //     title: "reverts when pool does not have enough liquidity",
            //     pool: {
            //         base: "100",
            //         quote: "100",
            //     },
            //     depositAssets: "1",
            //     removeLiquidity: 100000,
            //     withdrawAssets: "0.5",
            //     revertedWith: "TL_OP: normal order price limit",
            // },
            {
                title: "success",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "5",
                burnedShares: "4.992508740634677667",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                var depositAssets = parseAssets(test.depositAssets)
                await weth.connect(owner).mint(alice.address, depositAssets)
                await longToken.connect(alice).deposit(depositAssets, alice.address)

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

                // alice withdraw
                var assetsBefore = await weth.balanceOf(alice.address)
                var sharesBefore = await longToken.balanceOf(alice.address)
                var totalSharesBefore = await longToken.totalSupply()
                var withdrawAssets = parseAssets(test.withdrawAssets)
                var withdrawRes = expect(
                    longToken.connect(alice).withdraw(withdrawAssets, alice.address, alice.address),
                )

                // assert
                if (test.revertedWith !== void 0) {
                    await withdrawRes.to.revertedWith(test.revertedWith)
                } else {
                    var burnedShares = parseShares(test.burnedShares)
                    // event
                    await withdrawRes.to
                        .emit(longToken, "Withdraw")
                        .withArgs(alice.address, alice.address, alice.address, withdrawAssets, burnedShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(totalSharesBefore.sub(burnedShares))
                    expect(await longToken.balanceOf(alice.address)).to.eq(sharesBefore.sub(burnedShares))

                    // asset
                    expect(await weth.balanceOf(alice.address)).to.eq(assetsBefore.add(withdrawAssets))
                }
            })
        })
    })
})
