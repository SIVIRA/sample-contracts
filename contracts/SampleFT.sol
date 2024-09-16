// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAirdroppableFT} from "./IAirdroppableFT.sol";
import {BaseFT} from "./BaseFT.sol";

contract SampleFT is IAirdroppableFT, BaseFT {
    constructor() BaseFT(_msgSender(), "Sample FT", "SFT", 1) {}

    function airdrop(
        address to_,
        uint256 amount_
    ) external override onlyMinter whenNotPaused {
        _mint(to_, amount_);
    }
}
