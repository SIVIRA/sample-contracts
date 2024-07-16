// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAirdroppableFT} from "./IAirdroppableFT.sol";
import {BaseFT} from "./BaseFT.sol";

contract SampleFT is IAirdroppableFT, BaseFT {
    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint256 holdlingThreshold_
    ) BaseFT(owner_, name_, symbol_, holdlingThreshold_) {}

    function airdrop(
        address to_,
        uint256 amount_
    ) external override onlyMinter {
        _mint(to_, amount_);
    }
}
