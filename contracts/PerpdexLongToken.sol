// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import {SafeCast} from "@openzeppelin/contracts/utils/SafeCast.sol";
import {IPerpdexExchange} from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import {PerpdexTokenBase} from "./PerpdexTokenBase.sol";

contract PerpdexLongToken is PerpdexTokenBase {
    using SafeCast for int256;

    constructor(address marketArg)
        PerpdexTokenBase(marketArg, "PerpDEX Long ", "pl")
    {}

    function previewDeposit(uint256 assets)
        external
        view
        override
        returns (uint256 shares)
    {
        (int256 base, ) = _openPositionDry(false, true, assets);
        shares = base.toUint256();
    }

    function deposit(uint256 assets, address receiver)
        external
        override
        returns (uint256 shares)
    {
        _transferFrom(msg.sender, address(this), assets);
        IPerpdexExchange(exchange).deposit(assets);

        (int256 base, ) = _openPosition(false, true, assets);

        shares = base.toUint256();
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
        require(shares != 0, "PLT_M: shares is zero");

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
}
