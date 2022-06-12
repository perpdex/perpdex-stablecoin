// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { FullMath } from "@uniswap/v3-core/contracts/libraries/FullMath.sol";
import { IPerpdexExchange } from "../deps/perpdex-contract/contracts/interface/IPerpdexExchange.sol";
import { IPerpdexMarket } from "../deps/perpdex-contract/contracts/interface/IPerpdexMarket.sol";
import { IWETH9 } from "../deps/perpdex-contract/contracts/interface/external/IWETH9.sol";
import { IERC4626 } from "./interface/IERC4626.sol";
import { IERC20Metadata } from "./interface/IERC20Metadata.sol";

abstract contract PerpdexTokenBase is IERC4626, ReentrancyGuard, ERC20 {
    using SafeCast for int256;

    address public immutable override asset;
    address public immutable market;
    address public immutable exchange;
    address public immutable weth;

    modifier onlyWeth() {
        require(weth != address(0), "PTB_OW: weth is not available");
        _;
    }

    constructor(
        address marketArg,
        string memory namePrefix,
        string memory symbolPrefix,
        address wethArg
    ) ERC20(_getERC20Name(marketArg, namePrefix), _getERC20Symbol(marketArg, symbolPrefix)) {
        address exchangeVar = IPerpdexMarket(marketArg).exchange();
        address settlementToken = IPerpdexExchange(exchangeVar).settlementToken();
        address assetVar;

        if (settlementToken == address(0)) {
            require(wethArg != address(0), "PTB_C: weth is required");
            assetVar = wethArg;
        } else {
            require(wethArg == address(0), "PTB_C: weth can not be used");
            assetVar = settlementToken;
        }

        asset = assetVar;
        market = marketArg;
        weth = wethArg;
        exchange = exchangeVar;
    }

    // make ERC20 external functions non reentrant

    function transfer(address recipient, uint256 amount) public override nonReentrant returns (bool) {
        return ERC20.transfer(recipient, amount);
    }

    function approve(address spender, uint256 amount) public override nonReentrant returns (bool) {
        return ERC20.approve(spender, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override nonReentrant returns (bool) {
        return ERC20.transferFrom(sender, recipient, amount);
    }

    function increaseAllowance(address spender, uint256 addedValue) public override nonReentrant returns (bool) {
        return ERC20.increaseAllowance(spender, addedValue);
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public override nonReentrant returns (bool) {
        return ERC20.decreaseAllowance(spender, subtractedValue);
    }

    // ERC4626

    function totalAssets() public view override returns (uint256 totalManagedAssets) {
        int256 value = IPerpdexExchange(exchange).getTotalAccountValue(address(this));
        totalManagedAssets = value < 0 ? 0 : _convertToAssetDecimals(uint256(value));
    }

    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return FullMath.mulDiv(assets, 10**decimals(), 10**IERC20Metadata(asset).decimals());
        }
        return FullMath.mulDiv(assets, supply, totalAssets());
    }

    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return FullMath.mulDiv(shares, 10**IERC20Metadata(asset).decimals(), 10**decimals());
        }
        return FullMath.mulDiv(shares, totalAssets(), supply);
    }

    function _convertToPerpdexDecimals(uint256 amount) internal view returns (uint256 assets) {
        return
            FullMath.mulDiv(
                amount,
                10**IPerpdexExchange(exchange).quoteDecimals(),
                10**IERC20Metadata(asset).decimals()
            );
    }

    function _convertToAssetDecimals(uint256 amount) internal view returns (uint256 assets) {
        return
            FullMath.mulDiv(
                amount,
                10**IERC20Metadata(asset).decimals(),
                10**IPerpdexExchange(exchange).quoteDecimals()
            );
    }

    function _beforeTrade(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) private view returns (uint256) {
        if (isBaseToQuote) {
            if (!isExactInput) {
                return _convertToPerpdexDecimals(amount);
            }
        } else {
            if (isExactInput) {
                return _convertToPerpdexDecimals(amount);
            }
        }
        return amount;
    }

    function _afterTrade(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) private view returns (uint256) {
        if (isBaseToQuote) {
            if (isExactInput) {
                return _convertToAssetDecimals(amount);
            }
        } else {
            if (!isExactInput) {
                return _convertToAssetDecimals(amount);
            }
        }
        return amount;
    }

    function _maxTrade(bool isBaseToQuote, bool isExactInput) internal view returns (uint256 maxAmount) {
        maxAmount = IPerpdexExchange(exchange).maxTrade(
            IPerpdexExchange.MaxTradeParams({
                trader: address(this),
                market: market,
                caller: address(this),
                isBaseToQuote: isBaseToQuote,
                isExactInput: isExactInput
            })
        );

        maxAmount = _afterTrade(isBaseToQuote, isExactInput, maxAmount);
    }

    function _tryPreviewTrade(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) internal view returns (bool success, uint256 oppositeAmount) {
        amount = _beforeTrade(isBaseToQuote, isExactInput, amount);
        try
            IPerpdexExchange(exchange).previewTrade(
                IPerpdexExchange.PreviewTradeParams({
                    trader: address(this),
                    market: market,
                    caller: address(this),
                    isBaseToQuote: isBaseToQuote,
                    isExactInput: isExactInput,
                    amount: amount,
                    oppositeAmountBound: isExactInput ? 0 : type(uint256).max
                })
            )
        returns (uint256 v) {
            success = true;
            oppositeAmount = _afterTrade(isBaseToQuote, isExactInput, v);
        } catch {}
    }

    function _previewTrade(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) internal view returns (uint256 oppositeAmount) {
        amount = _beforeTrade(isBaseToQuote, isExactInput, amount);
        oppositeAmount = IPerpdexExchange(exchange).previewTrade(
            IPerpdexExchange.PreviewTradeParams({
                trader: address(this),
                market: market,
                caller: address(this),
                isBaseToQuote: isBaseToQuote,
                isExactInput: isExactInput,
                amount: amount,
                oppositeAmountBound: isExactInput ? 0 : type(uint256).max
            })
        );
        oppositeAmount = _afterTrade(isBaseToQuote, isExactInput, oppositeAmount);
    }

    function _trade(
        bool isBaseToQuote,
        bool isExactInput,
        uint256 amount
    ) internal returns (uint256 oppositeAmount) {
        amount = _beforeTrade(isBaseToQuote, isExactInput, amount);
        oppositeAmount = IPerpdexExchange(exchange).trade(
            IPerpdexExchange.TradeParams({
                trader: address(this),
                market: market,
                isBaseToQuote: isBaseToQuote,
                isExactInput: isExactInput,
                amount: amount,
                oppositeAmountBound: isExactInput ? 0 : type(uint256).max,
                deadline: type(uint256).max
            })
        );
        oppositeAmount = _afterTrade(isBaseToQuote, isExactInput, oppositeAmount);
    }

    function _depositToPerpdex(uint256 amount) internal {
        if (weth == address(0)) {
            IERC20(asset).approve(exchange, type(uint256).max);
        } else {
            IWETH9(weth).withdraw(amount);
        }
        IPerpdexExchange(exchange).deposit(amount);
    }

    function _withdrawFromPerpdex(uint256 amount) internal {
        IPerpdexExchange(exchange).withdraw(_convertToPerpdexDecimals(amount));
        if (weth != address(0)) {
            IWETH9(weth).deposit{ value: amount }();
        }
    }

    function _transferAssetTo(address to, uint256 amount) internal {
        if (weth != address(0)) {
            IWETH9(weth).deposit{ value: amount }();
        }
        SafeERC20.safeTransfer(IERC20(asset), to, amount);
    }

    function _transferAssetFromSender(uint256 amount) internal {
        address from = msg.sender;
        address to = address(this);
        SafeERC20.safeTransferFrom(IERC20(asset), from, to, amount);
        if (weth != address(0)) {
            IWETH9(weth).withdraw(amount);
        }
    }

    function _getERC20Name(address marketArg, string memory namePrefix) private view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    namePrefix,
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(IPerpdexExchange(IPerpdexMarket(marketArg).exchange()).settlementToken()).symbol()
                )
            );
    }

    function _getERC20Symbol(address marketArg, string memory symbolPrefix) private view returns (string memory) {
        return
            string(
                abi.encodePacked(
                    symbolPrefix,
                    IPerpdexMarket(marketArg).symbol(),
                    IERC20Metadata(IPerpdexExchange(IPerpdexMarket(marketArg).exchange()).settlementToken()).symbol()
                )
            );
    }

    // https://github.com/OpenZeppelin/openzeppelin-contracts/commit/c5a6cae8981d8005e22243b681745af92d44d1fc
    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            // solhint-disable-next-line reason-string
            require(amount <= currentAllowance, "ERC20: transfer amount exceeds allowance");
            _approve(owner, spender, currentAllowance - amount);
        }
    }
}
