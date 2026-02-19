// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {Test as ForgeTest} from "forge-std/Test.sol";

abstract contract Test is ForgeTest {
    function toDynamicArray2(
        uint256 element1,
        uint256 element2
    ) internal pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](2);

        array[0] = element1;
        array[1] = element2;

        return array;
    }

    function toDynamicArray2(
        address element1,
        address element2
    ) internal pure returns (address[] memory) {
        address[] memory array = new address[](2);

        array[0] = element1;
        array[1] = element2;

        return array;
    }

    function toDynamicArray4(
        uint256 element1,
        uint256 element2,
        uint256 element3,
        uint256 element4
    ) internal pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](4);

        array[0] = element1;
        array[1] = element2;
        array[2] = element3;
        array[3] = element4;

        return array;
    }

    function toDynamicArray4(
        address element1,
        address element2,
        address element3,
        address element4
    ) internal pure returns (address[] memory) {
        address[] memory array = new address[](4);

        array[0] = element1;
        array[1] = element2;
        array[2] = element3;
        array[3] = element4;

        return array;
    }
}
