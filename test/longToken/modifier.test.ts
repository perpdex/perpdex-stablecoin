// SPDX-License-Identifier: GPL-3.0-or-later
import { expect } from "chai"
import { waffle } from "hardhat"
import { createPerpdexExchangeFixture } from "./fixtures"

describe("PerpdexLongToken modifier", async () => {
    describe("onlyETH", async () => {
        describe("when ETH is not settlementToken", async () => {
            let alice
            let longToken
            let revertMessage = "PTB_OW: weth is not available"
            beforeEach(async () => {
                var loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
                var fixture = await loadFixture(
                    createPerpdexExchangeFixture({
                        settlementToken: "weth",
                        wethDecimals: 18,
                    }),
                )
                alice = fixture.alice
                longToken = fixture.perpdexLongToken
            })

            it("depositETH reverts", async () => {
                await expect(longToken.depositETH(alice.address, { value: "10" })).to.revertedWith(revertMessage)
            })

            it("mintETH reverts", async () => {
                await expect(longToken.mintETH("10", alice.address, { value: "10" })).to.revertedWith(revertMessage)
            })

            it("withdrawETH reverts", async () => {
                await expect(longToken.withdrawETH("10", alice.address, alice.address)).to.revertedWith(revertMessage)
            })

            it("redeemETH reverts", async () => {
                await expect(longToken.redeemETH("10", alice.address, alice.address)).to.revertedWith(revertMessage)
            })
        })
    })
})
