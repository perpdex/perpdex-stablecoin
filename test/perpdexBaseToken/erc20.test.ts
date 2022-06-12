// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from "chai"
import { BigNumber, Wallet } from "ethers"
import { ethers, waffle } from "hardhat"
import { TestPerpdexTokenBase } from "../../typechain"
import { createPerpdexTokenBaseFixture } from "./fixtures"

describe("PerpdexTokenBase erc20", async () => {
    let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
    let fixture

    let tokenBase: TestPerpdexTokenBase
    let alice: Wallet
    let bob: Wallet

    function toWallet(who: string) {
        if (who === "alice") {
            return alice
        }
        if (who === "bob") {
            return bob
        }
    }

    beforeEach(async () => {
        fixture = await loadFixture(createPerpdexTokenBaseFixture())

        tokenBase = fixture.perpdexTokenBase
        alice = fixture.alice
        bob = fixture.bob
    })

    describe("smoke test", async () => {
        it("transfer", async () => {
            await tokenBase.testMint(alice.address, 100)
            await expect(tokenBase.connect(alice).transfer(bob.address, 30))
                .to.emit(tokenBase, "Transfer")
                .withArgs(alice.address, bob.address, 30)
            expect(await tokenBase.balanceOf(bob.address)).to.eq(30)
        })

        it("increaseAllowance and transferFrom", async () => {
            await tokenBase.testMint(alice.address, 100)
            await tokenBase.connect(alice).increaseAllowance(bob.address, 30)
            await expect(tokenBase.connect(bob).transferFrom(alice.address, bob.address, 30))
                .to.emit(tokenBase, "Transfer")
                .withArgs(alice.address, bob.address, 30)
            expect(await tokenBase.balanceOf(bob.address)).to.eq(30)
        })

        it("increaseAllowance and decreaseAllowance", async () => {
            await tokenBase.connect(alice).increaseAllowance(bob.address, 30)
            await tokenBase.connect(alice).decreaseAllowance(bob.address, 30)
        })
    })
})
