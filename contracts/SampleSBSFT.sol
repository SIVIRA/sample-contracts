// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAirdroppableSFT} from "./IAirdroppableSFT.sol";
import {BaseSBSFT} from "./BaseSBSFT.sol";

contract SampleSBSFT is BaseSBSFT, IAirdroppableSFT {
    constructor() BaseSBSFT(_msgSender(), "") {}

    function airdrop(
        address to_,
        uint256 tokenID_,
        uint256 amount_
    ) external onlyMinter whenNotPaused {
        _mint(to_, tokenID_, amount_);
    }
}
