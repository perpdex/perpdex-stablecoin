// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

contract TestERC20 is ERC20PresetMinterPauser {
    uint256 _transferFeeRatio;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal
    ) ERC20PresetMinterPauser(name, symbol) {
        _setupDecimals(decimal);
        _transferFeeRatio = 0;
    }

    function setMinter(address minter) external {
        grantRole(MINTER_ROLE, minter);
    }

    function approveForce(
        address from,
        address to,
        uint256 amount
    ) external {
        _approve(from, to, amount);
    }
}
