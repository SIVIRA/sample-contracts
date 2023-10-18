// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {BaseSBT} from "./BaseSBT.sol";

error AlreadyAirdropped(address to);

contract SingleTypeSBT is IERC4906, BaseSBT {
    uint256 private constant _TOKEN_TYPE = 0;

    uint256 private _tokenIDCounter;

    mapping(address to => bool isAirdropped) private _isAirdroppeds;

    constructor()
        BaseSBT(
            _msgSender(),
            "Signle Type SBT",
            "STSBT",
            _TOKEN_TYPE,
            _TOKEN_TYPE
        )
    {
        _isTokenTypeRangeFrozen = true;
    }

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdrop(address to_) external onlyMinter whenNotPaused {
        _requireNotAirdropped(to_);

        _airdrop(to_, _TOKEN_TYPE, "");
    }

    function bulkAirdrop(
        address[] calldata tos_
    ) external onlyMinter whenNotPaused {
        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tos_[i]);

            _airdrop(tos_[i], _TOKEN_TYPE, "");
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
