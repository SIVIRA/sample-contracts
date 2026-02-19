// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {AbsSBNFT} from "./AbsSBNFT.sol";

contract SampleSingleTypeSBNFT is IERC4906, IAirdroppableNFT, AbsSBNFT {
    error AlreadyAirdropped(address to);
    error NoTokensMinted();

    uint256 private constant INITIAL_TOKEN_ID = 0;

    uint256 private _tokenIDCounter = INITIAL_TOKEN_ID;

    mapping(address to => bool) private _isAirdropped;

    constructor()
        AbsSBNFT(_msgSender(), "Sample Single-type SBNFT", "SSTSBNFT", 0, 0)
    {
        _isTokenTypeRangeFrozen = true;
    }

    function setBaseTokenURI(string calldata baseTokenURI_) external onlyOwner {
        _baseTokenURI = baseTokenURI_;

        if (_tokenIDCounter > INITIAL_TOKEN_ID) {
            _refreshMetadata();
        }
    }

    function airdrop(address to_) external onlyMinter whenNotPaused {
        require(!_isAirdropped[to_], AlreadyAirdropped(to_));

        _isAirdropped[to_] = true;

        _mint(to_, _tokenIDCounter, 0);

        _tokenIDCounter++;
    }

    function airdropByType(address, uint256) external pure {
        revert UnsupportedFunction();
    }

    function airdropWithTokenURI(address, string calldata) external pure {
        revert UnsupportedFunction();
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _refreshMetadata() private {
        require(_tokenIDCounter > INITIAL_TOKEN_ID, NoTokensMinted());

        emit BatchMetadataUpdate(INITIAL_TOKEN_ID, _tokenIDCounter - 1);
    }
}
