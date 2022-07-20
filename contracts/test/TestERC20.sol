// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract TestERC20 is ERC20PresetMinterPauser {
    uint256 _transferFeeRatio;

    uint8 private immutable _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimalsArg
    ) ERC20PresetMinterPauser(name, symbol) {
        _decimals = decimalsArg;
        _transferFeeRatio = 0;
    }

    function approveForce(
        address from,
        address to,
        uint256 amount
    ) external {
        _approve(from, to, amount);
    }

    // WETH interface

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
