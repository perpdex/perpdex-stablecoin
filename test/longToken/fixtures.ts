// SPDX-License-Identifier: GPL-3.0-or-later
import { MockContract, MockContractFactory, smock } from "@defi-wonderland/smock"
import { BigNumber, Wallet } from "ethers"
import { ethers, waffle } from "hardhat"
import IPerpdexPriceFeedJson from "../../deps/perpdex-contract/artifacts/contracts/interface/IPerpdexPriceFeed.sol/IPerpdexPriceFeed.json"
import {
    PerpdexLongToken,
    PerpdexLongToken__factory,
    TestERC20,
    TestPerpdexExchange,
    TestPerpdexMarket,
} from "../../typechain"

export interface PerpdexExchangeFixture {
    perpdexExchange: TestPerpdexExchange
    perpdexMarket: TestPerpdexMarket
    perpdexLongToken: PerpdexLongToken
    perpdexLongTokenMock: MockContract<PerpdexLongToken>
    weth: TestERC20
    owner: Wallet
    alice: Wallet
    bob: Wallet
}

interface Params {
    linear: Boolean
}

export function createPerpdexExchangeFixture(
    params: Params = { linear: false },
): (wallets, provider) => Promise<PerpdexExchangeFixture> {
    return async ([owner, alice, bob], provider): Promise<PerpdexExchangeFixture> => {
        let settlementToken = hre.ethers.constants.AddressZero
        const tokenFactory = await ethers.getContractFactory("TestERC20")
        let weth = (await tokenFactory.deploy("TestWETH", "WETH", 18)) as TestERC20
        settlementToken = weth.address

        // exchange
        const perpdexExchangeFactory = await ethers.getContractFactory("TestPerpdexExchange")
        const perpdexExchange = (await perpdexExchangeFactory.deploy(settlementToken)) as TestPerpdexExchange

        // priceFeed
        const priceFeed = await waffle.deployMockContract(owner, IPerpdexPriceFeedJson.abi)
        await priceFeed.mock.getPrice.returns(BigNumber.from(10).pow(12))
        await priceFeed.mock.decimals.returns(12)

        // market
        const perpdexMarketFactory = await ethers.getContractFactory("TestPerpdexMarket")
        const perpdexMarket = (await perpdexMarketFactory.deploy(
            "USD",
            perpdexExchange.address,
            priceFeed.address,
            ethers.constants.AddressZero,
        )) as TestPerpdexMarket

        await perpdexMarket.connect(owner).setPoolFeeRatio(0)
        await perpdexMarket.connect(owner).setFundingMaxPremiumRatio(0)

        // long token
        const perpdexLongTokenFMock: MockContractFactory<PerpdexLongToken__factory> = await smock.mock(
            "PerpdexLongToken",
        )
        const perpdexLongTokenMock: MockContract<PerpdexLongToken> = await perpdexLongTokenFMock.deploy(
            perpdexMarket.address,
        )

        const perpdexLongTokenF = await ethers.getContractFactory("PerpdexLongToken")
        const perpdexLongToken = (await perpdexLongTokenF.deploy(perpdexMarket.address)) as PerpdexLongToken

        return {
            perpdexExchange,
            perpdexMarket,
            perpdexLongToken,
            perpdexLongTokenMock,
            weth,
            owner,
            alice,
            bob,
        }
    }
}
