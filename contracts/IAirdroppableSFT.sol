// SPDX-License-Identifier: MIT
pragma solidity 0.8.33;

interface IAirdroppableSFT {
    function airdrop(address to, uint256 tokenID, uint256 amount) external;
}
