// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { IPerpdexExchange } from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import { PerpdexTokenBase } from "./PerpdexTokenBase.sol";

contract PerpdexLongToken is PerpdexTokenBase {
    using SafeCast for int256;

    constructor(address marketArg) PerpdexTokenBase(marketArg, "PerpDEX Long ", "pl") {}

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        require(assets != 0, "PLT_D: deposit is zero");
        require(assets <= maxDeposit(msg.sender), "PLT_D: deposit more than max");

        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        (int256 base, ) = _openPosition(false, true, assets);

        shares = base.toUint256();
        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver) external override returns (uint256 assets) {
        require(shares != 0, "PLT_M: mint is zero");
        require(shares <= maxMint(msg.sender), "PLT_M: mint more than max");

        assets = previewMint(shares);

        _assetSafeTransferFrom(msg.sender, address(this), assets);
        _depositToPerpdex(assets);

        (, int256 quote) = _openPosition(false, false, shares);
        require((-quote).toUint256() == assets, "PLT_M: assets not fully used");

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
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

    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {
        (int256 base, ) = _previewOpenPosition(false, true, assets);
        shares = base.toUint256();
    }

    function previewMint(uint256 shares) public view override returns (uint256 assets) {
        (, int256 quote) = _previewOpenPosition(false, false, shares);
        assets = (-quote).toUint256();
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        (int256 base, ) = _previewOpenPosition(true, false, assets);
        shares = (-base).toUint256();
    }

    function previewRedeem(uint256 shares) external view override returns (uint256 assets) {
        (, int256 quote) = _previewOpenPosition(true, true, shares);
        assets = quote.toUint256();
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
        IPerpdexExchange(exchange).withdraw(assets);
        _assetSafeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
}
