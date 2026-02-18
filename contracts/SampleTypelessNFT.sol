// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {AbsNFT} from "./AbsNFT.sol";

contract SampleTypelessNFT is IERC4906, IAirdroppableNFT, AbsNFT {
    error NoTokensMinted();

    uint256 private constant INITIAL_TOKEN_ID = 0;

    uint256 private _tokenIDCounter = INITIAL_TOKEN_ID;

    constructor() AbsNFT(_msgSender(), "Sample Typeless NFT", "STNFT", 0, 0) {
        _isTokenTypeRangeFrozen = true;
    }

    function airdrop(address) external pure {
        revert UnsupportedFunction();
    }

    function airdropByType(address, uint256) external pure {
        revert UnsupportedFunction();
    }

    function airdropWithTokenURI(
        address to_,
        string calldata tokenURI_
    ) external onlyMinter whenNotPaused {
        _mint(to_, _tokenIDCounter, 0);

        _tokenURI[_tokenIDCounter] = tokenURI_;

        _tokenIDCounter++;
    }

    function refreshMetadata() external onlyOwner {
        require(_tokenIDCounter > INITIAL_TOKEN_ID, NoTokensMinted());

        emit BatchMetadataUpdate(INITIAL_TOKEN_ID, _tokenIDCounter - 1);
    }
}
