// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {FullMath} from "@uniswap/lib/contracts/libraries/FullMath.sol";
import {IPerpdexExchange} from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import {IPerpdexMarket} from "../deps/perpdex-contract/contracts/interface/IPerpdexMarket.sol";
import {IERC4626} from "./interface/IERC4626.sol";
import {IERC20Metadata} from "./interface/IERC20Metadata.sol";

contract PerpdexLongToken is IERC4626, ERC20 {
    using SafeCast for int256;

    address public immutable override asset;
    address public immutable market;
    address public immutable exchange;
    uint256 private constant Q96 = 0x1000000000000000000000000;

    constructor(address marketArg)
        ERC20(_getERC20Name(marketArg), _getERC20Symbol(marketArg))
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
        return FullMath.mulDiv(assets, Q96, _getMarkPriceX96());
    }

    function convertToAssets(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        return FullMath.mulDiv(shares, _getMarkPriceX96(), Q96);
    }

    function maxDeposit(address)
        external
        pure
        override
        returns (uint256 maxAssets)
    {
        return uint256(type(int256).max);
    }

    function previewDeposit(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        (int256 positionIncreased, int256 quoteAmount) = IPerpdexExchange(
            exchange
        ).openPositionDry(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: false,
                    isExactInput: true,
                    amount: assets,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                }),
                address(this)
            );
        require(positionIncreased > 0);
        require((-quoteAmount).toUint256() == assets);
        return positionIncreased.toUint256();
    }

    function deposit(uint256 assets, address receiver)
        external
        override
        returns (uint256 shares)
    {
        SafeERC20.safeTransferFrom(
            IERC20(asset),
            msg.sender,
            address(this),
            assets
        );
        IPerpdexExchange(exchange).deposit(assets);

        (int256 positionIncreased, int256 quoteAmount) = IPerpdexExchange(
            exchange
        ).openPosition(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: false,
                    isExactInput: true,
                    amount: assets,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                })
            );
        require(positionIncreased > 0);
        require((-quoteAmount).toUint256() == assets);

        shares = positionIncreased.toUint256();
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function maxMint(address)
        external
        pure
        override
        returns (uint256 maxShares)
    {
        return type(uint256).max;
    }

    function previewMint(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        (int256 positionIncreased, int256 quoteAmount) = IPerpdexExchange(
            exchange
        ).openPositionDry(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: false,
                    isExactInput: false,
                    amount: shares,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                }),
                address(this)
            );
        require(positionIncreased.toUint256() == shares);
        return (-quoteAmount).toUint256();
    }

    function mint(uint256 shares, address receiver)
        external
        override
        returns (uint256 assets)
    {
        require(shares != 0, "shares is zero");

        uint256 assetsPreview = previewMint(shares);
        SafeERC20.safeTransferFrom(
            IERC20(asset),
            msg.sender,
            address(this),
            assetsPreview
        );
        IPerpdexExchange(exchange).deposit(assetsPreview);

        (int256 positionIncreased, int256 quoteAmount) = IPerpdexExchange(
            exchange
        ).openPosition(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: false,
                    isExactInput: false,
                    amount: shares,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                })
            );
        require(positionIncreased.toUint256() == shares);
        require((-quoteAmount).toUint256() == assetsPreview);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function maxWithdraw(address owner)
        external
        view
        override
        returns (uint256 maxAssets)
    {
        return convertToAssets(balanceOf(owner));
    }

    function previewWithdraw(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        (int256 baseAmount, int256 quoteAmount) = IPerpdexExchange(exchange)
            .openPositionDry(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: true,
                    isExactInput: false,
                    amount: assets,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                }),
                address(this)
            );
        require(baseAmount < 0);
        require(quoteAmount.toUint256() == assets);
        shares = (-baseAmount).toUint256();
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256 shares) {
        (int256 baseAmount, int256 quoteAmount) = IPerpdexExchange(exchange)
            .openPosition(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: true,
                    isExactInput: false,
                    amount: assets,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                })
            );
        require(baseAmount < 0);
        require(quoteAmount.toUint256() == assets);
        shares = (-baseAmount).toUint256();

        IPerpdexExchange(exchange).withdraw(assets);
        SafeERC20.safeTransferFrom(
            IERC20(asset),
            address(this),
            receiver,
            assets
        );

        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function maxRedeem(address owner)
        external
        view
        override
        returns (uint256 maxShares)
    {
        return balanceOf(owner);
    }

    function previewRedeem(uint256 shares)
        external
        view
        override
        returns (uint256 assets)
    {
        (int256 baseAmount, int256 quoteAmount) = IPerpdexExchange(exchange)
            .openPositionDry(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: true,
                    isExactInput: true,
                    amount: shares,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                }),
                address(this)
            );
        require((-baseAmount).toUint256() == shares);
        require(quoteAmount > 0);
        assets = quoteAmount.toUint256();
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {
        (int256 baseAmount, int256 quoteAmount) = IPerpdexExchange(exchange)
            .openPosition(
                IPerpdexExchange.OpenPositionParams({
                    market: market,
                    isBaseToQuote: true,
                    isExactInput: true,
                    amount: shares,
                    oppositeAmountBound: 0,
                    deadline: type(uint256).max
                })
            );
        require((-baseAmount).toUint256() == shares);
        require(quoteAmount > 0);

        assets = quoteAmount.toUint256();
        IPerpdexExchange(exchange).withdraw(assets);
        SafeERC20.safeTransferFrom(
            IERC20(asset),
            address(this),
            receiver,
            assets
        );
        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _getMarkPriceX96() private view returns (uint256) {
        return IPerpdexMarket(market).getMarkPriceX96();
    }

    function _getERC20Name(address marketArg)
        private
        view
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "PerpDEX Long ",
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(
                        IPerpdexExchange(IPerpdexMarket(marketArg).exchange())
                            .settlementToken()
                    ).symbol()
                )
            );
    }

    function _getERC20Symbol(address marketArg)
        private
        view
        returns (string memory)
    {
        return
            string(
                abi.encodePacked(
                    "pl",
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(
                        IPerpdexExchange(IPerpdexMarket(marketArg).exchange())
                            .settlementToken()
                    ).symbol()
                )
            );
    }
}
