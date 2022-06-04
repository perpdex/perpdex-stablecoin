// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {FullMath} from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import {IPerpdexExchange} from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import {IPerpdexMarket} from "../deps/perpdex-contract/contracts/interface/IPerpdexMarket.sol";
import {IERC4626} from "./interface/IERC4626.sol";
import {IERC20Metadata} from "./interface/IERC20Metadata.sol";

abstract contract PerpdexTokenBase is IERC4626, ERC20 {
    using SafeCast for int256;

    address public immutable override asset;
    address public immutable market;
    address public immutable exchange;
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    constructor(
        address marketArg,
        string memory namePrefix,
        string memory symbolPrefix
    )
        ERC20(
            _getERC20Name(marketArg, namePrefix),
            _getERC20Symbol(marketArg, symbolPrefix)
        )
    {
        market = marketArg;
        exchange = IPerpdexMarket(marketArg).exchange();
        asset = IPerpdexExchange(IPerpdexMarket(marketArg).exchange())
            .settlementToken();
    }

    function totalAssets()
        public
        view
        override
        returns (uint256 totalManagedAssets)
    {
        int256 value = IPerpdexExchange(exchange).getTotalAccountValue(
            address(this)
        );
        totalManagedAssets = value < 0 ? 0 : uint256(value);
    }

    function convertToShares(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        return FullMath.mulDiv(assets, totalSupply(), totalAssets());
    }

    function convertToAssets(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        return FullMath.mulDiv(shares, totalAssets(), totalSupply());
    }

    function maxDeposit(address)
        external
        pure
        override
        returns (uint256 maxAssets)
    {
        return uint256(type(int256).max);
    }

    function maxMint(address)
        external
        pure
        override
        returns (uint256 maxShares)
    {
        return type(uint256).max;
    }

    function maxWithdraw(address owner)
        external
        view
        override
        returns (uint256 maxAssets)
    {
        return convertToAssets(balanceOf(owner));
    }

    function maxRedeem(address owner)
        external
        view
        override
        returns (uint256 maxShares)
    {
        return balanceOf(owner);
    }

    function _openPositionDry(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) internal view returns (int256 base, int256 quote) {
        (base, quote) = IPerpdexExchange(exchange).openPositionDry(
            IPerpdexExchange.OpenPositionParams({
                market: market,
                isBaseToQuote: isBaseToQuote,
                isExactInput: isExactInput,
                amount: amount,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            }),
            address(this)
        );
        _validateOpenPositionResult(
            isBaseToQuote,
            isExactInput,
            amount,
            base,
            quote
        );
    }

    function _openPosition(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) internal returns (int256 base, int256 quote) {
        (base, quote) = IPerpdexExchange(exchange).openPosition(
            IPerpdexExchange.OpenPositionParams({
                market: market,
                isBaseToQuote: isBaseToQuote,
                isExactInput: isExactInput,
                amount: amount,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            })
        );
        _validateOpenPositionResult(
            isBaseToQuote,
            isExactInput,
            amount,
            base,
            quote
        );
    }

    function _validateOpenPositionResult(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount,
        int256 base,
        int256 quote
    ) internal pure {
        if (isExactInput) {
            if (isBaseToQuote) {
                require((-base).toUint256() == amount, "PTB_VOPR: EI BTQ base");
                require(quote > 0, "PTB_VOPR: EI BTQ quote");
            } else {
                require(base > 0, "PTB_VOPR: EI QTB base");
                require(
                    (-quote).toUint256() == amount,
                    "PTB_VOPR: EI QTB quote"
                );
            }
        } else {
            if (isBaseToQuote) {
                require(base < 0, "PTB_VOPR: EO BTQ base");
                require(quote.toUint256() == amount, "PTB_VOPR: EO BTQ quote");
            } else {
                require(base.toUint256() == amount, "PTB_VOPR: EO QTB base");
                require(quote < 0, "PTB_VOPR: EO QTB quote");
            }
        }
    }

    function _transferFrom(
        address from,
        address to,
        uint256 amount
    ) internal {
        SafeERC20.safeTransferFrom(IERC20(asset), from, to, amount);
    }

    function _getERC20Name(address marketArg, string memory namePrefix)
        private
        view
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    namePrefix,
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(
                        IPerpdexExchange(IPerpdexMarket(marketArg).exchange())
                            .settlementToken()
                    ).symbol()
                )
            );
    }

    function _getERC20Symbol(address marketArg, string memory symbolPrefix)
        private
        view
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    symbolPrefix,
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(
                        IPerpdexExchange(IPerpdexMarket(marketArg).exchange())
                            .settlementToken()
                    ).symbol()
                )
            );
    }
}
