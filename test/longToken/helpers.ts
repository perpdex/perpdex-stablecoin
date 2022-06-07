import { ethers } from "hardhat"

export async function initPool(exchange, market, owner, base, quote): Promise<void> {
    await market.connect(owner).setFundingMaxPremiumRatio(0)
    await exchange.connect(owner).setIsMarketAllowed(market.address, true)

    await exchange.setAccountInfo(
        owner.address,
        {
            collateralBalance: quote.mul(10),
        },
        [],
    )

    if (base !== "0" && quote !== "0") {
        await exchange.connect(owner).addLiquidity({
            market: market.address,
            base: base,
            quote: quote,
            minBase: 0,
            minQuote: 0,
            deadline: ethers.constants.MaxUint256,
        })
    }
}
