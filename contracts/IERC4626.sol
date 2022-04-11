// SPDX-License-Identifier: CC0-1.0

pragma solidity ^0.8.0;

// https://eips.ethereum.org/EIPS/eip-4626
interface IERC4626 {
    event Deposit(
        address indexed caller,
        address indexed owner,
        uint assets,
        uint shares
    );

    event Withdraw(
        address indexed caller,
        address indexed receiver,
        address indexed owner,
        uint assets,
        uint shares
    );

    function asset() external view virtual returns (address assetTokenAddress);
    function totalAssets() external view virtual returns(uint totalManagedAssets);

    function convertToShares(uint assets) external view virtual returns(uint shares);
    function convertToAssets(uint shares) external view virtual returns(uint assets);

    function maxDeposit(address receiver) external view virtual returns(uint maxAssets);
    function previewDeposit(uint assets) external view virtual returns(uint shares);

    function maxMint(address receiver) external view virtual returns(uint maxShares);
    function previewMint(uint shares) external view virtual returns(uint assets);

    function maxWithdraw(address owner) external view virtual returns(uint maxAssets);
    function previewWithdraw(uint assets) external view virtual returns(uint shares);

    function maxRedeem(address owner) external view virtual returns(uint maxShares);
    function previewRedeem(uint shares) external view virtual returns(uint assets);

    function mint(uint shares, address receiver)
    external virtual returns (uint assets);

    function deposit(uint assets, address receiver)
    external virtual returns (uint shares);

    function redeem(uint shares, address receiver, address owner)
    external virtual returns (uint assets);

    function withdraw(uint assets, address receiver, address owner)
    external virtual returns (uint shares);
}
