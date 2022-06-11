// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { Math } from "@openzeppelin/contracts/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { IPerpdexExchange } from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import { PerpdexTokenBase } from "./PerpdexTokenBase.sol";

contract PerpdexLongToken is PerpdexTokenBase {
    using SafeCast for int256;

    constructor(address marketArg) PerpdexTokenBase(marketArg, "PerpDEX Long ", "pl") {}

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        shares = _trade(false, true, assets);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) external override returns (uint256 assets) {
        assets = previewMint(shares);

        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        uint256 oppositeAmount = _trade(false, false, shares);
        // assets not fully used
        require(oppositeAmount == assets, "PLT_M: (never reach) ANFU");

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256 shares) {
        shares = _trade(true, false, assets);

        _withdraw(owner, receiver, shares, assets);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {
        assets = _trade(true, true, shares);

        _withdraw(owner, receiver, shares, assets);
    }

    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {
        shares = _previewTrade(false, true, assets);
    }

    function previewMint(uint256 shares) public view override returns (uint256 assets) {
        assets = _previewTrade(false, false, shares);
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        shares = _previewTrade(true, false, assets);
    }

    function previewRedeem(uint256 shares) external view override returns (uint256 assets) {
        assets = _previewTrade(true, true, shares);
    }

    function maxDeposit(address) public view override returns (uint256 maxAssets) {
        return _maxTrade(false, true);
    }

    function maxMint(address) public view override returns (uint256 maxShares) {
        return _maxTrade(false, false);
    }

    function maxWithdraw(address owner) public view override returns (uint256 maxAssets) {
        maxAssets = _maxTrade(true, false);
        (bool success, uint256 previewAssets) = _tryPreviewTrade(true, false, balanceOf(owner));
        if (success) {
            maxAssets = Math.min(maxAssets, previewAssets);
        }
    }

    function maxRedeem(address owner) public view override returns (uint256 maxShares) {
        return Math.min(balanceOf(owner), _maxTrade(true, true));
    }

    function _withdraw(
        address owner,
        address receiver,
        uint256 shares,
        uint256 assets
    ) internal {
        // check if msg.sender has allowance of owner's vault shares
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // withdraw
        IPerpdexExchange(exchange).withdraw(_convertToPerpdexDecimals(assets));
        _assetSafeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
}
