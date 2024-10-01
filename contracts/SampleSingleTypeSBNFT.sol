// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {BaseSBNFT} from "./BaseSBNFT.sol";

error AlreadyAirdropped(address to);

contract SampleSingleTypeSBNFT is IERC4906, IAirdroppableNFT, BaseSBNFT {
    uint256 private constant _TOKEN_TYPE = 0;

    uint256 private _tokenIDCounter;

    mapping(address to => bool isAirdropped) private _isAirdroppeds;

    constructor()
        BaseSBNFT(
            _msgSender(),
            "Sample Signle Type SBNFT",
            "SSTSBNFT",
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

    function airdropByType(address, uint256) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function airdropWithTokenURI(address, string calldata) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function bulkAirdrop(
        address[] calldata tos_
    ) external onlyMinter whenNotPaused {
        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tos_[i]);

            _airdrop(tos_[i], _TOKEN_TYPE, "");
        }
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _requireNotAirdropped(address to_) private view {
        require(!_isAirdroppeds[to_], AlreadyAirdropped(to_));
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
