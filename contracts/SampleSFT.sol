// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IAirdroppableSFT} from "./IAirdroppableSFT.sol";
import {BaseSFT} from "./BaseSFT.sol";

contract SampleSFT is BaseSFT, IAirdroppableSFT {
    constructor() BaseSFT(_msgSender(), "") {}

    function airdrop(
        address to_,
        uint256 tokenID_,
        uint256 amount_
    ) external onlyMinter whenNotPaused {
        _mint(to_, tokenID_, amount_);
    }
}
