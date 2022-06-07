// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract } from "@defi-wonderland/smock"
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken deposit", async () => {
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

    describe("maxDeposit", async () => {
        ;[
            // {
            //   title: "TODO: returns 0 when pool liquidity is zero",
            //   pool: {
            //     base: "0",
            //     quote: "0",
            //   },
            //   expected: "0",
            // },
            {
                title: "returns max int",
                pool: {
                    base: "10",
                    quote: "10",
                },
                expected: ethers.constants.MaxInt256,
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                expect(await longToken.maxDeposit(alice.address)).to.eq(test.expected)
            })
        })
    })

    describe("previewDeposit", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            // {
            //   title: "TODO: returns 0 if market disabled",
            //   pool: {
            //     base: "10",
            //     quote: "10",
            //   },
            //   aliceAssetsBefore: "1000",
            //   depositAmount: "100",
            //   sharesAmount: "0",
            // },
            {
                title: "returns partial shares when pool does not have enough liquidity",
                pool: {
                    base: "10",
                    quote: "10",
                },
                aliceAssetsBefore: "1000",
                depositAmount: "100",
                sharesAmount: "9.090909090909090909",
            },
            {
                title: "returns ideal shares even if alice does not have enough assets",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "5",
                depositAmount: "10",
                sharesAmount: "9.990009990009990009",
            },
            {
                title: "returns preview amount when alice has enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "50",
                depositAmount: "20",
                sharesAmount: "19.960079840319361277",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceAssetsBefore))

                // alice deposit preview
                var depositAmount = parseAssets(test.depositAmount)
                var sharesAmount = parseShares(test.sharesAmount)
                expect(await longToken.connect(alice).previewDeposit(depositAmount)).to.eq(sharesAmount)
            })
        })
    })

    describe("deposit", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when pool does not have enough liquidity",
                pool: {
                    base: "1",
                    quote: "1",
                },
                aliceAssetsBefore: "100",
                depositAmount: "10",
                revertedWith: "TL_OP: normal order price limit",
            },
            {
                title: "reverts when alice does not have enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "5",
                depositAmount: "10",
                revertedWith: "ERC20: transfer amount exceeds balance",
            },
            {
                title: "successes when alice has enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "50",
                depositAmount: "20",
                sharesAmount: "19.960079840319361277",
                totalAssetsAfter: "20.039999999999999999",
                aliceAssetsAfter: "30",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceAssetsBefore))

                // alice deposit preview
                var depositAmount = parseAssets(test.depositAmount)
                var previewRes = await longToken.connect(alice).previewDeposit(depositAmount)

                // alice deposits
                var depositRes = expect(longToken.connect(alice).deposit(depositAmount, alice.address))

                // assert
                if (test.revertedWith !== void 0) {
                    await depositRes.to.revertedWith(test.revertedWith)
                } else {
                    var sharesAmount = parseShares(test.sharesAmount)
                    // event
                    await depositRes.to
                        .emit(longToken, "Deposit")
                        .withArgs(alice.address, alice.address, depositAmount, sharesAmount)

                    // share
                    expect(await longToken.totalSupply()).to.eq(sharesAmount)
                    expect(await longToken.balanceOf(alice.address)).to.eq(sharesAmount)

                    // asset
                    expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssetsAfter))
                    expect(await weth.balanceOf(alice.address)).to.eq(parseAssets(test.aliceAssetsAfter))

                    // preview <= shares
                    expect(previewRes).to.lte(sharesAmount)
                }
            })
        })
    })
})
