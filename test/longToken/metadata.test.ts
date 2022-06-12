// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { BigNumber, Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { ethers, waffle } from "hardhat"
import { PerpdexLongToken, TestERC20, TestPerpdexExchange, TestPerpdexMarket } from "../../typechain"
import { createPerpdexExchangeFixture } from "./fixtures"
import { initPool } from "./helpers"

describe("PerpdexLongToken metadata", async () => {
    let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
    let fixture

    let longToken: PerpdexLongToken

    describe("native token", () => {
        beforeEach(async () => {
            fixture = await loadFixture(
                createPerpdexExchangeFixture({
                    settlementToken: "ETH",
                    wethDecimals: 18,
                }),
            )
            longToken = fixture.perpdexLongToken
        })

        it("symbol", async () => {
            expect(await longToken.symbol()).to.eq("plUSDETH")
        })

        it("name", async () => {
            expect(await longToken.name()).to.eq("PerpDEX Long USDETH")
        })

        it("decimals", async () => {
            expect(await longToken.decimals()).to.eq(18)
        })
    })

    describe("weth", () => {
        beforeEach(async () => {
            fixture = await loadFixture(createPerpdexExchangeFixture())
            longToken = fixture.perpdexLongToken
        })

        it("symbol", async () => {
            expect(await longToken.symbol()).to.eq("plUSDWETH")
        })

        it("name", async () => {
            expect(await longToken.name()).to.eq("PerpDEX Long USDWETH")
        })

        it("decimals", async () => {
            expect(await longToken.decimals()).to.eq(18)
        })
    })
})
