// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract BaseSBNFT is IERC4906, ERC721Enumerable, Ownable, Pausable {
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
    event PermanentURI(string tokenURI, uint256 indexed tokenID);

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
    mapping(uint256 tokenID => string tokenURI) internal _tokenURIs;
    mapping(uint256 tokenID => bool isTokenURIFrozen)
        internal _isTokenURIFrozens;

    mapping(uint256 tokenID => uint256 holdingStartedAt)
        internal _holdingStartedAts;

    mapping(address minter => bool isMinter) internal _minters;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_minters[_msgSender()], InvalidMinter(_msgSender()));

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
        require(owner_ != address(0), ERC721InvalidOwner(address(0)));

        return _typeBalances[owner_][tokenType_];
    }

    function tokenURI(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireOwned(tokenID_);

        if (bytes(_tokenURIs[tokenID_]).length > 0) {
            return _tokenURIs[tokenID_];
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
        string calldata tokenURI_
    ) external onlyOwner {
        _requireOwned(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURIs[tokenID_] = tokenURI_;

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

    function burn(uint256 tokenID_) external virtual {
        _checkAuthorized(_ownerOf(tokenID_), _msgSender(), tokenID_);

        _burn(tokenID_);
    }

    function isMinter(address minter_) external view returns (bool) {
        return _minters[minter_];
    }

    function addMinter(address minter_) external onlyOwner {
        _requireMintersNotFrozen();

        require(minter_ != address(0), InvalidMinter(address(0)));
        require(!_minters[minter_], MinterAlreadyAdded(minter_));

        _minters[minter_] = true;

        emit MinterAdded(minter_);
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

    function _requireTokenTypeRangeNotFrozen() internal view {
        require(!_isTokenTypeRangeFrozen, TokenTypeRangeFrozen());
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozens[tokenID_], TokenURIFrozen(tokenID_));
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function _mint(address to_, uint256 tokenID_, uint256 tokenType_) internal {
        require(
            _minTokenType <= tokenType_ && tokenType_ <= _maxTokenType,
            InvalidTokenType(tokenType_)
        );

        _tokenTypes[tokenID_] = tokenType_;

        _mint(to_, tokenID_);
    }

    function _update(
        address to_,
        uint256 tokenID_,
        address auth_
    ) internal override returns (address) {
        address from_ = _ownerOf(tokenID_);
        uint256 tokenType_ = _tokenTypes[tokenID_];

        bool isMinting = from_ == address(0);
        bool isBurning = to_ == address(0);

        require(isMinting || isBurning, Soulbound());

        super._update(to_, tokenID_, auth_);

        if (isMinting) {
            _typeSupplies[tokenType_]++;
            _typeBalances[to_][tokenType_]++;

            _holdingStartedAts[tokenID_] = block.timestamp;
        }

        if (isBurning) {
            _typeSupplies[tokenType_]--;
            _typeBalances[from_][tokenType_]--;

            if (bytes(_tokenURIs[tokenID_]).length > 0) {
                delete _tokenURIs[tokenID_];
            }

            delete _tokenTypes[tokenID_];
            delete _holdingStartedAts[tokenID_];
        }

        emit MetadataUpdate(tokenID_);

        return from_;
    }
}
