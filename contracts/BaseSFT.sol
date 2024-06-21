// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseSFT is IERC165, ERC1155Supply, ERC2981, Ownable, Pausable {
    error InvalidTokenIDRange(uint256 minTokenID, uint256 maxTokenID);
    error TokenIDRangeFrozen();

    error NonexistentToken(uint256 tokenID);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error InsufficientHolding(address holder, uint256 tokenID);
    error InvalidHoldingThreshold();
    error HoldingThresholdsFrozen(uint256 tokenID);

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    uint256 internal _minTokenID;
    uint256 internal _maxTokenID;
    bool internal _isTokenIDRangeFrozen;

    mapping(uint256 tokenID => uint256 holdingThreshold)
        internal _holdingThresholds;
    mapping(uint256 tokenID => bool) internal _isHoldingThresholdFrozen;
    mapping(address holder => mapping(uint256 tokenID => uint256 holdingStartedAt))
        internal _holdingStartedAts;

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

        _setDefaultRoyalty(owner_, 0);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
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

    function royaltyInfo(
        uint256 tokenID_,
        uint256 salePrice_
    ) public view override returns (address, uint256) {
        _requireExists(tokenID_);

        return super.royaltyInfo(tokenID_, salePrice_);
    }

    function holdingPeriod(
        address holder_,
        uint256 tokenID_
    ) external view returns (uint256) {
        require(
            _holdingThresholds[tokenID_] > 0 &&
                balanceOf(holder_, tokenID_) >= _holdingThresholds[tokenID_],
            InsufficientHolding(holder_, tokenID_)
        );

        return block.timestamp - _holdingStartedAts[holder_][tokenID_];
    }

    function setHoldingThreshold(
        uint256 tokenID_,
        uint256 threshold_
    ) external {
        _requireHoldingThresholdsNotFrozen(tokenID_);
        require(threshold_ > 0, InvalidHoldingThreshold());
        _holdingThresholds[tokenID_] = threshold_;
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount) internal {
        require(
            tokenID_ >= _minTokenID && tokenID_ <= _maxTokenID,
            InvalidTokenIDRange(_minTokenID, _maxTokenID)
        );

        _mint(to_, tokenID_, amount, "");
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        super._update(from, to, ids, values);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenID = ids[i];
            if (to != address(0)) {
                if (
                    balanceOf(to, tokenID) >= _holdingThresholds[tokenID] &&
                    _holdingStartedAts[to][tokenID] == 0
                ) {
                    _holdingStartedAts[to][tokenID] = block.timestamp;
                } else if (
                    balanceOf(to, tokenID) < _holdingThresholds[tokenID]
                ) {
                    _holdingStartedAts[to][tokenID] = 0;
                }
            }
            if (from != address(0)) {
                if (balanceOf(from, tokenID) < _holdingThresholds[tokenID]) {
                    _holdingStartedAts[from][tokenID] = 0;
                }
            }
        }
    }

    function _requireExists(uint256 tokenID_) internal view {
        require(exists(tokenID_), NonexistentToken(tokenID_));
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

    function _requireHoldingThresholdsNotFrozen(uint256 tokenID) internal view {
        require(
            !_isHoldingThresholdFrozen[tokenID],
            HoldingThresholdsFrozen(tokenID)
        );
    }
}
