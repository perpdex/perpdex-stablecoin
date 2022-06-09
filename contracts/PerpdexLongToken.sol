// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { IPerpdexExchange } from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import { PerpdexTokenBase } from "./PerpdexTokenBase.sol";

contract PerpdexLongToken is PerpdexTokenBase {
    using SafeCast for int256;

    constructor(address marketArg) PerpdexTokenBase(marketArg, "PerpDEX Long ", "pl") {}

    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {
        if (assets == 0) {
            return 0;
        }
        (int256 base, ) = _openPositionDry(false, true, assets);
        shares = base.toUint256();
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        (int256 base, ) = _openPosition(false, true, assets);

        shares = base.toUint256();
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function previewMint(uint256 shares) public view override returns (uint256 assets) {
        if (shares == 0) {
            return 0;
        }
        (, int256 quote) = _openPositionDry(false, false, shares);
        assets = (-quote).toUint256();
    }

    function mint(uint256 shares, address receiver) external override returns (uint256 assets) {
        require(shares != 0, "PLT_M: shares is zero");

        assets = previewMint(shares);

        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        (, int256 quote) = _openPosition(false, false, shares);
        require((-quote).toUint256() == assets, "PLT_M: assets not fully used");

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        if (assets == 0) {
            return 0;
        }
        (int256 base, ) = _openPositionDry(true, false, assets);
        shares = (-base).toUint256();
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256 shares) {
        require(assets != 0, "PLT_W: withdraw is zero");
        require(assets <= maxWithdraw(owner), "PLT_W: withdraw more than max");

        (int256 base, ) = _openPosition(true, false, assets);
        shares = (-base).toUint256();

        _withdraw(owner, receiver, shares, assets);
    }

    function previewRedeem(uint256 shares) external view override returns (uint256 assets) {
        if (shares == 0) {
            return 0;
        }
        (, int256 quote) = _openPositionDry(true, true, shares);
        assets = quote.toUint256();
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {
        require(shares != 0, "PLT_R: redeem is zero");
        require(shares <= maxRedeem(owner), "PLT_R: redeem more than max");

        (, int256 quote) = _openPosition(true, true, shares);
        assets = quote.toUint256();

        _withdraw(owner, receiver, shares, assets);
    }

    function _withdraw(
        address owner,
        address receiver,
        uint256 shares,
        uint256 assets
    ) private {
        // check if msg.sender has allowance of owner's shares
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // withdraw
        IPerpdexExchange(exchange).withdraw(assets);
        _assetSafeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
}
