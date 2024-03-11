// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IAirdroppable {
    function airdrop(address to) external;
}

interface IAirdroppableByType {
    function airdropByType(address to, uint256 tokenType) external;
}
