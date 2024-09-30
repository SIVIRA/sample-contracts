// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

interface IAirdroppableFT {
    function airdrop(address to, uint256 amount) external;
}
