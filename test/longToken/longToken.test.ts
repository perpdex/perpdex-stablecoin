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

  async function initPool(liquidity): Promise<void> {
    await exchange.connect(owner).setImRatio(100000);
    await exchange.connect(owner).setMmRatio(50000);

    await market.connect(owner).setPoolFeeRatio(0);
    await market.connect(owner).setFundingMaxPremiumRatio(0);
    await exchange.connect(owner).setIsMarketAllowed(market.address, true);

    await exchange.setAccountInfo(
      owner.address,
      {
        collateralBalance: parseAssets(liquidity.quote).mul(10),
      },
      []
    );

    if (liquidity.base !== "0" && liquidity.quote !== "0") {
      await exchange.connect(owner).addLiquidity({
        market: market.address,
        base: parseAssets(liquidity.base),
        quote: parseAssets(liquidity.quote),
        minBase: 0,
        minQuote: 0,
        deadline: ethers.constants.MaxUint256,
      });
    }
  }

  describe.skip("maxDeposit", async () => {
    [
      {
        title: "TODO: returns 0 when pool liquidity is zero",
        pool: {
          base: "0",
          quote: "0",
        },
        expected: "0",
      },
      {
        title: "TODO: priceLimit",
        pool: {
          base: "10",
          quote: "10",
        },
        expected: "20",
      },
    ].forEach((test) => {
      it(test.title, async () => {
        // init pool
        await initPool(test.pool);

        expect(await longToken.maxDeposit(alice.address)).to.eq(
          parseAssets(test.expected)
        );
      });
    });
  });

  describe.skip("previewDeposit", async () => {
    beforeEach(async () => {
      // approve max
      await weth.approveForce(
        alice.address,
        longToken.address,
        ethers.constants.MaxUint256
      );
      await weth.approveForce(
        longToken.address,
        exchange.address,
        ethers.constants.MaxUint256
      );
    });
    [
      {
        title: "returns 0 when pool does not have enough liquidity",
        pool: {
          base: "1",
          quote: "1",
        },
        aliceAssetsBefore: "100",
        depositAmount: "10",
        sharesAmount: "0",
      },
      {
        title: "returns 0 when alice does not have enough WETH",
        pool: {
          base: "10000",
          quote: "10000",
        },
        aliceAssetsBefore: "5",
        depositAmount: "10",
        sharesAmount: "0",
      },
      {
        title: "returns preview amount when alice has enough WETH",
        pool: {
          base: "10000",
          quote: "10000",
        },
        aliceAssetsBefore: "50",
        depositAmount: "20",
        sharesAmount: "19.960079840319361277",
      },
    ].forEach((test) => {
      it(test.title, async () => {
        // pool
        await initPool(test.pool);

        // alice balance
        await weth
          .connect(owner)
          .mint(alice.address, parseAssets(test.aliceAssetsBefore));

        // alice deposit preview
        var depositAmount = parseAssets(test.depositAmount);
        var sharesAmount = parseShares(test.sharesAmount);
        expect(
          await longToken.connect(alice).previewDeposit(depositAmount)
        ).to.eq(sharesAmount);
      });
    });
  });

  describe("deposit", async () => {
    beforeEach(async () => {
      // approve max
      await weth.approveForce(
        alice.address,
        longToken.address,
        ethers.constants.MaxUint256
      );
      await weth.approveForce(
        longToken.address,
        exchange.address,
        ethers.constants.MaxUint256
      );
    });
    [
      {
        title: "reverts when pool does not have enough liquidity",
        pool: {
          base: "1",
          quote: "1",
        },
        aliceAssetsBefore: "100",
        depositAmount: "10",
        revertedWith: "TL_OP: normal order forbidden",
      },
      {
        title: "reverts when alice does not have enough WETH",
        pool: {
          base: "10000",
          quote: "10000",
        },
        aliceAssetsBefore: "5",
        depositAmount: "10",
        revertedWith: "ERC20: transfer amount exceeds balance",
      },
      {
        title: "successes when alice has enough WETH",
        pool: {
          base: "10000",
          quote: "10000",
        },
        aliceAssetsBefore: "50",
        depositAmount: "20",
        sharesAmount: "19.960079840319361277",
        totalAssetsAfter: "20.039999999999999999",
        aliceAssetsAfter: "30",
      },
    ].forEach((test) => {
      it(test.title, async () => {
        // pool
        await initPool(test.pool);

        // alice balance
        await weth
          .connect(owner)
          .mint(alice.address, parseAssets(test.aliceAssetsBefore));

        // alice deposit preview
        var depositAmount = parseAssets(test.depositAmount);
        var previewRes = await longToken
          .connect(alice)
          .previewDeposit(depositAmount);

        // alice deposits
        var depositRes = expect(
          longToken.connect(alice).deposit(depositAmount, alice.address)
        );

        // assert
        if (test.revertedWith !== void 0) {
          await depositRes.to.revertedWith(test.revertedWith);
        } else {
          var sharesAmount = parseShares(test.sharesAmount);
          // event
          await depositRes.to
            .emit(longToken, "Deposit")
            .withArgs(
              alice.address,
              alice.address,
              depositAmount,
              sharesAmount
            );

          // share
          expect(await longToken.totalSupply()).to.eq(sharesAmount);
          expect(await longToken.balanceOf(alice.address)).to.eq(sharesAmount);

          // asset
          expect(await longToken.totalAssets()).to.eq(
            parseAssets(test.totalAssetsAfter)
          );
          expect(await weth.balanceOf(alice.address)).to.eq(
            parseAssets(test.aliceAssetsAfter)
          );

          // preview <= shares
          expect(previewRes).to.lte(sharesAmount);
        }
      });
    });
  });
});
