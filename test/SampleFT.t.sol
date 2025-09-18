// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "forge-std/console2.sol";

import {BaseFT} from "../contracts/BaseFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {SampleFT} from "../contracts/SampleFT.sol";
import {IAirdroppableFT} from "../contracts/IAirdroppableFT.sol";

contract SampleFTTest is Test {
    SampleFT ft;

    address runner = makeAddr("runner");
    address minter = makeAddr("minter");
    address holder1 = makeAddr("holder1");
    address holder2 = makeAddr("holder2");

    uint256 constant FT_HOLDING_AMOUNT_THRESHOLD = 3;
    uint256 constant DUMMY_PERIOD = 60;

    function setUp() public {
        vm.startPrank(runner);
        ft = new SampleFT(FT_HOLDING_AMOUNT_THRESHOLD);
        vm.stopPrank();
    }

    function test_InitialState() public {
        assertEq(ft.owner(), runner);
        assertTrue(ft.paused());
        assertEq(ft.supplyCap(), 0);
        assertEq(ft.holdingAmountThreshold(), FT_HOLDING_AMOUNT_THRESHOLD);
    }

    function test_PauseUnpause() public {
        // pause: failure: EnforcedPause
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        ft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.unpause();

        // unpause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(runner);
        ft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(Pausable.ExpectedPause.selector));
        ft.unpause();

        // pause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.pause();

        // pause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(runner);
        ft.pause();
    }

    function test_SetSupplyCapAndFreezeSupplyCap() public {
        // setSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.setSupplyCap(0);

        // freezeSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.freezeSupplyCap();

        // unpause: success
        vm.prank(runner);
        ft.unpause();

        // addMinter: success
        vm.prank(runner);
        ft.addMinter(minter);

        // setSupplyCap: success
        vm.prank(runner);
        ft.setSupplyCap(4);

        assertEq(ft.supplyCap(), 4);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, 2);

        // setSupplyCap: failure: InvalidSupplyCap
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.InvalidSupplyCap.selector, 1));
        ft.setSupplyCap(1);

        // setSupplyCap: success
        vm.prank(runner);
        ft.setSupplyCap(3);

        assertEq(ft.supplyCap(), 3);

        // freezeSupplyCap: success
        vm.prank(runner);
        ft.freezeSupplyCap();

        // setSupplyCap: failure: SupplyCapFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.SupplyCapFrozen.selector));
        ft.setSupplyCap(4);

        // freezeSupplyCap: failure: SupplyCapFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.SupplyCapFrozen.selector));
        ft.freezeSupplyCap();
    }

    function test_Airdrop_Success() public {
        // unpause: success
        vm.prank(runner);
        ft.unpause();

        // addMinter: success
        vm.prank(runner);
        ft.addMinter(minter);

        assertEq(ft.balanceOf(holder1), 0);
        assertEq(ft.totalSupply(), 0);
        assertEq(ft.holdingPeriod(holder1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(address(0), holder1, 1);
        ft.airdrop(holder1, 1);

        assertEq(ft.balanceOf(holder1), 1);
        assertEq(ft.totalSupply(), 1);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), 0);

        // airdrop: success (reach threshold)
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(address(0), holder1, FT_HOLDING_AMOUNT_THRESHOLD - 1);
        ft.airdrop(holder1, FT_HOLDING_AMOUNT_THRESHOLD - 1);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt);
    }

    function test_Transfer_Success() public {
        // unpause: success
        vm.prank(runner);
        ft.unpause();

        // addMinter: success
        vm.prank(runner);
        ft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, FT_HOLDING_AMOUNT_THRESHOLD + 1);

        uint256 holdingStartedAt1 = block.timestamp;

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.balanceOf(holder2), 0);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt1);

        // transfer: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, holder2, 1);
        ft.transfer(holder2, 1);

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.balanceOf(holder2), 1);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt1);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt1);
        assertEq(ft.holdingPeriod(holder2), 0);

        // transfer: success (holder1 below threshold)
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, holder2, FT_HOLDING_AMOUNT_THRESHOLD - 1);
        ft.transfer(holder2, FT_HOLDING_AMOUNT_THRESHOLD - 1);

        uint256 holdingStartedAt2 = block.timestamp;

        assertEq(ft.balanceOf(holder1), 1);
        assertEq(ft.balanceOf(holder2), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), block.timestamp - holdingStartedAt2);

        // transfer: success (holder2 to holder1, both reach threshold)
        vm.prank(holder2);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder2, holder1, FT_HOLDING_AMOUNT_THRESHOLD);
        ft.transfer(holder1, FT_HOLDING_AMOUNT_THRESHOLD);

        holdingStartedAt1 = block.timestamp;

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.balanceOf(holder2), 0);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt1);
        assertEq(ft.holdingPeriod(holder2), 0);
    }

    function test_Burn_Success() public {
        // unpause: success
        vm.prank(runner);
        ft.unpause();

        // addMinter: success
        vm.prank(runner);
        ft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, FT_HOLDING_AMOUNT_THRESHOLD + 1);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, address(0), 1);
        ft.burn(1);

        assertEq(ft.balanceOf(holder1), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), block.timestamp - holdingStartedAt);

        // burn: success (below threshold)
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, address(0), FT_HOLDING_AMOUNT_THRESHOLD - 1);
        ft.burn(FT_HOLDING_AMOUNT_THRESHOLD - 1);

        assertEq(ft.balanceOf(holder1), 1);
        assertEq(ft.totalSupply(), 1);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(ft.holdingPeriod(holder1), 0);
    }

    function test_AddRemoveFreezeMinters() public {
        assertFalse(ft.isMinter(minter));

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.freezeMinters();

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.addMinter(minter);

        // addMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.InvalidMinter.selector, address(0)));
        ft.addMinter(address(0));

        // removeMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.InvalidMinter.selector, minter));
        ft.removeMinter(minter);

        // addMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseFT.MinterAdded(minter);
        ft.addMinter(minter);

        assertTrue(ft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.MinterAlreadyAdded.selector, minter));
        ft.addMinter(minter);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        ft.removeMinter(minter);

        // removeMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseFT.MinterRemoved(minter);
        ft.removeMinter(minter);

        assertFalse(ft.isMinter(minter));

        // freezeMinters: success
        vm.prank(runner);
        ft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.MintersFrozen.selector));
        ft.addMinter(minter);

        // removeMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.MintersFrozen.selector));
        ft.removeMinter(minter);

        // freezeMinters: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseFT.MintersFrozen.selector));
        ft.freezeMinters();
    }
}