// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseSFT is ERC1155, Ownable, Pausable {
    error InvalidTokenIDRange(uint256 minTokenID, uint256 maxTokenID);
    error TokenIDRangeFrozen();

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    uint256 internal _minTokenID;
    uint256 internal _maxTokenID;
    bool internal _isTokenIDRangeFrozen;

    mapping(address minter => bool isMinter) internal _minters;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_minters[_msgSender()], InvalidMinter(_msgSender()));

        _;
    }

    constructor(
        address owner_,
        string memory uri_,
        uint256 minTokenID_,
        uint256 maxTokenID_
    ) ERC1155(uri_) Ownable(owner_) {
        _pause();

        _minTokenID = minTokenID_;
        _maxTokenID = maxTokenID_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function addMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        require(minter_ != address(0), InvalidMinter(address(0)));
        require(!_minters[minter_], MinterAlreadyAdded(minter_));

        _minters[minter_] = true;

        emit MinterAdded(minter_);
    }

    function isMinter(address minter_) external view returns (bool) {
        return _minters[minter_];
    }

    function removeMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        require(_minters[minter_], InvalidMinter(minter_));

        delete _minters[minter_];

        emit MinterRemoved(minter_);
    }

    function freezeMinters() external onlyOwner {
        _requireMintersNotFrozen();

        _isMintersFrozen = true;
    }

    function minTokenID() external view returns (uint256) {
        return _minTokenID;
    }

    function maxTokenID() external view returns (uint256) {
        return _maxTokenID;
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount) internal {
        require(
            tokenID_ >= _minTokenID && tokenID_ <= _maxTokenID,
            InvalidTokenIDRange(_minTokenID, _maxTokenID)
        );

        _mint(to_, tokenID_, amount, "");
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function freezeTokenTypeRange() external onlyOwner {
        _requireTokenTypeRangeNotFrozen();

        _isTokenIDRangeFrozen = true;
    }

    function _requireTokenTypeRangeNotFrozen() internal view {
        require(!_isTokenIDRangeFrozen, TokenIDRangeFrozen());
    }
}
