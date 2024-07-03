// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAirdroppableSFT} from "./IAirdroppableSFT.sol";
import {BaseSBSFT} from "./BaseSBSFT.sol";

contract SampleSBSFT is BaseSBSFT, IAirdroppableSFT {
    constructor(address owner_) BaseSBSFT(owner_, "") {}

    function airdrop(
        address to,
        uint256 tokenID,
        uint256 amount
    ) external onlyMinter whenNotPaused {
        _mint(to, tokenID, amount);
    }
}
