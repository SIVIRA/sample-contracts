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
    error UnregisteredToken(uint256 tokenID);
    error AlreadyRegisteredToken(uint256 tokenID);
    error TokenRegistrationFrozen();

    error TokenURIFrozen(uint256 tokenID);

    error RoyaltyFrozen();

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error InsufficientBalance(address holder, uint256 tokenID);
    error InvalidHoldingThreshold(uint256 hodlingThreshold);

    error InvalidCap(uint256 tokenID, uint256 cap);
    error ExceededCap(uint256 tokenID, uint256 increasedSupply, uint256 cap);
    error CapFrozen(uint256 tokenID);

    event TokenRegistered(
        uint256 tokenID,
        string uri,
        uint256 holdingThreshold
    );

    // indicate to OpenSea that an NFT's metadata is frozen
    event PermanentURI(string uri, uint256 indexed tokenID);

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    mapping(uint256 tokenID => bool) internal _isTokenRegistereds;
    bool internal _isTokenRegistrationFrozen;

    mapping(uint256 tokenID => uint256 holdingThreshold)
        internal _holdingThresholds;
    mapping(uint256 tokenID => mapping(address holder => uint256 holdingStartedAt))
        internal _holdingStartedAts;

    mapping(uint256 tokenID => uint256 cap) internal _caps;
    mapping(uint256 tokenID => bool isFrozen) internal _capFrozen;

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

    function registerToken(
        uint256 tokenID_,
        string memory uri_,
        uint256 holdingThreshold_
    ) external onlyOwner {
        _requireTokenRegistrationNotFrozen();
        require(
            !_isTokenRegistereds[tokenID_],
            AlreadyRegisteredToken(tokenID_)
        );
        require(
            holdingThreshold_ > 0,
            InvalidHoldingThreshold(holdingThreshold_)
        );

        _isTokenRegistereds[tokenID_] = true;
        if (bytes(uri_).length > 0) {
            _tokenURIs[tokenID_] = uri_;
        }
        _holdingThresholds[tokenID_] = holdingThreshold_;

        emit TokenRegistered(tokenID_, uri(tokenID_), holdingThreshold_);
    }

    function setCap(uint256 tokenID_, uint256 cap_) external onlyOwner {
        _requireRegisteredToken(tokenID_);
        _requireCapNotFrozen(tokenID_);
        if (cap_ > 0) {
            require(totalSupply(tokenID_) <= cap_, InvalidCap(tokenID_, cap_));
        }

        _caps[tokenID_] = cap_;
    }

    function cap(uint256 tokenID_) external view returns (uint256) {
        return _caps[tokenID_];
    }

    function freezeCap(uint256 tokenID_) external onlyOwner {
        _requireRegisteredToken(tokenID_);
        _requireCapNotFrozen(tokenID_);

        _capFrozen[tokenID_] = true;
    }

    function isTokenRegistered(uint256 tokenID_) external view returns (bool) {
        return _isTokenRegistereds[tokenID_];
    }

    function royaltyInfo(
        uint256 tokenID_,
        uint256 salePrice_
    ) public view override returns (address, uint256) {
        _requireRegisteredToken(tokenID_);

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
        _requireRegisteredToken(tokenID_);

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
        _requireRegisteredToken(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURIs[tokenID_] = uri_;

        emit URI(uri_, tokenID_);
    }

    function holdingPeriod(
        address holder_,
        uint256 tokenID_
    ) external view returns (uint256) {
        require(
            balanceOf(holder_, tokenID_) >= _holdingThresholds[tokenID_],
            InsufficientBalance(holder_, tokenID_)
        );

        return block.timestamp - _holdingStartedAts[tokenID_][holder_];
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount) internal {
        _requireRegisteredToken(tokenID_);
        if (_caps[tokenID_] > 0) {
            require(
                totalSupply(tokenID_) + amount <= _caps[tokenID_],
                ExceededCap(tokenID_, amount, _caps[tokenID_])
            );
        }

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

    function _requireRegisteredToken(uint256 tokenID_) internal view {
        require(_isTokenRegistereds[tokenID_], UnregisteredToken(tokenID_));
    }

    function _requireRoyaltyNotFrozen() internal view {
        require(!_isRoyaltyFrozen, RoyaltyFrozen());
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function freezeTokenRegistration() external onlyOwner {
        _requireTokenRegistrationNotFrozen();

        _isTokenRegistrationFrozen = true;
    }

    function freezeTokenURI(uint256 tokenID_) external onlyOwner {
        _requireRegisteredToken(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozens[tokenID_] = true;

        emit PermanentURI(_tokenURIs[tokenID_], tokenID_);
    }

    function _requireTokenRegistrationNotFrozen() internal view {
        require(!_isTokenRegistrationFrozen, TokenRegistrationFrozen());
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozens[tokenID_], TokenURIFrozen(tokenID_));
    }

    function _requireCapNotFrozen(uint256 tokenID_) internal view {
        require(!_capFrozen[tokenID_], CapFrozen(tokenID_));
    }
}
