// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {BaseNFT} from "./BaseNFT.sol";

error InvalidTokenType(uint256 tokenType);
error AlreadyAirdropped(uint256 tokenType, address to);

contract MultipleTypeNFT is IERC4906, BaseNFT {
    uint256 private constant MIN_TOKEN_TYPE = 1;
    uint256 private constant MAX_TOKEN_TYPE = 8;

    uint256 private _tokenIDCounter;

    mapping(uint256 tokenType => mapping(address to => bool isAirdropped))
        private _isAirdroppeds;

    constructor() BaseNFT(_msgSender(), "Multiple Type NFT", "MTNFT") {}

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdropByType(
        address to_,
        uint256 tokenType_
    ) external onlyMinter whenNotPaused {
        _requireValidTokenType(tokenType_);
        _requireNotAirdropped(tokenType_, to_);

        _airdrop(to_, tokenType_, "");
    }

    function bulkAirdropByType(
        address[] calldata tos_,
        uint256 tokenType_
    ) external onlyMinter whenNotPaused {
        _requireValidTokenType(tokenType_);

        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tokenType_, tos_[i]);

            _airdrop(tos_[i], tokenType_, "");
        }
    }

    function burn(uint256 tokenID_) external {
        _checkAuthorized(ownerOf(tokenID_), _msgSender(), tokenID_);

        _burn(tokenID_);
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _requireValidTokenType(uint256 tokenType_) private pure {
        if (tokenType_ < MIN_TOKEN_TYPE || MAX_TOKEN_TYPE < tokenType_) {
            revert InvalidTokenType(tokenType_);
        }
    }

    function _requireNotAirdropped(
        uint256 tokenType_,
        address to_
    ) private view {
        if (_isAirdroppeds[tokenType_][to_]) {
            revert AlreadyAirdropped(tokenType_, to_);
        }
    }

    function _mintedAmount() private view returns (uint256) {
        return _tokenIDCounter;
    }

    function _airdrop(
        address to_,
        uint256 tokenType_,
        string memory tokenURI_
    ) private {
        _isAirdroppeds[tokenType_][to_] = true;

        _mint(to_, _tokenIDCounter, tokenType_);

        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[_tokenIDCounter] = tokenURI_;
        }

        _tokenIDCounter++;
    }

    function _refreshMetadata() private {
        if (_mintedAmount() == 1) {
            emit MetadataUpdate(0);
        } else if (_mintedAmount() > 1) {
            emit BatchMetadataUpdate(0, _mintedAmount() - 1);
        }
    }
}
