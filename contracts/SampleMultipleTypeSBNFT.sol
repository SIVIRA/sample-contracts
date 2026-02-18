// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {AbsSBNFT} from "./AbsSBNFT.sol";

contract SampleMultipleTypeSBNFT is IERC4906, IAirdroppableNFT, AbsSBNFT {
    error InvalidMaxTokenType(uint256 maxTokenType);
    error AlreadyAirdropped(address to);
    error NoTokensMinted();

    uint256 private constant INITIAL_TOKEN_ID = 0;

    uint256 private _tokenIDCounter = INITIAL_TOKEN_ID;

    mapping(address to => mapping(uint256 tokenType => bool))
        private _isAirdropped;

    constructor(
        uint256 minTokenType_,
        uint256 maxTokenType_
    )
        AbsSBNFT(
            _msgSender(),
            "Sample Multiple-type SBNFT",
            "SMTSBNFT",
            minTokenType_,
            maxTokenType_
        )
    {}

    function setMaxTokenType(uint256 maxTokenType_) external onlyOwner {
        _requireTokenTypeRangeNotFrozen();

        require(
            maxTokenType_ > _minTokenType,
            InvalidMaxTokenType(maxTokenType_)
        );

        _maxTokenType = maxTokenType_;
    }

    function setBaseTokenURI(string calldata baseTokenURI_) external onlyOwner {
        _baseTokenURI = baseTokenURI_;

        if (_tokenIDCounter > INITIAL_TOKEN_ID) {
            _refreshMetadata();
        }
    }

    function airdrop(address) external pure {
        revert UnsupportedFunction();
    }

    function airdropByType(
        address to_,
        uint256 tokenType_
    ) external onlyMinter whenNotPaused {
        require(!_isAirdropped[to_][tokenType_], AlreadyAirdropped(to_));

        _isAirdropped[to_][tokenType_] = true;

        _mint(to_, _tokenIDCounter, tokenType_);

        _tokenIDCounter++;
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
