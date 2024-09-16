// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseFT is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable {
    error InvalidSupplyCap(uint256 supplyCap);
    error SupplyCapExceeded();
    error SupplyCapFrozen();

    error InvalidHoldingAmountThreshold(uint256 holdingAmountThreshold);

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    uint256 internal immutable _holdingAmountThreshold;

    uint256 internal _supplyCap;
    bool internal _isSupplyCapFrozen;

    mapping(address holder => uint256 holdingStartedAt)
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
        uint256 holdlingAmountThreshold_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        require(
            holdlingAmountThreshold_ > 0,
            InvalidHoldingAmountThreshold(holdlingAmountThreshold_)
        );

        _pause();

        _holdingAmountThreshold = holdlingAmountThreshold_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function supplyCap() public view returns (uint256) {
        return _supplyCap;
    }

    function setSupplyCap(uint256 supplyCap_) external onlyOwner {
        _requireSupplyCapNotFrozen();

        if (supplyCap_ > 0) {
            require(totalSupply() <= supplyCap_, InvalidSupplyCap(supplyCap_));
        }

        _supplyCap = supplyCap_;
    }

    function freezeSupplyCap() external onlyOwner {
        _requireSupplyCapNotFrozen();

        _isSupplyCapFrozen = true;
    }

    function holdingPeriod(address holder_) external view returns (uint256) {
        if (_holdingStartedAts[holder_] == 0) {
            return 0;
        }

        return block.timestamp - _holdingStartedAts[holder_];
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

    function _requireSupplyCapNotFrozen() internal view {
        require(!_isSupplyCapFrozen, SupplyCapFrozen());
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }

    function _update(
        address from_,
        address to_,
        uint256 amount_
    ) internal override {
        if (from_ == address(0) && _supplyCap > 0) {
            require(totalSupply() + amount_ <= _supplyCap, SupplyCapExceeded());
        }

        super._update(from_, to_, amount_);

        if (from_ != address(0)) {
            if (
                balanceOf(from_) < _holdingAmountThreshold &&
                _holdingStartedAts[from_] > 0
            ) {
                _holdingStartedAts[from_] = 0;
            }
        }

        if (to_ != address(0)) {
            if (
                balanceOf(to_) >= _holdingAmountThreshold &&
                _holdingStartedAts[to_] == 0
            ) {
                _holdingStartedAts[to_] = block.timestamp;
            }
        }
    }
}
