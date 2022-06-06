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
  let longTokenMock: MockContract<PerpdexLongToken>;
  let longTokenDecimals: number;
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
    longTokenDecimals = await longToken.decimals();
    market = fixture.perpdexMarket;
    exchange = fixture.perpdexExchange;

    weth = fixture.weth;
    wethDecimals = await weth.decimals();

    owner = fixture.owner;
    alice = fixture.alice;
    bob = fixture.bob;
  });

  function parseAssets(amount: string) {
    return parseUnits(amount, wethDecimals);
  }

  function parseShares(amount: string) {
    return parseUnits(amount, longTokenDecimals);
  }

  it("asset", async () => {
    expect(await longToken.asset()).to.eq(await exchange.settlementToken());
  });

  describe("totalAssets", async () => {
    [
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
    ].forEach((test) => {
      it(test.title, async () => {
        // force contract balance to be deposit
        await exchange.setAccountInfo(
          longToken.address,
          {
            collateralBalance: parseAssets(test.balance),
          },
          []
        );
        expect(await longToken.totalAssets()).to.eq(
          parseAssets(test.totalAssets)
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
    ].forEach((test) => {
      it(test.title, async () => {
        // set totalAssets
        await exchange.setAccountInfo(
          longToken.address,
          {
            collateralBalance: parseAssets(test.totalAssets),
          },
          []
        );

        // set totalShares
        await longTokenMock.totalSupply.returns(parseShares(test.totalShares));

        expect(
          await longTokenMock.convertToShares(parseAssets(test.assets))
        ).to.eq(parseShares(test.shares));
      });
    });
  });

  describe("convertToAssets", async () => {
    [
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
    ].forEach((test) => {
      it(test.title, async () => {
        // set totalAssets
        await exchange.setAccountInfo(
          longToken.address,
          {
            collateralBalance: parseAssets(test.totalAssets),
          },
          []
        );

        // set totalShares
        await longTokenMock.totalSupply.returns(parseShares(test.totalShares));

        expect(
          await longTokenMock.convertToAssets(parseShares(test.shares))
        ).to.eq(parseAssets(test.assets));
      });
    });
  });
});
