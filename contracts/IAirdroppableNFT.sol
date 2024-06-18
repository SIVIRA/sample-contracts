// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAirdroppableNFT {
    error UnsupportedFunction();

    function airdrop(address to) external;

    function airdropByType(address to, uint256 tokenType) external;

    function airdropWithTokenURI(address to, string calldata tokenURI) external;
}
