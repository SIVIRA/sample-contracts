// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {AbsFT} from "../contracts/AbsFT.sol";
import {SampleFT} from "../contracts/SampleFT.sol";

import {Test} from "./Test.sol";

contract SampleFTTest is Test {
    uint256 private constant HOLDING_AMOUNT_THRESHOLD = 100;

    SampleFT internal ft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        ft = new SampleFT(HOLDING_AMOUNT_THRESHOLD);
    }

    function testInitialState() public view {
        assertEq(ft.owner(), owner);
        assertFalse(ft.paused());
        assertEq(ft.supplyCap(), 0);
        assertEq(ft.holdingAmountThreshold(), HOLDING_AMOUNT_THRESHOLD);
    }

    function testPauseAndUnpause() public {
        // pause: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        ft.unpause();

        // pause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(owner);
        ft.pause();

        assertTrue(ft.paused());

        // pause: failure: EnforcePause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        ft.pause();

        // unpause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(owner);
        ft.unpause();

        assertFalse(ft.paused());
    }

    function testSetSupplyCapAndFreezeSupplyCap() public {
        // setSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.setSupplyCap(0);

        // freezeSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.freezeSupplyCap();

        // setSupplyCap: success
        vm.prank(owner);
        ft.setSupplyCap(200);

        assertEq(ft.supplyCap(), 200);

        // addMinter: success
        vm.prank(owner);
        ft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, 100);

        // setSupplyCap: failure: InvalidSupplyCap
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsFT.InvalidSupplyCap.selector, 99)
        );
        ft.setSupplyCap(99);

        // setSupplyCap: success
        vm.prank(owner);
        ft.setSupplyCap(100);

        assertEq(ft.supplyCap(), 100);

        // freezeSupplyCap: success
        vm.prank(owner);
        ft.freezeSupplyCap();

        // setSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsFT.SupplyCapFrozen.selector));
        ft.setSupplyCap(0);

        // freezeSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsFT.SupplyCapFrozen.selector));
        ft.freezeSupplyCap();
    }

    function testAirdrop() public {
        // airdrop: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsFT.InvalidMinter.selector, minter)
        );
        ft.airdrop(holder1, 0);

        // addMinter: success
        vm.prank(owner);
        ft.addMinter(minter);

        assertEq(ft.balanceOf(holder1), 0);
        assertEq(ft.totalSupply(), 0);
        assertEq(ft.holdingPeriod(holder1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(
            ZERO_ADDRESS,
            holder1,
            HOLDING_AMOUNT_THRESHOLD - 1
        );
        ft.airdrop(holder1, HOLDING_AMOUNT_THRESHOLD - 1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.totalSupply(), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(ZERO_ADDRESS, holder1, 1);
        ft.airdrop(holder1, 1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.holdingPeriod(holder1), 0);

        // pause: success
        vm.prank(owner);
        ft.pause();

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        ft.airdrop(ZERO_ADDRESS, 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 1 days);
    }

    function testTransfer() public {
        // addMinter: success
        vm.prank(owner);
        ft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, 2 * HOLDING_AMOUNT_THRESHOLD - 1);

        assertEq(ft.balanceOf(holder1), 2 * HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.balanceOf(holder2), 0);
        assertEq(ft.totalSupply(), 2 * HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 1 days);
        assertEq(ft.holdingPeriod(holder2), 0);

        // transfer: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, holder2, HOLDING_AMOUNT_THRESHOLD - 1);
        ft.transfer(holder2, HOLDING_AMOUNT_THRESHOLD - 1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.balanceOf(holder2), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.totalSupply(), 2 * HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.holdingPeriod(holder1), 1 days);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 2 days);
        assertEq(ft.holdingPeriod(holder2), 0);

        // transfer: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, holder2, 1);
        ft.transfer(holder2, 1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.balanceOf(holder2), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), 2 * HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 0);
        assertEq(ft.holdingPeriod(holder2), 1 days);
    }

    function testBurn() public {
        // addMinter: success
        vm.prank(owner);
        ft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        ft.airdrop(holder1, HOLDING_AMOUNT_THRESHOLD + 1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.totalSupply(), HOLDING_AMOUNT_THRESHOLD + 1);
        assertEq(ft.holdingPeriod(holder1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 1 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, ZERO_ADDRESS, 1);
        ft.burn(1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.totalSupply(), HOLDING_AMOUNT_THRESHOLD);
        assertEq(ft.holdingPeriod(holder1), 1 days);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(ft.holdingPeriod(holder1), 2 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(holder1, ZERO_ADDRESS, 1);
        ft.burn(1);

        assertEq(ft.balanceOf(holder1), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.totalSupply(), HOLDING_AMOUNT_THRESHOLD - 1);
        assertEq(ft.holdingPeriod(holder1), 0);
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(ft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        ft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsFT.InvalidMinter.selector, ZERO_ADDRESS)
        );
        ft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsFT.InvalidMinter.selector, minter)
        );
        ft.removeMinter(minter);

        // addMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsFT.MinterAdded(minter);
        ft.addMinter(minter);

        assertTrue(ft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsFT.MinterAlreadyAdded.selector, minter)
        );
        ft.addMinter(minter);

        // removeMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsFT.MinterRemoved(minter);
        ft.removeMinter(minter);

        assertFalse(ft.isMinter(minter));

        // freezeMinters: success
        vm.prank(owner);
        ft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsFT.MintersFrozen.selector));
        ft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsFT.MintersFrozen.selector));
        ft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsFT.MintersFrozen.selector));
        ft.freezeMinters();
    }
}
