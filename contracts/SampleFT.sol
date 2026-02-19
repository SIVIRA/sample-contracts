// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IAirdroppableFT} from "./IAirdroppableFT.sol";
import {AbsFT} from "./AbsFT.sol";

contract SampleFT is IAirdroppableFT, AbsFT {
    constructor(
        uint256 holdingAmountThreshold_
    ) AbsFT(_msgSender(), "Sample FT", "SFT", holdingAmountThreshold_) {}

    function airdrop(
        address to_,
        uint256 amount_
    ) external override onlyMinter whenNotPaused {
        _mint(to_, amount_);
    }
}
