// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/lib/contracts/libraries/FullMath.sol";
import "@uniswap/lib/contracts/libraries/FixedPoint96.sol";
import "./IERC4626.sol";
import "./IStrategy.sol";
import "../deps/perpdex-contract/contracts/interface/IAccountBalance.sol";
import "../deps/perpdex-contract/contracts/interface/IClearingHousePerpdex.sol";
import "../deps/perpdex-contract/contracts/interface/IExchangePerpdex.sol";
import "../deps/perpdex-contract/contracts/interface/IVault.sol";
import "../deps/perpdex-contract/contracts/lib/PerpMath.sol";

contract PUSD is IERC4626, ERC20 {
    using PerpMath for uint160;
    uint constant Q96 = 0x1000000000000000000000000;

    address public override asset;

    IClearingHousePerpdex public clearingHouse;
    IVault public vault;
    IAccountBalance public accountBalance;
    IExchangePerpdex public exchange;

    constructor(address asset_, address clearingHouse_) ERC20("Perpdex USD", "PUSD") {
        asset = asset_;
        clearingHouse = clearingHouse_;
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

    function rebalance() public {
        require(false, "not implemented");
    }

    // views

    function totalAssets() external view override returns (uint totalManagedAssets) {
        int accountValue = clearingHouse.getAccountValue(address(this));
        return accountValue < 0 ? 0 : uint(accountValue);
    }

    function convertToShares(uint assets) external view override returns(uint shares) {
        return FullMath.mulDiv(assets, Q96, _getPriceX96());
    }

    function convertToAssets(uint shares) external view override returns(uint assets) {
        return FullMath.mulDiv(assets, _getPriceX96(), Q96);
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

    // private

    function _getPriceX96() private pure returns(uint) {
        uint160 sqrtPriceX96 = exchange.getSqrtMarkPriceX96(baseToken);
        return sqrtPriceX96.formatSqrtPriceX96ToPriceX96();
    }
}
