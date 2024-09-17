// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseSBSFT is
    IERC165,
    ERC1155Supply,
    ERC1155Burnable,
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

    error InvalidHoldingAmountThreshold(uint256 hodlingAmountThreshold);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error Soulbound();

    event TokenRegistered(
        uint256 tokenID,
        string tokenURI,
        uint256 holdingAmountThreshold
    );

    // indicate to OpenSea that an NFT's metadata is frozen
    event PermanentURI(string tokenURI, uint256 indexed tokenID);

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    mapping(uint256 tokenID => bool isTokenRegistered)
        internal _isTokenRegistereds;
    bool internal _isTokenRegistrationFrozen;

    mapping(uint256 tokenID => uint256 supplyCap) internal _supplyCaps;
    mapping(uint256 tokenID => bool isSupplyCapFrozen)
        internal _isSupplyCapFrozens;

    mapping(uint256 tokenID => string tokenURI) internal _tokenURIs;
    mapping(uint256 tokenID => bool isTokenURIFrozen)
        internal _isTokenURIFrozens;

    mapping(uint256 tokenID => uint256 holdingAmountThreshold)
        internal _holdingAmountThresholds;
    mapping(uint256 tokenID => mapping(address holder => uint256 holdingStartedAt))
        internal _holdingStartedAts;

    mapping(address minter => bool isMinter) internal _minters;
    bool internal _isMintersFrozen;

    modifier onlyMinter() {
        require(_minters[_msgSender()], InvalidMinter(_msgSender()));

        _;
    }

    constructor(
        address owner_,
        string memory tokenURI_
    ) ERC1155(tokenURI_) Ownable(owner_) {
        _pause();
    }

    function supportsInterface(
        bytes4 interfaceID_
    ) public view virtual override(IERC165, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceID_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function isTokenRegistered(uint256 tokenID_) external view returns (bool) {
        return _isTokenRegistereds[tokenID_];
    }

    function registerToken(
        uint256 tokenID_,
        string memory tokenURI_,
        uint256 holdingAmountThreshold_
    ) external onlyOwner {
        _requireTokenRegistrationNotFrozen();
        require(
            !_isTokenRegistereds[tokenID_],
            TokenAlreadyRegistered(tokenID_)
        );
        require(
            holdingAmountThreshold_ > 0,
            InvalidHoldingAmountThreshold(holdingAmountThreshold_)
        );

        _isTokenRegistereds[tokenID_] = true;

        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenID_] = tokenURI_;
        }
        _holdingAmountThresholds[tokenID_] = holdingAmountThreshold_;

        emit TokenRegistered(tokenID_, tokenURI_, holdingAmountThreshold_);
    }

    function freezeTokenRegistration() external onlyOwner {
        _requireTokenRegistrationNotFrozen();

        _isTokenRegistrationFrozen = true;
    }

    function supplyCap(uint256 tokenID_) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        return _supplyCaps[tokenID_];
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

        _supplyCaps[tokenID_] = supplyCap_;
    }

    function freezeSupplyCap(uint256 tokenID_) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireSupplyCapNotFrozen(tokenID_);

        _isSupplyCapFrozens[tokenID_] = true;
    }

    function uri(
        uint256 tokenID_
    ) public view override returns (string memory) {
        _requireTokenRegistered(tokenID_);

        if (bytes(_tokenURIs[tokenID_]).length > 0) {
            return _tokenURIs[tokenID_];
        }

        return super.uri(tokenID_);
    }

    function setURI(
        uint256 tokenID_,
        string calldata tokenURI_
    ) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _tokenURIs[tokenID_] = tokenURI_;

        emit URI(tokenURI_, tokenID_);
    }

    function freezeURI(uint256 tokenID_) external onlyOwner {
        _requireTokenRegistered(tokenID_);
        _requireTokenURINotFrozen(tokenID_);

        _isTokenURIFrozens[tokenID_] = true;

        emit PermanentURI(_tokenURIs[tokenID_], tokenID_);
    }

    function holdingAmountThreshold(
        uint256 tokenID_
    ) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        return _holdingAmountThresholds[tokenID_];
    }

    function holdingPeriod(
        address holder_,
        uint256 tokenID_
    ) external view returns (uint256) {
        _requireTokenRegistered(tokenID_);

        if (_holdingStartedAts[tokenID_][holder_] == 0) {
            return 0;
        }

        return block.timestamp - _holdingStartedAts[tokenID_][holder_];
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

    function _requireTokenRegistered(uint256 tokenID_) internal view {
        require(_isTokenRegistereds[tokenID_], TokenUnregistered(tokenID_));
    }

    function _requireTokenRegistrationNotFrozen() internal view {
        require(!_isTokenRegistrationFrozen, TokenRegistrationFrozen());
    }

    function _requireSupplyCapNotFrozen(uint256 tokenID_) internal view {
        require(!_isSupplyCapFrozens[tokenID_], SupplyCapFrozen(tokenID_));
    }

    function _requireTokenURINotFrozen(uint256 tokenID_) internal view {
        require(!_isTokenURIFrozens[tokenID_], TokenURIFrozen(tokenID_));
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function _mint(address to_, uint256 tokenID_, uint256 amount_) internal {
        _requireTokenRegistered(tokenID_);

        if (_supplyCaps[tokenID_] > 0) {
            require(
                totalSupply(tokenID_) + amount_ <= _supplyCaps[tokenID_],
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

        require(isMinting || isBurning, Soulbound());

        super._update(from_, to_, tokenIDs_, amounts_);

        for (uint256 i = 0; i < tokenIDs_.length; i++) {
            uint256 tokenID_ = tokenIDs_[i];

            if (!isMinting) {
                if (
                    balanceOf(from_, tokenID_) <
                    _holdingAmountThresholds[tokenID_] &&
                    _holdingStartedAts[tokenID_][from_] > 0
                ) {
                    _holdingStartedAts[tokenID_][from_] = 0;
                }
            }

            if (!isBurning) {
                if (
                    balanceOf(to_, tokenID_) >=
                    _holdingAmountThresholds[tokenID_] &&
                    _holdingStartedAts[tokenID_][to_] == 0
                ) {
                    _holdingStartedAts[tokenID_][to_] = block.timestamp;
                }
            }
        }
    }
}
