// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract } from "ethereum-waffle"
import { BigNumber, Wallet } from "ethers"
import { ethers, waffle } from "hardhat"
import IPerpdexPriceFeedJson from "../../deps/perpdex-contract/artifacts/contracts/interface/IPerpdexPriceFeed.sol/IPerpdexPriceFeed.json"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"

export interface PerpdexExchangeFixture {
    perpdexExchange: TestPerpdexExchange
    perpdexMarket: TestPerpdexMarket
    perpdexLongToken: PerpdexLongToken
    weth: TestERC20
    owner: Wallet
    alice: Wallet
    bob: Wallet
    charlie: Wallet
    baseDecimals: number
    priceFeedBase: MockContract
}

interface FixtureParams {
    wethDecimals: number
}

export function createPerpdexExchangeFixture(
    params: FixtureParams = { wethDecimals: 18 },
): (wallets, provider) => Promise<PerpdexExchangeFixture> {
    return async ([owner, alice, bob, charlie], provider): Promise<PerpdexExchangeFixture> => {
        const tokenFactory = await ethers.getContractFactory("TestERC20")
        let weth = (await tokenFactory.deploy("TestWETH", "WETH", params.wethDecimals)) as TestERC20
        let settlementToken = weth
        let baseDecimals = 18

        // exchange
        const perpdexExchangeFactory = await ethers.getContractFactory("TestPerpdexExchange")
        const perpdexExchange = (await perpdexExchangeFactory.deploy(settlementToken.address)) as TestPerpdexExchange

        // base priceFeed
        const priceFeedBase = await waffle.deployMockContract(owner, IPerpdexPriceFeedJson.abi)
        await priceFeedBase.mock.getPrice.returns(BigNumber.from(10).pow(12))
        await priceFeedBase.mock.decimals.returns(12)

        // market
        const perpdexMarketFactory = await ethers.getContractFactory("TestPerpdexMarket")
        const perpdexMarket = (await perpdexMarketFactory.deploy(
            "USD",
            perpdexExchange.address,
            priceFeedBase.address,
            ethers.constants.AddressZero,
        )) as TestPerpdexMarket

        await perpdexMarket.connect(owner).setPoolFeeRatio(0)
        await perpdexMarket.connect(owner).setFundingMaxPremiumRatio(0)

        // long token
        const perpdexLongTokenF = await ethers.getContractFactory("PerpdexLongToken")
        const perpdexLongToken = (await perpdexLongTokenF.deploy(perpdexMarket.address)) as PerpdexLongToken

        return {
            perpdexExchange,
            perpdexMarket,
            perpdexLongToken,
            weth,
            owner,
            alice,
            bob,
            charlie,
            baseDecimals,
            priceFeedBase,
        }
    }
}
