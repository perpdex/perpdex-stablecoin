// SPDX-License-Identifier: GPL-3.0-or-later
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

    describe("maxWithdraw", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
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
                removeLiquidity: 0,
                expected: "0",
            },
            {
                title: "returns 0 when liquidity is zero",
                pool: {
                    base: "0",
                    quote: "0",
                },
                isMarkeAllowed: true,
                depositAssets: "0",
                expected: "0", // math error without message
            },
            {
                title: "success case",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                expected: "10.009999999999999999",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice deposits
                await weth.connect(owner).mint(alice.address, parseAssets(test.depositAssets))

                if (test.pool.base !== "0" && test.depositAssets !== "0") {
                    await longToken.connect(alice).deposit(parseAssets(test.depositAssets), alice.address)
                }

                await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)

                expect(await longToken.maxWithdraw(alice.address)).to.eq(parseAssets(test.expected))
            })
        })
    })

    describe("previewWithdraw and withdraw", async () => {
        beforeEach(async () => {
            // alice approve longToken of max assets
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "when market is not allowed",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: false,
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "5",
                revertedWithPreview: "PE_CMA: market not allowed",
                revertedWith: "PLT_W: withdraw more than max", // maxWithdraw == 0
            },
            {
                title: "when assets is zero",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "0",
                revertedWithPreview: "PL_SD: output is zero",
                revertedWith: "PLT_W: withdraw is zero",
            },
            {
                title: "when assets is more than max",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "20",
                revertedWith: "PLT_W: withdraw more than max",
                burnedSharesPreview: "20.000020000020000021",
            },
            {
                title: "success case",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                isMarkeAllowed: true,
                depositAssets: "10",
                removeLiquidity: 0,
                withdrawAssets: "9.9",
                burnedShares: "9.890010989999990110",
                burnedSharesPreview: "9.890010989999990110",
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
                var totalAssetsBefore = await longToken.totalAssets()
                var totalSharesBefore = await longToken.totalSupply()

                if (test.isMarkeAllowed !== void 0) {
                    await exchange.connect(owner).setIsMarketAllowed(market.address, test.isMarkeAllowed)
                }

                var withdrawAssets = parseAssets(test.withdrawAssets)
                var previewSubject = longToken.connect(alice).previewWithdraw(withdrawAssets)
                var withdrawSubject = longToken.connect(alice).withdraw(withdrawAssets, alice.address, alice.address)

                // assert withdraw
                if (test.revertedWith !== void 0) {
                    // preview
                    if (test.revertedWithPreview !== void 0) {
                        await expect(previewSubject).to.revertedWith(test.revertedWithPreview)
                    } else {
                        expect(await previewSubject).to.equal(parseShares(test.burnedSharesPreview))
                    }

                    await expect(withdrawSubject).to.revertedWith(test.revertedWith)
                } else {
                    var burnedShares = parseShares(test.burnedShares)
                    // event
                    expect(await withdrawSubject)
                        .to.emit(longToken, "Withdraw")
                        .withArgs(alice.address, alice.address, alice.address, withdrawAssets, burnedShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(totalSharesBefore.sub(burnedShares))
                    expect(await longToken.balanceOf(alice.address)).to.eq(sharesBefore.sub(burnedShares))

                    // asset
                    expect(await longToken.totalAssets()).to.lt(totalAssetsBefore)
                    expect(await weth.balanceOf(alice.address)).to.eq(assetsBefore.add(withdrawAssets))

                    // preview >= burned
                    expect(await previewSubject).to.eq(parseShares(test.burnedSharesPreview))
                }
            })
        })
    })
})
