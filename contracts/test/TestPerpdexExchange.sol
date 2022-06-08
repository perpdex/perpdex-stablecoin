// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;
pragma abicoder v2;

import { PerpdexExchange } from "../../deps/perpdex-contract/contracts/PerpdexExchange.sol";
import { PerpdexStructs } from "../../deps/perpdex-contract/contracts/lib/PerpdexStructs.sol";

contract TestPerpdexExchange is PerpdexExchange {
    constructor(address settlementTokenArg) PerpdexExchange(settlementTokenArg) {}

    function setAccountInfo(
        address trader,
        PerpdexStructs.VaultInfo memory vaultInfo,
        address[] memory markets
    ) external {
        accountInfos[trader].vaultInfo = vaultInfo;
        accountInfos[trader].markets = markets;
    }
}
