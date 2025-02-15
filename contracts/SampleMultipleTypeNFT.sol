// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {BaseNFT} from "./BaseNFT.sol";

error InvalidMaxTokenType(uint256 maxTokenType);
error AlreadyAirdropped(uint256 tokenType, address to);

contract SampleMultipleTypeNFT is IERC4906, IAirdroppableNFT, BaseNFT {
    uint256 private constant _MIN_TOKEN_TYPE = 1;

    uint256 private _tokenIDCounter;

    mapping(uint256 tokenType => mapping(address to => bool isAirdropped))
        private _isAirdroppeds;

    constructor(
        uint256 maxTokenType_
    )
        BaseNFT(
            _msgSender(),
            "Sample Multiple Type NFT",
            "SMTNFT",
            _MIN_TOKEN_TYPE,
            maxTokenType_
        )
    {}

    function setMaxTokenType(uint256 maxTokenType_) external onlyOwner {
        _requireTokenTypeRangeNotFrozen();

        require(
            maxTokenType_ > _maxTokenType,
            InvalidMaxTokenType(maxTokenType_)
        );

        _maxTokenType = maxTokenType_;
    }

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdrop(address) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function airdropByType(
        address to_,
        uint256 tokenType_
    ) external onlyMinter whenNotPaused {
        _requireNotAirdropped(tokenType_, to_);

        _airdrop(to_, tokenType_, "");
    }

    function airdropWithTokenURI(address, string calldata) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function bulkAirdropByType(
        address[] calldata tos_,
        uint256 tokenType_
    ) external onlyMinter whenNotPaused {
        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tokenType_, tos_[i]);

            _airdrop(tos_[i], tokenType_, "");
        }
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _requireNotAirdropped(
        uint256 tokenType_,
        address to_
    ) private view {
        require(
            !_isAirdroppeds[tokenType_][to_],
            AlreadyAirdropped(tokenType_, to_)
        );
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
