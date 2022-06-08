// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from "chai"
import { Wallet } from "ethers"
import { parseUnits } from "ethers/lib/utils"
import { waffle } from "hardhat"
import { TestPerpdexTokenBase } from "../../typechain"
import { createPerpdexTokenBaseFixture } from "./fixtures"

describe("PerpdexTokenBase", async () => {
    let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets())
    let fixture

    let tokenBase: TestPerpdexTokenBase
    let alice: Wallet

    beforeEach(async () => {
        fixture = await loadFixture(createPerpdexTokenBaseFixture())

        tokenBase = fixture.perpdexTokenBase
        alice = fixture.alice
    })

    describe("_validateOpenPositionResult", async () => {
        ;[
            {
                title: "reverts when short exact input but base != -amount",
                isBaseToQuote: true,
                isExactInput: true,
                amount: "100",
                base: "-99",
                quote: "10",
                revertedWith: "PTB_VOPR: EI BTQ base",
            },
            {
                title: "reverts when short exact input but quote <= 0",
                isBaseToQuote: true,
                isExactInput: true,
                amount: "100",
                base: "-100",
                quote: "-10",
                revertedWith: "PTB_VOPR: EI BTQ quote",
            },
            {
                title: "reverts when long exact input but base <= 0",
                isBaseToQuote: false,
                isExactInput: true,
                amount: "100",
                base: "-10",
                quote: "-100",
                revertedWith: "PTB_VOPR: EI QTB base",
            },
            {
                title: "reverts when long exact input but quote != -amount",
                isBaseToQuote: false,
                isExactInput: true,
                amount: "100",
                base: "10",
                quote: "-99",
                revertedWith: "PTB_VOPR: EI QTB quote",
            },
            {
                title: "reverts when short exact output but base >= 0",
                isBaseToQuote: true,
                isExactInput: false,
                amount: "100",
                base: "10",
                quote: "100",
                revertedWith: "PTB_VOPR: EO BTQ base",
            },
            {
                title: "reverts when short exact output but quote != amount",
                isBaseToQuote: true,
                isExactInput: false,
                amount: "100",
                base: "-10",
                quote: "101",
                revertedWith: "PTB_VOPR: EO BTQ quote",
            },
            {
                title: "reverts when long exact output but base != amount",
                isBaseToQuote: false,
                isExactInput: false,
                amount: "100",
                base: "101",
                quote: "-10",
                revertedWith: "PTB_VOPR: EO QTB base",
            },
            {
                title: "reverts when long exact output but quote >= 0",
                isBaseToQuote: false,
                isExactInput: false,
                amount: "100",
                base: "100",
                quote: "10",
                revertedWith: "PTB_VOPR: EO QTB quote",
            },
        ].forEach(test => {
            it(test.title, async function () {
                await expect(
                    tokenBase.validateOpenPositionResult(
                        test.isBaseToQuote,
                        test.isExactInput,
                        parseUnits(test.amount, 18),
                        parseUnits(test.base, 18),
                        parseUnits(test.quote, 18),
                    ),
                ).to.revertedWith(test.revertedWith)
            })
        })
    })
})
