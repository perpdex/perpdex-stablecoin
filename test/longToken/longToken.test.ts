import { ethers } from "hardhat";
import { expect } from "chai";
import { Wallet } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { waffle } from "hardhat";
import { createPerpdexExchangeFixture } from "./fixtures";
import {
  TestPerpdexExchange,
  PerpdexLongToken,
  TestPerpdexMarket,
  TestERC20,
} from "../../typechain";
import { MockContract } from "@defi-wonderland/smock";

describe("PerpdexLongToken", async () => {
  let loadFixture = waffle.createFixtureLoader(waffle.provider.getWallets());
  let fixture;

  let longToken: PerpdexLongToken;
  let longTokenMock: MockContract;
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
    longTokenMock = fixture.perpdexLongTokenMock;
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

  it("maxDeposit", async () => {
    expect(await longToken.maxDeposit(alice.address)).to.eq(
      ethers.constants.MaxInt256
    );
  });

  it("maxMint", async () => {
    expect(await longToken.maxMint(alice.address)).to.eq(
      ethers.constants.MaxUint256
    );
  });

  describe("convertToShares", async () => {
    [
      {
        title: "totalAssets 0 totalShares 0 assets 10",
        totalAssets: 0,
        totalShares: 0,
        assets: 10,
        shares: 10,
      },
      {
        title: "totalAssets 100 totalShares 100 assets 50",
        totalAssets: 100,
        totalShares: 100,
        assets: 50,
        shares: 50,
      },
    ].forEach((test) => {
      it(test.title, async () => {
        // set totalAssets
        await exchange.setAccountInfo(
          longToken.address,
          {
            collateralBalance: parseWeth(test.totalAssets),
          },
          []
        );

        // set totalShares
        if (test.totalShares > 0) {
          await longTokenMock.totalSupply.returns(test.totalShares);
        }

        expect(
          await longTokenMock.convertToShares(parseWeth(test.assets))
        ).to.eq(parseWeth(test.shares));
      });
    });
  });
});
