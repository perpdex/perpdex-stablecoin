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
    }[hre.network.name]

    const nativeTokenSymbol =
        {
            shibuya: "ASTR",
        }[hre.network.name] || "ETH"

    const wethAddress = {
        rinkeby: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        shibuya: "0x9Af480478974a2fda7d5aE667541639164D2858B", // correct?
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
