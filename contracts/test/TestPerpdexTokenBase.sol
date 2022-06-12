// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { PerpdexTokenBase } from "../PerpdexTokenBase.sol";

// for testing internal method
contract TestPerpdexTokenBase is PerpdexTokenBase {
    constructor(
        address marketArg,
        string memory namePrefix,
        string memory symbolPrefix,
        address wethArg
    ) PerpdexTokenBase(marketArg, namePrefix, symbolPrefix, wethArg) {}

    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {}

    function previewMint(uint256 shares) external view override returns (uint256 assets) {}

    function previewWithdraw(uint256 assets) external view override returns (uint256 shares) {}

    function previewRedeem(uint256 shares) external view override returns (uint256 assets) {}

    function maxDeposit(address receiver) external view override returns (uint256 maxAssets) {}

    function maxMint(address receiver) external view override returns (uint256 maxShares) {}

    function maxWithdraw(address owner) external view override returns (uint256 maxAssets) {}

    function maxRedeem(address owner) external view override returns (uint256 maxShares) {}

    function mint(uint256 shares, address receiver) external override returns (uint256 assets) {}

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {}

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256 assets) {}

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256 shares) {}

    // for unit test
    function spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) external {
        _spendAllowance(owner, spender, amount);
    }
}
