// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {BaseNFT} from "./BaseNFT.sol";

error AlreadyAirdropped(address to);

contract SingleTypeNFT is IERC4906, BaseNFT {
    uint256 private _tokenIDCounter;

    mapping(address to => bool isAirdropped) private _isAirdroppeds;

    constructor() BaseNFT(_msgSender(), "Signle Type NFT", "STNFT") {}

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdrop(address to_) external onlyMinter whenNotPaused {
        _requireNotAirdropped(to_);

        _airdrop(to_, 0, "");
    }

    function bulkAirdrop(
        address[] calldata tos_
    ) external onlyMinter whenNotPaused {
        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tos_[i]);

            _airdrop(tos_[i], 0, "");
        }
    }

    function burn(uint256 tokenID_) external {
        _checkAuthorized(ownerOf(tokenID_), _msgSender(), tokenID_);

        _burn(tokenID_);
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _requireNotAirdropped(address to_) private view {
        if (_isAirdroppeds[to_]) {
            revert AlreadyAirdropped(to_);
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
        _isAirdroppeds[to_] = true;

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
