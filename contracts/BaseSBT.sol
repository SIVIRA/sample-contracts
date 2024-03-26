// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract BaseSBT is IERC4906, ERC721Enumerable, Ownable, Pausable {
    using Strings for uint256;

    error InvalidTokenTypeRange(uint256 minTokenType, uint256 maxTokenType);
    error TokenTypeRangeFrozen();

    error InvalidTokenType(uint256 tokenType);

    error TokenURIFrozen(uint256 tokenID);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error Soulbound();

    // indicate to OpenSea that an NFT's metadata is frozen
    event PermanentURI(string uri, uint256 indexed tokenID);

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    bytes4 internal constant ERC4906_INTERFACE_ID = 0x49064906;

    uint256 internal _minTokenType;
    uint256 internal _maxTokenType;
    bool internal _isTokenTypeRangeFrozen;

    mapping(uint256 tokenID => uint256 tokenType) internal _tokenTypes;
    mapping(uint256 tokenType => uint256 supply) internal _typeSupplies;
    mapping(address owner => mapping(uint256 tokenType => uint256 balance))
        internal _typeBalances;

    string internal _baseTokenURI;
    mapping(uint256 tokenID => string uri) internal _tokenURIs;
    mapping(uint256 tokenID => bool isFrozen) internal _isTokenURIFrozens;

    mapping(uint256 tokenID => uint256 holdingStartedAt)
        internal _holdingStartedAts;

    mapping(address minter => bool isMinter) internal _minters;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        if (!_minters[_msgSender()]) {
            revert InvalidMinter(_msgSender());
        }
        _;
    }

    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint256 minTokenType_,
        uint256 maxTokenType_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        if (minTokenType_ > maxTokenType_) {
            revert InvalidTokenTypeRange(minTokenType_, maxTokenType_);
        }

        _pause();

        _minTokenType = minTokenType_;
        _maxTokenType = maxTokenType_;
    }

    function supportsInterface(
        bytes4 interfaceID_
    ) public view override(IERC165, ERC721Enumerable) returns (bool) {
        return
            interfaceID_ == ERC4906_INTERFACE_ID ||
            super.supportsInterface(interfaceID_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function minTokenType() external view returns (uint256) {
        return _minTokenType;
    }

    function maxTokenType() external view returns (uint256) {
        return _maxTokenType;
    }

    function freezeTokenTypeRange() external onlyOwner {
        _requireTokenTypeRangeNotFrozen();

        _isTokenTypeRangeFrozen = true;
    }

    function tokenType(uint256 tokenID_) external view returns (uint256) {
        _requireOwned(tokenID_);

        return _tokenTypes[tokenID_];
    }

    function typeSupply(uint256 tokenType_) external view returns (uint256) {
        return _typeSupplies[tokenType_];
    }

    function typeBalanceOf(
        address owner_,
        uint256 tokenType_
    ) external view returns (uint256) {
        if (owner_ == address(0)) {
            revert ERC721InvalidOwner(address(0));
        }

        return _typeBalances[owner_][tokenType_];
    }

    function tokenURI(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireOwned(tokenID_);

        string memory uri = _tokenURIs[tokenID_];

        if (bytes(uri).length > 0) {
            return uri;
        }

        return
            bytes(_baseTokenURI).length > 0
                ? string(
                    abi.encodePacked(
                        _baseTokenURI,
                        _tokenTypes[tokenID_].toString(),
                        "/",
                        tokenID_.toString()
                    )
                )
                : "";
    }

    function setTokenURI(
        uint256 tokenID_,
        string calldata uri_
    ) external onlyOwner {
        _requireOwned(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURIs[tokenID_] = uri_;

        emit MetadataUpdate(tokenID_);
    }

    function freezeTokenURI(uint256 tokenID_) external onlyOwner {
        _requireOwned(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozens[tokenID_] = true;

        emit PermanentURI(_tokenURIs[tokenID_], tokenID_);
    }

    function holdingPeriod(uint256 tokenID_) external view returns (uint256) {
        _requireOwned(tokenID_);

        return block.timestamp - _holdingStartedAts[tokenID_];
    }

    function addMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        if (minter_ == address(0)) {
            revert InvalidMinter(address(0));
        }
        if (_minters[minter_]) {
            revert MinterAlreadyAdded(minter_);
        }

        _minters[minter_] = true;

        emit MinterAdded(minter_);
    }

    function isMinter(address minter_) external view returns (bool) {
        return _minters[minter_];
    }

    function removeMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        if (!_minters[minter_]) {
            revert InvalidMinter(minter_);
        }

        delete _minters[minter_];

        emit MinterRemoved(minter_);
    }

    function freezeMinters() external onlyOwner {
        _requireMintersNotFrozen();

        _isMintersFrozen = true;
    }

    function _requireTokenTypeRangeNotFrozen() internal view {
        if (_isTokenTypeRangeFrozen) {
            revert TokenTypeRangeFrozen();
        }
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        if (_isTokenURIFrozens[tokenID_]) {
            revert TokenURIFrozen(tokenID_);
        }
    }

    function _requireMintersNotFrozen() internal view {
        if (_isMintersFrozen) {
            revert MintersFrozen();
        }
    }

    function _mint(address to_, uint256 tokenID_, uint256 tokenType_) internal {
        if (tokenType_ < _minTokenType || _maxTokenType < tokenType_) {
            revert InvalidTokenType(tokenType_);
        }

        _tokenTypes[tokenID_] = tokenType_;

        _mint(to_, tokenID_);
    }

    function _update(
        address to_,
        uint256 tokenID_,
        address auth_
    ) internal override returns (address) {
        uint256 tokenType_ = _tokenTypes[tokenID_];

        address prevOwner = super._update(to_, tokenID_, auth_);

        bool isMinted = prevOwner == address(0);
        bool isBurned = to_ == address(0);

        if (isMinted) {
            _typeSupplies[tokenType_]++;
            _typeBalances[to_][tokenType_]++;

            _holdingStartedAts[tokenID_] = block.timestamp;
        } else if (isBurned) {
            _typeSupplies[tokenType_]--;
            _typeBalances[prevOwner][tokenType_]--;

            if (bytes(_tokenURIs[tokenID_]).length > 0) {
                delete _tokenURIs[tokenID_];
            }

            delete _tokenTypes[tokenID_];
            delete _holdingStartedAts[tokenID_];
        } else {
            revert Soulbound();
        }

        emit MetadataUpdate(tokenID_);

        return prevOwner;
    }
}
