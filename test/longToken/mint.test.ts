// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken mint", async () => {
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

    describe("maxMint", async () => {
        ;[
            // {
            //   title: "TODO: returns 0 when pool liquidity is zero",
            //   pool: {
            //     base: "0",
            //     quote: "0",
            //   },
            //   expected: 0,
            // },
            {
                title: "returns max uint",
                pool: {
                    base: "10",
                    quote: "10",
                },
                expected: ethers.constants.MaxUint256,
            },
        ].forEach(test => {
            it(test.title, async () => {
                // init pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                expect(await longToken.maxMint(alice.address)).to.eq(test.expected)
            })
        })
    })

    describe("previewMint", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "returns 0 when shares is zero",
                pool: {
                    base: "1",
                    quote: "1",
                },
                aliceAssetsBefore: "100",
                mintShares: "0",
                assetsAmount: "0",
            },
            // TODO:
            // {
            //   title: "returns patial assets when pool liquidity is not enought",
            //   pool: {
            //     base: "1",
            //     quote: "1",
            //   },
            //   aliceAssetsBefore: "100",
            //   mintShares: "10",
            //   assetsAmount: "123",
            // },
            {
                title: "returns ideal assets even if alice's assets is not enough",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "5",
                mintShares: "10",
                assetsAmount: "10.010010010010010011",
            },
            {
                title: "returns ideal assets when alice's assets is enough",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "100",
                mintShares: "10",
                assetsAmount: "10.010010010010010011",
            },
        ].forEach(test => {
            it(test.title, async () => {
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceAssetsBefore))

                // alice deposit preview
                var mintShares = parseAssets(test.mintShares)
                var assetsAmount = parseShares(test.assetsAmount)
                expect(await longToken.connect(alice).previewMint(mintShares)).to.eq(assetsAmount)
            })
        })
    })

    describe("mint", async () => {
        beforeEach(async () => {
            // approve max
            await weth.approveForce(alice.address, longToken.address, ethers.constants.MaxUint256)
            await weth.approveForce(longToken.address, exchange.address, ethers.constants.MaxUint256)
        })
        ;[
            {
                title: "reverts when shares is zero",
                pool: {
                    base: "1",
                    quote: "1",
                },
                aliceAssetsBefore: "100",
                mintShares: "0",
                revertedWith: "PLT_M: shares is zero",
            },
            {
                title: "reverts when pool does not have enough liquidity",
                pool: {
                    base: "1",
                    quote: "1",
                },
                aliceAssetsBefore: "100",
                mintShares: "10",
                revertedWith: "SafeMath: subtraction overflow",
            },
            {
                title: "reverts when alice does not have enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "5",
                mintShares: "10",
                revertedWith: "ERC20: transfer amount exceeds balance",
            },
            {
                title: "successes when alice has enough WETH",
                pool: {
                    base: "10000",
                    quote: "10000",
                },
                aliceAssetsBefore: "50",
                mintShares: "20",
                assetsAmount: "20.040080160320641283",
                totalAssetsAfter: "20.080240641603848980",
                aliceAssetsAfter: "29.959919839679358717",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // pool
                await initPool(exchange, market, owner, parseShares(test.pool.base), parseAssets(test.pool.base))

                // alice balance
                await weth.connect(owner).mint(alice.address, parseAssets(test.aliceAssetsBefore))

                // alice mint preview
                var mintShares = parseShares(test.mintShares)
                // var previewRes = await longToken
                //     .connect(alice)
                //     .previewMint(mintShares);

                // alice mints
                var mintRes = expect(longToken.connect(alice).mint(mintShares, alice.address))

                // assert
                if (test.revertedWith !== void 0) {
                    await mintRes.to.revertedWith(test.revertedWith)
                } else {
                    var assetsAmount = parseAssets(test.assetsAmount)
                    // event
                    await mintRes.to
                        .emit(longToken, "Deposit")
                        .withArgs(alice.address, alice.address, assetsAmount, mintShares)

                    // share
                    expect(await longToken.totalSupply()).to.eq(mintShares)
                    expect(await longToken.balanceOf(alice.address)).to.eq(mintShares)

                    // asset
                    expect(await longToken.totalAssets()).to.eq(parseAssets(test.totalAssetsAfter))
                    expect(await weth.balanceOf(alice.address)).to.eq(parseAssets(test.aliceAssetsAfter))

                    // preview >= assets
                    // expect(previewRes).to.gte(assetsAmount);
                }
            })
        })
    })
})
