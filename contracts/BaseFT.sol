// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BaseFT is ERC20, ERC20Burnable, ERC20Permit, Ownable, Pausable {
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    error ExceededCap(uint256 increasedSupply, uint256 cap);
    error CapFrozen();

    error InvalidMinter(address minter);
    error MinterAlreadyAdded(address minter);
    error MintersFrozen();

    error InsufficientBalance(address holder);
    error InvalidHoldingThreshold(uint256 hodlingThreshold);

    uint256 internal _cap;
    bool internal _capFrozen;

    uint256 internal immutable _holdingThreshold;
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
        uint256 holdlingThreshold_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        _pause();

        _holdingThreshold = holdlingThreshold_;
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

    function cap() public view returns (uint256) {
        return _cap;
    }

    function setCap(uint256 cap_) external onlyOwner {
        _requireCapNotFrozen();
        _cap = cap_;
    }

    function freezeCap() external onlyOwner {
        _requireCapNotFrozen();
        _capFrozen = true;
    }

    function holdingPeriod(address holder_) external view returns (uint256) {
        require(
            balanceOf(holder_) >= _holdingThreshold,
            InsufficientBalance(holder_)
        );

        return block.timestamp - _holdingStartedAts[holder_];
    }

    function _update(
        address from_,
        address to_,
        uint256 value_
    ) internal override {
        if (from_ == address(0)) {
            require(
                totalSupply() + value_ <= cap(),
                ExceededCap(value_, cap())
            );
        }

        super._update(from_, to_, value_);

        if (to_ != address(0)) {
            if (
                balanceOf(to_) >= _holdingThreshold &&
                _holdingStartedAts[to_] == 0
            ) {
                _holdingStartedAts[to_] = block.timestamp;
            } else if (
                balanceOf(to_) < _holdingThreshold &&
                _holdingStartedAts[to_] > 0
            ) {
                _holdingStartedAts[to_] = 0;
            }
        }
        if (from_ != address(0)) {
            if (balanceOf(from_) < _holdingThreshold) {
                _holdingStartedAts[from_] = 0;
            }
        }
    }

    function _requireCapNotFrozen() internal view {
        require(!_capFrozen, CapFrozen());
    }

    function _requireMintersNotFrozen() internal view {
        require(!_isMintersFrozen, MintersFrozen());
    }
}
