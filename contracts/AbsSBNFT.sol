// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

abstract contract AbsSBNFT is IERC4906, ERC721Enumerable, Ownable, Pausable {
    using Strings for uint256;

    error InvalidTokenTypeRange(uint256 minTokenType, uint256 maxTokenType);
    error TokenTypeRangeFrozen();

    error InvalidTokenType(uint256 tokenType);

    error TokenURIFrozen(uint256 tokenID);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error Soulbound();

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    bytes4 internal constant ERC4906_INTERFACE_ID = 0x49064906;

    uint256 internal _minTokenType;
    uint256 internal _maxTokenType;
    bool internal _isTokenTypeRangeFrozen;

    mapping(uint256 tokenID => uint256) internal _tokenType;
    mapping(uint256 tokenType => uint256) internal _typeSupply;
    mapping(address owner => mapping(uint256 tokenType => uint256))
        internal _typeBalance;

    string internal _baseTokenURI;
    mapping(uint256 tokenID => string) internal _tokenURI;
    mapping(uint256 tokenID => bool) internal _isTokenURIFrozen;

    mapping(uint256 tokenID => uint256) internal _holdingStartedAt;

    mapping(address minter => bool) internal _isMinter;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_isMinter[_msgSender()], InvalidMinter(_msgSender()));

        _;
    }

    constructor(
        address owner_,
        string memory name_,
        string memory symbol_,
        uint256 minTokenType_,
        uint256 maxTokenType_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        require(
            minTokenType_ <= maxTokenType_,
            InvalidTokenTypeRange(minTokenType_, maxTokenType_)
        );

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

        return _tokenType[tokenID_];
    }

    function typeSupply(uint256 tokenType_) external view returns (uint256) {
        _requireValidTokenType(tokenType_);

        return _typeSupply[tokenType_];
    }

    function typeBalanceOf(
        address owner_,
        uint256 tokenType_
    ) external view returns (uint256) {
        _requireValidTokenType(tokenType_);

        require(owner_ != address(0), ERC721InvalidOwner(address(0)));

        return _typeBalance[owner_][tokenType_];
    }

    function tokenURI(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireOwned(tokenID_);

        if (bytes(_tokenURI[tokenID_]).length > 0) {
            return _tokenURI[tokenID_];
        }

        return
            bytes(_baseTokenURI).length > 0
                ? string(
                    abi.encodePacked(
                        _baseTokenURI,
                        _tokenType[tokenID_].toString(),
                        "/",
                        tokenID_.toString()
                    )
                )
                : "";
    }

    function setTokenURI(
        uint256 tokenID_,
        string calldata tokenURI_
    ) external onlyOwner {
        _requireOwned(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURI[tokenID_] = tokenURI_;

        emit MetadataUpdate(tokenID_);
    }

    function freezeTokenURI(uint256 tokenID_) external onlyOwner {
        _requireOwned(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozen[tokenID_] = true;
    }

    function holdingPeriod(uint256 tokenID_) external view returns (uint256) {
        _requireOwned(tokenID_);

        return block.timestamp - _holdingStartedAt[tokenID_];
    }

    function burn(uint256 tokenID_) external virtual {
        _checkAuthorized(_ownerOf(tokenID_), _msgSender(), tokenID_);

        _burn(tokenID_);
    }

    function isMinter(address minter_) external view returns (bool) {
        return _isMinter[minter_];
    }

    function addMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        require(minter_ != address(0), InvalidMinter(address(0)));
        require(!_isMinter[minter_], MinterAlreadyAdded(minter_));

        _isMinter[minter_] = true;

        emit MinterAdded(minter_);
    }

    function removeMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        require(_isMinter[minter_], InvalidMinter(minter_));

        delete _isMinter[minter_];

        emit MinterRemoved(minter_);
    }

    function freezeMinters() external onlyOwner {
        _requireMintersNotFrozen();

        _isMintersFrozen = true;
    }

    function _requireValidTokenType(uint256 tokenType_) internal view {
        require(
            _minTokenType <= tokenType_ && tokenType_ <= _maxTokenType,
            InvalidTokenType(tokenType_)
        );
    }

    function _requireTokenTypeRangeNotFrozen() internal view {
        require(!_isTokenTypeRangeFrozen, TokenTypeRangeFrozen());
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozen[tokenID_], TokenURIFrozen(tokenID_));
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function _mint(address to_, uint256 tokenID_, uint256 tokenType_) internal {
        _requireValidTokenType(tokenType_);

        _tokenType[tokenID_] = tokenType_;

        _mint(to_, tokenID_);
    }

    function _update(
        address to_,
        uint256 tokenID_,
        address auth_
    ) internal override returns (address) {
        address from_ = _ownerOf(tokenID_);
        uint256 tokenType_ = _tokenType[tokenID_];

        bool isMinting = from_ == address(0);
        bool isBurning = to_ == address(0);

        require(isMinting || isBurning, Soulbound());

        super._update(to_, tokenID_, auth_);

        if (isMinting) {
            _typeSupply[tokenType_]++;
            _typeBalance[to_][tokenType_]++;

            _holdingStartedAt[tokenID_] = block.timestamp;
        }

        if (isBurning) {
            _typeSupply[tokenType_]--;
            _typeBalance[from_][tokenType_]--;

            if (bytes(_tokenURI[tokenID_]).length > 0) {
                delete _tokenURI[tokenID_];
            }

            delete _tokenType[tokenID_];
            delete _holdingStartedAt[tokenID_];
        }

        return from_;
    }
}
