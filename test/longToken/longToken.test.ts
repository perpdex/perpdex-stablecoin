import { ethers } from "hardhat";
import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { BigNumber, Wallet } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { waffle } from "hardhat";
import { createPerpdexExchangeFixture } from "./fixtures";
import {
  TestPerpdexExchange,
  PerpdexLongToken,
  TestPerpdexMarket,
  TestERC20,
} from "../../typechain";

describe("PerpdexLongToken", async () => {
  let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets());
  let fixture;

  let longToken: PerpdexLongToken;
  let market: TestPerpdexMarket;
  let exchange: TestPerpdexExchange;
  let weth: TestERC20;
  let wethDecimals: number;
  let owner: Wallet;
  let alice: Wallet;
  let bob: Wallet;

  beforeEach(async () => {
    fixture = await loadFixture(createPerpdexExchangeFixture());

    longToken = fixture.perpdexLongToken;
    market = fixture.perpdexMarket;
    exchange = fixture.perpdexExchange;

    weth = fixture.weth;
    wethDecimals = await weth.decimals();

    owner = fixture.owner;
    alice = fixture.alice;
    bob = fixture.bob;
  });

  function parseWeth(amount: number) {
    return parseUnits(String(amount), wethDecimals);
  }

  it("asset", async () => {
    expect(await longToken.asset()).to.eq(await exchange.settlementToken());
  });

  describe("totalAssets", async () => {
    [
      {
        title: "no balance",
        balance: 0,
        totalAssets: 0,
      },
      {
        title: "balance 10 WETH",
        balance: 10,
        totalAssets: 10,
      },
    ].forEach((test) => {
      it(test.title, async () => {
        // force contract balance to be deposit
        await exchange.setAccountInfo(
          longToken.address,
          {
            collateralBalance: parseWeth(test.balance),
          },
          []
        );
        expect(await longToken.totalAssets()).to.eq(
          parseWeth(test.totalAssets)
        );
      });
    });
  });
});
