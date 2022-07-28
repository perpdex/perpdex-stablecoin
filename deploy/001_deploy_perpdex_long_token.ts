import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import path from "path"
import fs from "fs"

interface Deployment {
    address: string
    abi: object[]
}

export function getPerpdexDeploy(name: string): Deployment {
    const networkName = hre.network.name
    const fname = path.resolve(__dirname, `../deps/perpdex-contract/deployments/${networkName}/${name}.json`)
    return JSON.parse(fs.readFileSync(fname, "utf8"))
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, getChainId } = hre
    const { deploy, execute } = deployments
    const { deployer } = await getNamedAccounts()

    const markets = {
        rinkeby: [
            {
                market: "PerpdexMarketBTC",
            },
            {
                market: "PerpdexMarketLINK",
            },
            {
                market: "PerpdexMarketMATIC",
            },
            {
                market: "PerpdexMarketUSD",
            },
        ],
        mumbai: [
            {
                market: "PerpdexMarketUSD",
            },
        ],
        shibuya: [
            {
                market: "PerpdexMarketBTC",
            },
            {
                market: "PerpdexMarketETH",
            },
            {
                market: "PerpdexMarketKSM",
            },
            {
                market: "PerpdexMarketSDN",
            },
            {
                market: "PerpdexMarketUSD",
            },
        ],
        zksync2_testnet: [
            {
                market: "PerpdexMarketUSD",
            },
        ],
        arbitrum_rinkeby: [
            {
                market: "PerpdexMarketUSD",
            },
        ],
        optimism_kovan: [
            {
                market: "PerpdexMarketUSD",
            },
        ],
    }[hre.network.name]

    const nativeTokenSymbol =
        {
            mumbai: "MATIC",
            shibuya: "ASTR",
        }[hre.network.name] || "ETH"

    const wethAddress = {
        rinkeby: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        mumbai: "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889", // correct?
        shibuya: "0x9Af480478974a2fda7d5aE667541639164D2858B", // correct?
        zksync2_testnet: "0xB4fbFB7807C31268Dc1ac8c26fA4ef41115d0ece",
        arbitrum_rinkeby: "0xebbc3452cc911591e4f18f3b36727df45d6bd1f9", // correct?
        optimism_kovan: "0xbC6F6b680bc61e30dB47721c6D1c5cde19C1300d", // correct?
    }[hre.network.name]

    for (let i = 0; i < markets.length; i++) {
        const token = await deploy(markets[i].market.replace("PerpdexMarket", "PerpdexLongToken"), {
            from: deployer,
            contract: "PerpdexLongToken",
            args: [getPerpdexDeploy(markets[i].market).address, wethAddress, nativeTokenSymbol],
            log: true,
            autoMine: true,
        })
    }
}

export default func
func.tags = ["long_token"]
