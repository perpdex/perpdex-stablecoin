// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { Math } from "@openzeppelin/contracts/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { PerpdexTokenBase } from "./PerpdexTokenBase.sol";

// This class should be responsible for the high layers and not the low layers
// Specifically, you should not rely directly on decimals, WETH, Perpdex
// Let PerpdexTokenBase absorb those specifications
contract PerpdexLongToken is PerpdexTokenBase {
    using SafeCast for int256;
    using SafeMath for uint256;

    constructor(address marketArg, address wethArg) PerpdexTokenBase(marketArg, "PerpDEX Long ", "pl", wethArg) {}

    function depositETH(address receiver) external payable onlyWeth nonReentrant returns (uint256) {
        return _doDeposit(msg.value, receiver);
    }

    function deposit(uint256 assets, address receiver) external override nonReentrant returns (uint256 shares) {
        _transferAssetFromSender(assets);
        return _doDeposit(assets, receiver);
    }

    function _doDeposit(uint256 assets, address receiver) private returns (uint256 shares) {
        _depositToPerpdex(assets);
        shares = _trade(false, true, assets);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mintETH(uint256 shares, address receiver) external payable onlyWeth nonReentrant returns (uint256 assets) {
        assets = previewMint(shares);
        uint256 exceeded = msg.value.sub(assets);
        if (exceeded > 0) {
            msg.sender.transfer(exceeded);
        }
        _doMint(assets, shares, receiver);
    }

    function mint(uint256 shares, address receiver) external override nonReentrant returns (uint256 assets) {
        assets = previewMint(shares);
        _transferAssetFromSender(assets);
        _doMint(assets, shares, receiver);
    }

    function _doMint(
        uint256 assets,
        uint256 shares,
        address receiver
    ) private {
        _depositToPerpdex(assets);
        uint256 oppositeAmount = _trade(false, false, shares);
        require(oppositeAmount == assets, "PLT_M: (never reach) ANFU");
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdrawETH(
        uint256 assets,
        address payable receiver,
        address owner
    ) external onlyWeth nonReentrant returns (uint256 shares) {
        shares = _trade(true, false, assets);
        _doWithdraw(owner, receiver, shares, assets);
        receiver.transfer(assets);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override nonReentrant returns (uint256 shares) {
        shares = _trade(true, false, assets);
        _doWithdraw(owner, receiver, shares, assets);
        _transferAssetTo(receiver, assets);
    }

    function redeemETH(
        uint256 shares,
        address payable receiver,
        address owner
    ) external onlyWeth nonReentrant returns (uint256 assets) {
        assets = _trade(true, true, shares);
        _doWithdraw(owner, receiver, shares, assets);
        receiver.transfer(assets);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override nonReentrant returns (uint256 assets) {
        assets = _trade(true, true, shares);
        _doWithdraw(owner, receiver, shares, assets);
        _transferAssetTo(receiver, assets);
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

    function _doWithdraw(
        address owner,
        address receiver,
        uint256 shares,
        uint256 assets
    ) private {
        // check if msg.sender has allowance of owner's vault shares
        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _burn(owner, shares);

        // withdraw
        _withdrawFromPerpdex(assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }
}
