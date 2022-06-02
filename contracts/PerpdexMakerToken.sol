// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {FullMath} from "@uniswap/lib/contracts/libraries/FullMath.sol";
import {IPerpdexExchange} from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import {IPerpdexMarket} from "../deps/perpdex-contract/contracts/interface/IPerpdexMarket.sol";
import {IERC20Metadata} from "./interface/IERC20Metadata.sol";
import {PerpdexTokenBase} from "./PerpdexTokenBase.sol";

contract PerpdexMakerToken is PerpdexTokenBase {
    using SafeCast for int256;
    using SafeMath for uint256;

    constructor(address marketArg)
        PerpdexTokenBase(marketArg, "PerpDEX Maker ", "pm")
    {}

    function previewDeposit(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        uint256 assetsMaker = assets.div(2);
        uint256 assetsTaker = assets - assetsMaker;

        (int256 base, ) = _openPositionDry(false, true, assetsTaker);
        (
            uint256 baseMaker,
            uint256 quoteMaker,
            uint256 liquidity
        ) = _addLiquidityDry(base.toUint256(), assetsMaker);

        return liquidity;
    }

    function deposit(uint256 assets, address receiver)
        external
        override
        returns (uint256 shares)
    {
        _transferFrom(msg.sender, address(this), assets);
        IPerpdexExchange(exchange).deposit(assets);

        uint256 assetsMaker = assets.div(2);
        uint256 assetsTaker = assets - assetsMaker;

        (int256 base, ) = _openPosition(false, true, assetsTaker);
        (
            uint256 baseMaker,
            uint256 quoteMaker,
            uint256 liquidity
        ) = _addLiquidity(base.toUint256(), assetsMaker);

        shares = liquidity;
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function previewMint(uint256 shares)
        public
        view
        override
        returns (uint256 assets)
    {
        (, int256 quote) = _openPositionDry(false, false, shares);
        assets = (-quote).toUint256();
    }

    function mint(uint256 shares, address receiver)
        external
        override
        returns (uint256 assets)
    {
        require(shares != 0, "shares is zero");

        assets = previewMint(shares);
        _transferFrom(msg.sender, address(this), assets);
        IPerpdexExchange(exchange).deposit(assets);

        (, int256 quote) = _openPosition(false, false, shares);
        require((-quote).toUint256() == assets);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function previewWithdraw(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        (int256 base, ) = _openPositionDry(true, false, assets);
        shares = (-base).toUint256();
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256 shares) {
        (int256 base, ) = _openPosition(true, false, assets);
        shares = (-base).toUint256();

        IPerpdexExchange(exchange).withdraw(assets);
        _transferFrom(address(this), receiver, assets);

        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function previewRedeem(uint256 shares)
        external
        view
        override
        returns (uint256 assets)
    {
        (, int256 quote) = _openPositionDry(true, true, shares);
        assets = quote.toUint256();
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {
        (, int256 quote) = _openPosition(true, true, shares);

        assets = quote.toUint256();
        IPerpdexExchange(exchange).withdraw(assets);
        _transferFrom(address(this), receiver, assets);
        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _addLiquidityDry(uint256, uint256)
        private
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // TODO:
        // _validateAddLiquidityResult
        return (0, 0, 0);
    }

    function _addLiquidity(uint256, uint256)
        private
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        // TODO:
        // _validateAddLiquidityResult
        return (0, 0, 0);
    }

    function _validateAddLiquidityResult(
        uint256,
        uint256,
        uint256,
        uint256
    ) private pure {}
}
