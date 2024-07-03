// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseSFT is
    IERC165,
    ERC1155Supply,
    ERC1155Burnable,
    ERC2981,
    Ownable,
    Pausable
{
    error InvalidTokenIDRange(uint256 minTokenID, uint256 maxTokenID);
    error TokenIDAdditionFrozen();

    error TokenURIFrozen(uint256 tokenID);

    error RoyaltyFrozen();

    error NonexistentToken(uint256 tokenID);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error InsufficientBalance(address holder, uint256 tokenID);
    error InvalidHoldingThreshold();

    event TokenAdded(uint256 tokenID, string uri, uint256 holdingThreshold);

    // indicate to OpenSea that an NFT's metadata is frozen
    event PermanentURI(string uri, uint256 indexed tokenID);

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    uint256 internal _maxTokenID; // 0 means no available tokens
    bool internal _isTokenIDAdditionFrozen;

    mapping(uint256 tokenID => uint256 holdingThreshold)
        internal _holdingThresholds;
    mapping(uint256 tokenID => bool) internal _isHoldingThresholdFrozen;
    mapping(uint256 tokenID => mapping(address holder => uint256 holdingStartedAt))
        internal _holdingStartedAts;

    mapping(uint256 tokenID => string uri) internal _tokenURIs;
    mapping(uint256 tokenID => bool isFrozen) internal _isTokenURIFrozens;

    bool internal _isRoyaltyFrozen;

    mapping(address minter => bool isMinter) internal _minters;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_minters[_msgSender()], InvalidMinter(_msgSender()));

        _;
    }

    constructor(
        address owner_,
        string memory uri_
    ) ERC1155(uri_) Ownable(owner_) {
        _pause();

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

    function addToken(
        string memory uri_,
        uint256 holdingThreshold_
    ) external onlyOwner {
        _requireTokenIDAdditionNotFrozen();

        _maxTokenID++;
        if (bytes(uri_).length > 0) {
            _tokenURIs[_maxTokenID] = uri_;
        }
        _holdingThresholds[_maxTokenID] = holdingThreshold_;

        emit TokenAdded(_maxTokenID, uri(_maxTokenID), holdingThreshold_);
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

    function setDefaultRoyalty(
        address receiver_,
        uint96 feeNumerator_
    ) external onlyOwner {
        _requireRoyaltyNotFrozen();

        _setDefaultRoyalty(receiver_, feeNumerator_);
    }

    function freezeRoyalty() external onlyOwner {
        _requireRoyaltyNotFrozen();

        _isRoyaltyFrozen = true;
    }

    function uri(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireExists(tokenID_);

        string memory tokenURI = _tokenURIs[tokenID_];
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }

        return super.uri(tokenID_);
    }

    function setTokenURI(
        uint256 tokenID_,
        string calldata uri_
    ) external onlyOwner {
        _requireExists(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURIs[tokenID_] = uri_;

        emit URI(uri_, tokenID_);
    }

    function holdingPeriod(
        address holder_,
        uint256 tokenID_
    ) external view returns (uint256) {
        require(
            _holdingThresholds[tokenID_] > 0 &&
                balanceOf(holder_, tokenID_) >= _holdingThresholds[tokenID_],
            InsufficientBalance(holder_, tokenID_)
        );

        return block.timestamp - _holdingStartedAts[tokenID_][holder_];
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount) internal {
        require(
            tokenID_ >= 1 && tokenID_ <= _maxTokenID,
            InvalidTokenIDRange(1, _maxTokenID)
        );

        _mint(to_, tokenID_, amount, "");
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenID = ids[i];
            if (_holdingThresholds[tokenID] == 0) {
                continue;
            }
            if (to != address(0)) {
                if (
                    balanceOf(to, tokenID) >= _holdingThresholds[tokenID] &&
                    _holdingStartedAts[tokenID][to] == 0
                ) {
                    _holdingStartedAts[tokenID][to] = block.timestamp;
                } else if (
                    balanceOf(to, tokenID) < _holdingThresholds[tokenID]
                ) {
                    _holdingStartedAts[tokenID][to] = 0;
                }
            }
            if (from != address(0)) {
                if (balanceOf(from, tokenID) < _holdingThresholds[tokenID]) {
                    _holdingStartedAts[tokenID][from] = 0;
                }
            }
        }
    }

    function _requireExists(uint256 tokenID_) internal view {
        require(exists(tokenID_), NonexistentToken(tokenID_));
    }

    function _requireRoyaltyNotFrozen() internal view {
        require(!_isRoyaltyFrozen, RoyaltyFrozen());
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function freezeTokenIDAddition() external onlyOwner {
        _requireTokenIDAdditionNotFrozen();

        _isTokenIDAdditionFrozen = true;
    }

    function freezeTokenURI(uint256 tokenID_) external onlyOwner {
        _requireExists(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozens[tokenID_] = true;

        emit PermanentURI(_tokenURIs[tokenID_], tokenID_);
    }

    function _requireTokenIDAdditionNotFrozen() internal view {
        require(!_isTokenIDAdditionFrozen, TokenIDAdditionFrozen());
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozens[tokenID_], TokenURIFrozen(tokenID_));
    }
}
