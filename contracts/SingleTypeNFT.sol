// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./BaseNFT.sol";

contract SingleTypeNFT is BaseNFT {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIDCounter;

    mapping(address to => bool isAirdropped) private _isAirdroppeds;

    constructor() BaseNFT("Signle Type NFT", "STNFT") {}

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdrop(address to_) external onlyMinter whenNotPaused {
        require(!_isAirdroppeds[to_], "STNFT: already airdropped");

        _airdrop(to_);
    }

    function bulkAirdrop(address[] calldata tos_) external onlyMinter whenNotPaused {
        for (uint256 i = 0; i < tos_.length; i++) {
            require(!_isAirdroppeds[tos_[i]], "STNFT: already airdropped");

            _airdrop(tos_[i]);
        }
    }

    function burn(uint256 tokenID_) external {
        _requireApprovedOrOwner(msg.sender, tokenID_);

        _burn(tokenID_);
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _mintedAmount() private view returns (uint256) {
        return _tokenIDCounter.current();
    }

    function _airdrop(address to_) private {
        _isAirdroppeds[to_] = true;

        uint256 tokenID = _tokenIDCounter.current();

        _mint(to_, tokenID, 0);

        _tokenIDCounter.increment();
    }

    function _refreshMetadata() private {
        if (_mintedAmount() == 1) {
            emit MetadataUpdate(0);
        } else if (_mintedAmount() > 1) {
            emit BatchMetadataUpdate(0, _mintedAmount() - 1);
        }
    }
}
