// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from "chai"
import { BigNumber, Wallet } from "ethers"
import { ethers, waffle } from "hardhat"
import { TestPerpdexTokenBase } from "../../typechain"
import { createPerpdexTokenBaseFixture } from "./fixtures"

describe("PerpdexTokenBase.", async () => {
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

    describe("_spendAllowance", async () => {
        ;[
            {
                title: "does not change allowance when allowance is max",
                ownerShares: BigNumber.from(100),
                ownerAllowance: ethers.constants.MaxUint256,
                caller: "alice",
                owner: "bob",
                amount: BigNumber.from(10),
                ownerAllowanceAfter: ethers.constants.MaxUint256,
            },
            {
                title: "spends amount of allowance when amount >= allowance",
                ownerShares: BigNumber.from(100),
                ownerAllowance: BigNumber.from(50),
                caller: "alice",
                owner: "bob",
                amount: BigNumber.from(10),
                ownerAllowanceAfter: BigNumber.from(50 - 10),
            },
            {
                title: "reverts when amount < allowance",
                ownerShares: BigNumber.from(100),
                ownerAllowance: BigNumber.from(50),
                caller: "alice",
                owner: "bob",
                amount: BigNumber.from(100),
                revertedWith: "ERC20: insufficient allowance",
            },
        ].forEach(test => {
            it(test.title, async function () {
                var caller = toWallet(test.caller)
                var owner_ = toWallet(test.owner)

                // owner approves caller
                tokenBase.connect(owner_).approve(caller.address, test.ownerAllowance)

                var subject = tokenBase.connect(caller).spendAllowance(owner_.address, caller.address, test.amount)
                if (test.revertedWith !== void 0) {
                    await expect(subject).to.revertedWith(test.revertedWith)
                } else {
                    await subject
                    expect(await tokenBase.allowance(owner_.address, caller.address)).to.eq(test.ownerAllowanceAfter)
                }
            })
        })
    })
})
