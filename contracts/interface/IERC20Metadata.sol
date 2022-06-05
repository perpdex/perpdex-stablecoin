// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Metadata is IERC20 {
    function symbol() external view returns (string memory);
}
