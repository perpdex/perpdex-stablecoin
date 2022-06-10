// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

library PerpdexTokenMath {
    function minUint256(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
