// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAirdroppableFT} from "./IAirdroppableFT.sol";
import {BaseFT} from "./BaseFT.sol";

contract SampleFT is IAirdroppableFT, BaseFT {
    constructor(
        uint256 holdingAmountThreshold_
    ) BaseFT(_msgSender(), "Sample FT", "SFT", holdingAmountThreshold_) {}

    function airdrop(
        address to_,
        uint256 amount_
    ) external override onlyMinter whenNotPaused {
        _mint(to_, amount_);
    }
}
