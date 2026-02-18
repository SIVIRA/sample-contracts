// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

abstract contract AbsSFT is
    IERC165,
    ERC1155Supply,
    ERC1155Burnable,
    ERC2981,
    Ownable,
    Pausable
{
    error TokenUnregistered(uint256 tokenID);
    error TokenAlreadyRegistered(uint256 tokenID);
    error TokenRegistrationFrozen();

    error InvalidSupplyCap(uint256 tokenID, uint256 supplyCap);
    error SupplyCapExceeded(uint256 tokenID);
    error SupplyCapFrozen(uint256 tokenID);

    error TokenURIFrozen(uint256 tokenID);

    error InvalidHoldingAmountThreshold(uint256 holdingAmountThreshold);

    error RoyaltyFrozen();

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    event TokenRegistered(
        uint256 indexed tokenID,
        string tokenURI,
        uint256 holdingAmountThreshold
    );

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    mapping(uint256 tokenID => bool) internal _isTokenRegistered;
    bool internal _isTokenRegistrationFrozen;

    mapping(uint256 tokenID => uint256) internal _supplyCap;
    mapping(uint256 tokenID => bool) internal _isSupplyCapFrozen;

    mapping(uint256 tokenID => string) internal _tokenURI;
    mapping(uint256 tokenID => bool) internal _isTokenURIFrozen;

    mapping(uint256 tokenID => uint256) internal _holdingAmountThreshold;
    mapping(uint256 tokenID => mapping(address holder => uint256))
        internal _holdingStartedAt;

    bool internal _isRoyaltyFrozen;

    mapping(address minter => bool) internal _isMinter;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_isMinter[_msgSender()], InvalidMinter(_msgSender()));

        _;
    }

    constructor(
        address owner_,
        string memory tokenURI_
    ) ERC1155(tokenURI_) Ownable(owner_) {
        _setDefaultRoyalty(owner_, 0);
    }

    function supportsInterface(
        bytes4 interfaceID_
    ) public view virtual override(IERC165, ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceID_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isTokenRegistered(uint256 tokenID_) external view returns (bool) {
        return _isTokenRegistered[tokenID_];
    }

    function registerToken(
        uint256 tokenID_,
        string memory tokenURI_,
        uint256 holdingAmountThreshold_
    ) external onlyOwner {
        _requireTokenRegistrationNotFrozen();
        require(
            !_isTokenRegistered[tokenID_],
            TokenAlreadyRegistered(tokenID_)
        );
        require(
            holdingAmountThreshold_ > 0,
            InvalidHoldingAmountThreshold(holdingAmountThreshold_)
        );

        _isTokenRegistered[tokenID_] = true;

        if (bytes(tokenURI_).length > 0) {
            _tokenURI[tokenID_] = tokenURI_;
        }

        _holdingAmountThreshold[tokenID_] = holdingAmountThreshold_;

        emit TokenRegistered(tokenID_, tokenURI_, holdingAmountThreshold_);
    }

    function freezeTokenRegistration() external onlyOwner {
        _requireTokenRegistrationNotFrozen();

        _isTokenRegistrationFrozen = true;
    }

    function supplyCap(uint256 tokenID_) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        return _supplyCap[tokenID_];
    }

    function setSupplyCap(
        uint256 tokenID_,
        uint256 supplyCap_
    ) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireSupplyCapNotFrozen(tokenID_);

        if (supplyCap_ > 0) {
            require(
                totalSupply(tokenID_) <= supplyCap_,
                InvalidSupplyCap(tokenID_, supplyCap_)
            );
        }

        _supplyCap[tokenID_] = supplyCap_;
    }

    function freezeSupplyCap(uint256 tokenID_) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireSupplyCapNotFrozen(tokenID_);

        _isSupplyCapFrozen[tokenID_] = true;
    }

    function balanceOf(
        address owner_,
        uint256 tokenID_
    ) public view virtual override returns (uint256) {
        _requireTokenRegistered(tokenID_);

        return super.balanceOf(owner_, tokenID_);
    }

    function balanceOfBatch(
        address[] memory owners_,
        uint256[] memory tokenIDs_
    ) public view virtual override returns (uint256[] memory) {
        for (uint256 i = 0; i < tokenIDs_.length; i++) {
            _requireTokenRegistered(tokenIDs_[i]);
        }

        return super.balanceOfBatch(owners_, tokenIDs_);
    }

    function uri(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireTokenRegistered(tokenID_);

        if (bytes(_tokenURI[tokenID_]).length > 0) {
            return _tokenURI[tokenID_];
        }

        return super.uri(tokenID_);
    }

    function setURI(
        uint256 tokenID_,
        string calldata tokenURI_
    ) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURI[tokenID_] = tokenURI_;

        emit URI(tokenURI_, tokenID_);
    }

    function freezeURI(uint256 tokenID_) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozen[tokenID_] = true;
    }

    function holdingAmountThreshold(
        uint256 tokenID_
    ) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        return _holdingAmountThreshold[tokenID_];
    }

    function holdingPeriod(
        address holder_,
        uint256 tokenID_
    ) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        uint256 holdingStartedAt = _holdingStartedAt[tokenID_][holder_];

        return holdingStartedAt > 0 ? block.timestamp - holdingStartedAt : 0;
    }

    function safeTransferFrom(
        address from_,
        address to_,
        uint256 tokenID_,
        uint256 amount_,
        bytes memory data_
    ) public virtual override {
        _requireTokenRegistered(tokenID_);

        super.safeTransferFrom(from_, to_, tokenID_, amount_, data_);
    }

    function safeBatchTransferFrom(
        address from_,
        address to_,
        uint256[] memory tokenIDs_,
        uint256[] memory amounts_,
        bytes memory data_
    ) public virtual override {
        for (uint256 i = 0; i < tokenIDs_.length; i++) {
            _requireTokenRegistered(tokenIDs_[i]);
        }

        super.safeBatchTransferFrom(from_, to_, tokenIDs_, amounts_, data_);
    }

    function burn(
        address from_,
        uint256 tokenID_,
        uint256 amount_
    ) public virtual override {
        _requireTokenRegistered(tokenID_);

        super.burn(from_, tokenID_, amount_);
    }

    function burnBatch(
        address from_,
        uint256[] memory tokenIDs_,
        uint256[] memory amounts_
    ) public virtual override {
        for (uint256 i = 0; i < tokenIDs_.length; i++) {
            _requireTokenRegistered(tokenIDs_[i]);
        }

        super.burnBatch(from_, tokenIDs_, amounts_);
    }

    function royaltyInfo(
        uint256 tokenID_,
        uint256 salePrice_
    ) public view override returns (address, uint256) {
        _requireTokenRegistered(tokenID_);

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

    function _requireTokenRegistered(uint256 tokenID_) internal view {
        require(_isTokenRegistered[tokenID_], TokenUnregistered(tokenID_));
    }

    function _requireTokenRegistrationNotFrozen() internal view {
        require(!_isTokenRegistrationFrozen, TokenRegistrationFrozen());
    }

    function _requireSupplyCapNotFrozen(uint256 tokenID_) internal view {
        require(!_isSupplyCapFrozen[tokenID_], SupplyCapFrozen(tokenID_));
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozen[tokenID_], TokenURIFrozen(tokenID_));
    }

    function _requireRoyaltyNotFrozen() internal view {
        require(!_isRoyaltyFrozen, RoyaltyFrozen());
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount_) internal {
        _requireTokenRegistered(tokenID_);

        if (_supplyCap[tokenID_] > 0) {
            require(
                totalSupply(tokenID_) + amount_ <= _supplyCap[tokenID_],
                SupplyCapExceeded(tokenID_)
            );
        }

        _mint(to_, tokenID_, amount_, "");
    }

    function _update(
        address from_,
        address to_,
        uint256[] memory tokenIDs_,
        uint256[] memory amounts_
    ) internal override(ERC1155, ERC1155Supply) {
        bool isMinting = from_ == address(0);
        bool isBurning = to_ == address(0);

        super._update(from_, to_, tokenIDs_, amounts_);

        for (uint256 i = 0; i < tokenIDs_.length; i++) {
            uint256 tokenID_ = tokenIDs_[i];

            if (
                !isMinting &&
                balanceOf(from_, tokenID_) <
                _holdingAmountThreshold[tokenID_] &&
                _holdingStartedAt[tokenID_][from_] > 0
            ) {
                _holdingStartedAt[tokenID_][from_] = 0;
            }

            if (
                !isBurning &&
                balanceOf(to_, tokenID_) >= _holdingAmountThreshold[tokenID_] &&
                _holdingStartedAt[tokenID_][to_] == 0
            ) {
                _holdingStartedAt[tokenID_][to_] = block.timestamp;
            }
        }
    }
}
