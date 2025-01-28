// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IAirdroppableFT {
    function airdrop(address to, uint256 amount) external;
}
