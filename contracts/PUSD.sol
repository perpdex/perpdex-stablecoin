// SPDX-License-Identifier: CC0-1.0

pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IERC4626.sol";
import "./IStrategy.sol";

contract PUSD is IERC4626, ERC20 {
    address public override asset;

    constructor(address asset_) ERC20("Perpdex USD", "PUSD") {
        asset = asset_;
    }

    function mint(uint shares, address receiver)
    external override returns (uint assets) {
        require(false, "not implemented");
    }

    function deposit(uint assets, address receiver)
    external override returns (uint shares) {
        SafeERC20.safeTransferFrom(IERC20(asset), msg.sender, address(this), assets);

        uint sharesPreview = previewDeposit(assets);
        shares = sharesPreview;

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint shares, address receiver, address owner)
    external override returns (uint assets) {
        _burn(owner, shares);

        uint assetsPreview = previewRedeem(shares);
        assets = assetsPreview;

        SafeERC20.safeTransferFrom(IERC20(asset), address(this), receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function withdraw(uint assets, address receiver, address owner)
    external override returns (uint shares) {
        require(false, "not implemented");
    }

    function rebalance() external {
        require(false, "not implemented");
    }

    // views

    function totalAssets() external view override returns (uint totalManagedAssets) {
        require(false, "not implemented");
    }

    function convertToShares(uint assets) external view override returns(uint shares) {
        require(false, "not implemented");
    }

    function convertToAssets(uint shares) external view override returns(uint assets) {
        require(false, "not implemented");
    }

    function maxDeposit(address receiver) external view override returns(uint maxAssets) {
        require(false, "not implemented");
    }

    function previewDeposit(uint assets) public view override returns(uint shares) {
        require(false, "not implemented");
    }

    function maxMint(address receiver) external view override returns(uint maxShares) {
        require(false, "not implemented");
    }

    function previewMint(uint shares) external view override returns(uint assets) {
        require(false, "not implemented");
    }

    function maxWithdraw(address owner) external view override returns(uint maxAssets) {
        require(false, "not implemented");
    }

    function previewWithdraw(uint assets) external view override returns(uint shares) {
        require(false, "not implemented");
    }

    function maxRedeem(address owner) external view override returns(uint maxShares) {
        require(false, "not implemented");
    }

    function previewRedeem(uint shares) public view override returns(uint assets) {
        require(false, "not implemented");
    }
}
