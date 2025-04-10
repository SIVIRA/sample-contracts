// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {IAirdroppableNFT} from "./IAirdroppableNFT.sol";
import {BaseSBNFT} from "./BaseSBNFT.sol";

error ArgumentLengthMismatch();
error AlreadyAirdropped(address to);

contract SampleNoTypeSBNFT is IERC4906, IAirdroppableNFT, BaseSBNFT {
    uint256 private constant _TOKEN_TYPE = 0;

    uint256 private _tokenIDCounter;

    mapping(address to => bool isAirdropped) private _isAirdroppeds;

    constructor()
        BaseSBNFT(
            _msgSender(),
            "Sample No Type SBNFT",
            "SNTSBNFT",
            _TOKEN_TYPE,
            _TOKEN_TYPE
        )
    {
        _isTokenTypeRangeFrozen = true;
    }

    function airdrop(address) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function airdropByType(address, uint256) external pure {
        revert IAirdroppableNFT.UnsupportedFunction();
    }

    function airdropWithTokenURI(
        address to_,
        string calldata tokenURI_
    ) external onlyMinter whenNotPaused {
        _requireNotAirdropped(to_);

        _airdrop(to_, _TOKEN_TYPE, tokenURI_);
    }

    function bulkAirdropWithTokenURI(
        address[] calldata tos_,
        string[] calldata tokenURIs_
    ) external onlyMinter whenNotPaused {
        require(tos_.length == tokenURIs_.length, ArgumentLengthMismatch());

        for (uint256 i = 0; i < tos_.length; i++) {
            _requireNotAirdropped(tos_[i]);

            _airdrop(tos_[i], _TOKEN_TYPE, tokenURIs_[i]);
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
