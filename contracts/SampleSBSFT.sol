// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IAirdroppableSFT} from "./IAirdroppableSFT.sol";
import {AbsSBSFT} from "./AbsSBSFT.sol";

contract SampleSBSFT is IAirdroppableSFT, AbsSBSFT {
    constructor() AbsSBSFT(_msgSender(), "") {}

    function airdrop(
        address to_,
        uint256 tokenID_,
        uint256 amount_
    ) external onlyMinter whenNotPaused {
        _mint(to_, tokenID_, amount_);
    }
}
