// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract } from "@defi-wonderland/smock"
import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken", async () => {
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
        ;[
            {
                title: "totalAssets 0 totalShares 0 assets 10",
                totalAssets: "0",
                totalShares: "0",
                assets: "10",
                shares: "10",
            },
            {
                title: "totalAssets 100 totalShares 100 assets 50",
                totalAssets: "100",
                totalShares: "100",
                assets: "50",
                shares: "50",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // set totalAssets
                await exchange.setAccountInfo(
                    longToken.address,
                    {
                        collateralBalance: parseAssets(test.totalAssets),
                    },
                    [],
                )

                // set totalShares
                await longTokenMock.totalSupply.returns(parseShares(test.totalShares))

                expect(await longTokenMock.convertToShares(parseAssets(test.assets))).to.eq(parseShares(test.shares))
            })
        })
    })

    describe("convertToAssets", async () => {
        ;[
            {
                title: "no mint yet",
                totalAssets: "0",
                totalShares: "0",
                shares: "10",
                assets: "10",
            },
            {
                title: "totalAssets is 100, totalShares is 100. want to mint 50 shares",
                totalAssets: "100",
                totalShares: "100",
                shares: "50",
                assets: "50",
            },
        ].forEach(test => {
            it(test.title, async () => {
                // set totalAssets
                await exchange.setAccountInfo(
                    longToken.address,
                    {
                        collateralBalance: parseAssets(test.totalAssets),
                    },
                    [],
                )

                // set totalShares
                await longTokenMock.totalSupply.returns(parseShares(test.totalShares))

                expect(await longTokenMock.convertToAssets(parseShares(test.shares))).to.eq(parseAssets(test.assets))
            })
        })
    })

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
                title: "return max int when pool has some liquidity",
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
                title: "return max uint when pool has some liquidity",
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
