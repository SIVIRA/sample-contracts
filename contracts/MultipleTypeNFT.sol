// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/Counters.sol";

import "./BaseNFT.sol";

contract MultipleTypeNFT is BaseNFT {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIDCounter;

    mapping(uint256 tokenType => mapping(address to => bool isAirdropped)) private _isAirdroppeds;

    constructor() BaseNFT("Multiple Type NFT", "MTNFT") {}

    function setBaseTokenURI(string calldata uri_) external onlyOwner {
        _baseTokenURI = uri_;

        _refreshMetadata();
    }

    function airdropByType(address to_, uint256 tokenType_)
        external
        onlyMinter
        whenNotPaused
    {
        _requireValidTokenType(tokenType_);

        require(!_isAirdroppeds[tokenType_][to_], "MTNFT: already airdropped");

        _airdropByType(to_, tokenType_);
    }

    function bulkAirdropByType(address[] calldata tos_, uint256 tokenType_)
        external
        onlyMinter
        whenNotPaused
    {
        _requireValidTokenType(tokenType_);

        for (uint256 i = 0; i < tos_.length; i++) {
            require(
                !_isAirdroppeds[tokenType_][tos_[i]],
                "MTNFT: already airdropped"
            );

            _airdropByType(tos_[i], tokenType_);
        }
    }

    function burn(uint256 tokenID_) external {
        _requireApprovedOrOwner(msg.sender, tokenID_);

        _burn(tokenID_);
    }

    function refreshMetadata() external onlyOwner {
        _refreshMetadata();
    }

    function _requireValidTokenType(uint256 tokenType_) private pure {
        require(
            1 <= tokenType_ && tokenType_ <= 8,
            "MTNFT: invalid token type"
        );
    }

    function _mintedAmount() private view returns (uint256) {
        return _tokenIDCounter.current();
    }

    function _airdropByType(address to_, uint256 tokenType_) private {
        _isAirdroppeds[tokenType_][to_] = true;

        uint256 tokenID = _tokenIDCounter.current();

        _mint(to_, tokenID, tokenType_);

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
