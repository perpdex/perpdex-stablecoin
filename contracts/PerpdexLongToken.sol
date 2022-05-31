// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import {IERC4626} from "./interfaces/IERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import "../deps/perpdex-contract/contracts/interface/IPerpdexMarket.sol";
import "../deps/perpdex-contract/contracts/lib/PerpMath.sol";
import "../deps/perpdex-contract/contracts/lib/PerpSafeCast.sol";

// TODO: remove comment in japanese
// 前提:
// - 1. assetは証拠金と同じtoken
// - 2. marketのquoteはassetと同じ単位.
contract PerpdexLongToken is IERC4626, ERC20 {
    using PerpMath for int256;
    using PerpMath for uint256;
    using PerpSafeCast for int256;
    using PerpSafeCast for uint256;

    address private immutable _asset;
    IPerpdexMarket private market;
    IPerpdexExchange private perpdex;

    constructor(
        address asset_,
        IPerpdexMarket market_,
        IPerpdexExchange memory perpdex_
    ) ERC20("PerpDEX Tokenized Long Position", "PTLP") {
        // TODO: require. asset_ must be the address of perpdex collateral
        _asset = asset_;
        market = market_;
        perpdex = perpdex_;
    }

    function asset() external view returns (address assetTokenAddress) {
        return _asset;
    }

    function totalAssets() public view virtual returns (uint256 totalManagedAssets) {
        int256 value = perpdex.getTotalAccountValue(address(this));
        totalManagedAssets = value < 0 ? 0 : uint256(value);
    }

    function convertToShares(uint256 assets) public view override returns(uint256 shares) {
        // 理想上のshares
        return _convertToShares(assets, Math.Rounding.Down);
    }

    function convertToAssets(uint256 shares) public view override returns(uint256 assets) {
        // 理想上のassets
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    function maxDeposit(address receiver) external view returns (uint256 maxAssets) {
        // 証拠金のmax(type(PerpdexStructs.TakerInfo.quoteBalance).max)
        return uint256(type(int256).max);
    }

    function previewDeposit(uint256 assets) public view returns (uint256 shares) {
        // fee込. 実際に発行されるshares以下になるように見積もらないといけない
        // TODO: include deposit fee
        //       trade feeがdepositのfeeと捉えるなら、trade feeを考慮する必要あり. 
        //       markPriceとfeeRatioから計算する？
        return _convertToShares(assets, Math.Rounding.Down);
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        // load amount of total wETH before opening long
        uint256 totalAssets = totalAssets();

        // transfer wETH to contract
        SafeERC20.safeTransferFrom(IERC20(_asset), msg.sender, address(this), assets);

        // deposit wETH to perpdex
        perpdex.deposit(assets);

        // open long using the exact `assets` amount of quote on perpdex
        // note: quoteAmount == assets
        (int256 baseAmount, int256 quoteAmount) = perpdex.openPosition(
            IPerpdexExchange.OpenPositionParams({
                market: market,
                isBaseToQuote: false,
                isExactInput: true,
                amount: assets,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            })
        );

        // in order to include traiding fee, calculate shares using baseAmount
        // TODO: is this calculation correct?
        int256 baseAmountAssets = baseAmount * _getMarkPrice();
        shares = (baseAmountAssets / totalAssets) * totalSupply();
        
        require(shares != 0, "shares is zero");

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function maxMint(address receiver) external view returns (uint256 maxShares) {
        return type(unit256).max;
    }

    function previewMint(uint256 shares) public view virtual returns (uint256 assets) {
        // fee込. 実際に使われるassets以上になるように見積もらないといけない
        // TODO: include deposit fee (trading fee)
        return _convertToAssets(shares, Math.Rounding.Up);
    }

    function mint(uint256 shares, address receviver) external override returns (uint256 assets) {
        require(shares != 0, "shares is zero");

        // transfer wETH to contract
        uint256 assetsPreview = previewMint(shares);
        SafeERC20.safeTransferFrom(IERC20(_asset), msg.sender, address(this), assetsPreview);

        // deposit wETH to perpdex
        perpdex.deposit(assetsPreview);

        // open the exact `shares` amount of base long on perpdex
        // TODO: add support of this feature in perpdex?
        // note: baseAmount == shares
        (int256 baseAmount, int256 quoteAmount) = perpdex.openPosition(
            IPerpdexExchange.OpenPositionParams({
                market: market,
                isBaseToQuote: true,
                isExactInput: true,
                amount: shares,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            })
        );

        // transfer back left assets to sender
        uint256 leftAssets = assetsPreview - quoteAmount.toUint256();
        perpdex.withdraw(leftAssets);
        SafeERC20.safeTransferFrom(IERC20(_asset), address(this), msg.sender, leftAssets);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function maxWithdraw(address owner) external view returns (uint256 maxAssets) {
        return _convertToAssets(balanceOf(owner), Math.Rounding.Down);
    }

    function previewWithdraw(uint256 assets) external view returns (uint256 shares) {
        // fee込. 多めに見積もる必要あり
        // TODO: include withdrawal fee 
        return _convertToShares(assets, Math.Rounding.Up);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        // load amount of total wETH before opening long
        uint256 totalAssets = totalAssets();

        // close the exact `assets` amount of quote long
        // TODO: add support of this feature in perpdex?
        // note: quoteAmount == assets
        (int256 baseAmount, int256 quoteAmount) = perpdex.openPosition(
            IPerpdexExchange.OpenPositionParams({
                market: market,
                isBaseToQuote: true,
                isExactInput: true,
                amount: assets,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            })
        ); 

        // in order to include traiding fee,
        // calculate shares using baseAmount
        int256 baseAmountAssets = baseAmount * _getMarkPrice();
        shares = (baseAmountAssets / totalAssets) * totalSupply();
        
        require(shares != 0, "shares is zero");

        // withdraw contract asset from perpdex
        perpdex.withdraw(assets);

        // transfer assets to receiver
        SafeERC20.safeTransferFrom(IERC20(asset), address(this), receiver, assets);

        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function maxRedeem(address owner) external view returns (uint256 maxShares) {
        return balanceOf(owner);
    }

    function previewRedeem(uint256 shares) external view returns (uint256 assets) {
        // fee込. 少なく見積もらないといけない
        return _convertToAssets(shares, Math.Rounding.Down);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        int256 assets  = previewRedeem(shares);

        // close the exact `assets` amount of quote long on perpdex.
        (int256 baseAmount, int256 quoteAmount) = perpdex.openPosition(
            IPerpdexExchange.ClosePositionParams({
                market: market,
                isBaseToQuote: false,
                isExactInput: true,
                amount: assets,
                oppositeAmountBound: 0,
                deadline: type(uint256).max
            })
        ); 

        // withdraw contract asset from perpdex
        perpdex.withdraw(assets);

        // transfer assets to receiver
        SafeERC20.safeTransferFrom(IERC20(asset), address(this), receiver, assets);

        // burn shares of owner
        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function _convertToShares(uint256 assets, Math.Rounding direction) internal view virtual returns (uint256 shares) {
        uint256 supply = totalSupply();
        return
            (assets == 0 || supply == 0)
                ? assets.mulDiv(10**decimals(), 10**ERC20(_asset).decimals(), direction)
                : assets.mulDiv(supply, totalAssets(), direction);
    }

    function _convertToAssets(uint256 shares, Math.Rounding direction) internal view virtual returns (uint256 assets) {
        uint256 supply = totalSupply();
        return
            (supply == 0)
                ? shares.mulDiv(10**ERC20(_asset).decimals(), 10**decimals(), direction)
                : shares.mulDiv(totalAssets(), supply, direction);
    }

    function _getMarkPrice() private view returns (uint256) {
        require(false, "not implemented yet");
    }
}