// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAirdroppableSFT} from "./IAirdroppableSFT.sol";
import {BaseSFT} from "./BaseSFT.sol";

contract SampleSFT is BaseSFT, IAirdroppableSFT {
    constructor(address owner_) BaseSFT(owner_, "") {}

    function airdrop(
        address to,
        uint256 tokenID,
        uint256 amount
    ) external onlyMinter whenNotPaused {
        _mint(to, tokenID, amount);
    }
}
