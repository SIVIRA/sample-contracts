// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {AbsSBSFT} from "../contracts/AbsSBSFT.sol";
import {SampleSBSFT} from "../contracts/SampleSBSFT.sol";

import {Test} from "./Test.sol";

contract SampleSBSFTTest is Test {
    SampleSBSFT private sbsft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private royaltyReceiver = makeAddr("royaltyReceiver");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        sbsft = new SampleSBSFT();
    }

    function testInitialState() public view {
        assertEq(sbsft.owner(), owner);
        assertFalse(sbsft.paused());
    }

    function testInterface() public view {
        assertFalse(sbsft.supportsInterface(0x00000000));
        assertTrue(sbsft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(sbsft.supportsInterface(0xd9b67a26)); // ERC1155
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
        sbsft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        sbsft.unpause();

        // pause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(owner);
        sbsft.pause();

        assertTrue(sbsft.paused());

        // pause: failure: EnforcePause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sbsft.pause();

        // unpause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(owner);
        sbsft.unpause();

        assertFalse(sbsft.paused());
    }

    function testRegisterTokenAndFreezeTokenRegistration() public {
        string memory tokenURI = "https://sft.metadata.com/0x1";

        // registerToken: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.registerToken(1, "", 1);

        // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.freezeTokenRegistration();

        // registerToken: failure: InvalidHoldingAmountThreshold
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                AbsSBSFT.InvalidHoldingAmountThreshold.selector,
                0
            )
        );
        sbsft.registerToken(1, "", 0);

        assertFalse(sbsft.isTokenRegistered(1));
        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 1)
            );
            sbsft.uri(1);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 1)
            );
            sbsft.holdingAmountThreshold(1);
        }

        // registerToken: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSBSFT.TokenRegistered(1, tokenURI, 1);
        sbsft.registerToken(1, tokenURI, 1);

        assertTrue(sbsft.isTokenRegistered(1));
        assertEq(sbsft.uri(1), tokenURI);
        assertEq(sbsft.holdingAmountThreshold(1), 1);

        // registerToken: failure: TokenAlreadyRegistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenAlreadyRegistered.selector, 1)
        );
        sbsft.registerToken(1, "", 0);

        // freezeTokenRegistration: success
        vm.prank(owner);
        sbsft.freezeTokenRegistration();

        // registerToken: failure: TokenRegistrationFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenRegistrationFrozen.selector)
        );
        sbsft.registerToken(1, "", 0);

        // freezeTokenRegistration: failure: TokenRegistrationFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenRegistrationFrozen.selector)
        );
        sbsft.freezeTokenRegistration();
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
        sbsft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.freezeSupplyCap(0);

        // setSupplyCap: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.freezeSupplyCap(0);

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sbsft.registerToken(1, "", 1);

        assertEq(sbsft.supplyCap(1), 0);

        // setSupplyCap: success
        vm.prank(owner);
        sbsft.setSupplyCap(1, 200);

        assertEq(sbsft.supplyCap(1), 200);

        // airdrop: success
        vm.prank(minter);
        sbsft.airdrop(holder1, 1, 100);

        // setSupplyCap: failure: InvalidSupplyCap
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.InvalidSupplyCap.selector, 1, 99)
        );
        sbsft.setSupplyCap(1, 99);

        // setSupplyCap: success
        vm.prank(owner);
        sbsft.setSupplyCap(1, 100);

        assertEq(sbsft.supplyCap(1), 100);

        // freezeSupplyCap: success
        vm.prank(owner);
        sbsft.freezeSupplyCap(1);

        // setSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.SupplyCapFrozen.selector, 1)
        );
        sbsft.setSupplyCap(1, 0);

        // freezeSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.SupplyCapFrozen.selector, 1)
        );
        sbsft.freezeSupplyCap(1);
    }

    function testSetURIAndFreezeURI() public {
        string memory tokenURI = "https://sbsft.metadata.com/0x1";

        // setURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.setURI(0, "");

        // freezeURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.freezeURI(0);

        // setURI: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.setURI(0, "");

        // freezeURI: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.freezeURI(0);

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sbsft.registerToken(1, "", 1);

        assertEq(sbsft.uri(1), "");

        // setURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.URI(tokenURI, 1);
        sbsft.setURI(1, tokenURI);

        assertEq(sbsft.uri(1), tokenURI);

        // freezeURI: success
        vm.prank(owner);
        sbsft.freezeURI(1);

        // setURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenURIFrozen.selector, 1)
        );
        sbsft.setURI(1, "");

        // freezeURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenURIFrozen.selector, 1)
        );
        sbsft.freezeURI(1);
    }

    function testAirdrop() public {
        // airdrop: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.InvalidMinter.selector, minter)
        );
        sbsft.airdrop(holder1, 0, 0);

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // airdrop: failure: TokenUnregistered
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.airdrop(holder1, 0, 0);

        // registerToken: success
        vm.prank(owner);
        sbsft.registerToken(1, "", 100);

        // setSupplyCap: success
        vm.prank(owner);
        sbsft.setSupplyCap(1, 100);

        // airdrop: failure: SupplyCapExceeded
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.SupplyCapExceeded.selector, 1, 101)
        );
        sbsft.airdrop(holder1, 1, 101);

        assertEq(sbsft.balanceOf(holder1, 1), 0);
        assertEq(sbsft.totalSupply(), 0);
        assertEq(sbsft.totalSupply(1), 0);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, ZERO_ADDRESS, holder1, 1, 99);
        sbsft.airdrop(holder1, 1, 99);

        assertEq(sbsft.balanceOf(holder1, 1), 99);
        assertEq(sbsft.totalSupply(), 99);
        assertEq(sbsft.totalSupply(1), 99);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, ZERO_ADDRESS, holder1, 1, 1);
        sbsft.airdrop(holder1, 1, 1);

        assertEq(sbsft.balanceOf(holder1, 1), 100);
        assertEq(sbsft.totalSupply(), 100);
        assertEq(sbsft.totalSupply(1), 100);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);

        // pause: success
        vm.prank(owner);
        sbsft.pause();

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sbsft.airdrop(ZERO_ADDRESS, 0, 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 1 days);
    }

    function testSafeTransferFrom() public {
        // safeTransferFrom: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.safeTransferFrom(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, "0x");

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sbsft.registerToken(1, "", 1);

        // airdrop: success
        vm.prank(minter);
        sbsft.airdrop(holder1, 1, 1);

        // safeTransferFrom: failure: Soulbound
        vm.prank(holder1);
        vm.expectRevert(abi.encodeWithSelector(AbsSBSFT.Soulbound.selector));
        sbsft.safeTransferFrom(holder1, holder2, 1, 1, "0x");
    }

    function testSafeBatchTransferFrom() public {
        // safeBatchTransferFrom: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.safeBatchTransferFrom(
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            toDynamicArray2(0, 0),
            toDynamicArray2(0, 0),
            "0x"
        );

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.startPrank(owner);
        sbsft.registerToken(1, "", 1);
        sbsft.registerToken(2, "", 1);
        vm.stopPrank();

        // airdrop: success
        vm.startPrank(minter);
        sbsft.airdrop(holder1, 1, 1);
        sbsft.airdrop(holder1, 2, 1);
        vm.stopPrank();

        // safeBatchTransferFrom: failure: Soulbound
        vm.prank(holder1);
        vm.expectRevert(abi.encodeWithSelector(AbsSBSFT.Soulbound.selector));
        sbsft.safeBatchTransferFrom(
            holder1,
            holder2,
            toDynamicArray2(1, 2),
            toDynamicArray2(1, 1),
            "0x"
        );
    }

    function testBurn() public {
        // burn: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.burn(ZERO_ADDRESS, 0, 0);

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sbsft.registerToken(1, "", 100);

        // airdrop: success
        vm.prank(minter);
        sbsft.airdrop(holder1, 1, 101);

        assertEq(sbsft.balanceOf(holder1, 1), 101);
        assertEq(sbsft.totalSupply(), 101);
        assertEq(sbsft.totalSupply(1), 101);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 1 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, ZERO_ADDRESS, 1, 1);
        sbsft.burn(holder1, 1, 1);

        assertEq(sbsft.balanceOf(holder1, 1), 100);
        assertEq(sbsft.totalSupply(), 100);
        assertEq(sbsft.totalSupply(1), 100);
        assertEq(sbsft.holdingPeriod(holder1, 1), 1 days);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 2 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, ZERO_ADDRESS, 1, 1);
        sbsft.burn(holder1, 1, 1);

        assertEq(sbsft.balanceOf(holder1, 1), 99);
        assertEq(sbsft.totalSupply(), 99);
        assertEq(sbsft.totalSupply(1), 99);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);
    }

    function testBurnBatch() public {
        // burnBatch: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.TokenUnregistered.selector, 0)
        );
        sbsft.burnBatch(
            ZERO_ADDRESS,
            toDynamicArray2(0, 0),
            toDynamicArray2(0, 0)
        );

        // addMinter: success
        vm.prank(owner);
        sbsft.addMinter(minter);

        // registerToken: success
        vm.startPrank(owner);
        sbsft.registerToken(1, "", 100);
        sbsft.registerToken(2, "", 100);
        vm.stopPrank();

        // airdrop: success
        vm.startPrank(minter);
        sbsft.airdrop(holder1, 1, 101);
        sbsft.airdrop(holder1, 2, 101);
        vm.stopPrank();

        assertEq(
            sbsft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(101, 101)
        );
        assertEq(sbsft.totalSupply(), 202);
        assertEq(sbsft.totalSupply(1), 101);
        assertEq(sbsft.totalSupply(2), 101);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);
        assertEq(sbsft.holdingPeriod(holder1, 2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sbsft.holdingPeriod(holder1, 2), 1 days);

        // burnBatch: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            ZERO_ADDRESS,
            toDynamicArray2(1, 2),
            toDynamicArray2(1, 1)
        );
        sbsft.burnBatch(holder1, toDynamicArray2(1, 2), toDynamicArray2(1, 1));

        assertEq(
            sbsft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(100, 100)
        );
        assertEq(sbsft.totalSupply(), 200);
        assertEq(sbsft.totalSupply(1), 100);
        assertEq(sbsft.totalSupply(2), 100);
        assertEq(sbsft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sbsft.holdingPeriod(holder1, 2), 1 days);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbsft.holdingPeriod(holder1, 1), 2 days);
        assertEq(sbsft.holdingPeriod(holder1, 2), 2 days);

        // burnBatch: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            ZERO_ADDRESS,
            toDynamicArray2(1, 2),
            toDynamicArray2(1, 1)
        );
        sbsft.burnBatch(holder1, toDynamicArray2(1, 2), toDynamicArray2(1, 1));

        assertEq(
            sbsft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(99, 99)
        );
        assertEq(sbsft.totalSupply(), 198);
        assertEq(sbsft.totalSupply(1), 99);
        assertEq(sbsft.totalSupply(2), 99);
        assertEq(sbsft.holdingPeriod(holder1, 1), 0);
        assertEq(sbsft.holdingPeriod(holder1, 2), 0);
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(sbsft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                AbsSBSFT.InvalidMinter.selector,
                ZERO_ADDRESS
            )
        );
        sbsft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.InvalidMinter.selector, minter)
        );
        sbsft.removeMinter(minter);

        // addMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSBSFT.MinterAdded(minter);
        sbsft.addMinter(minter);

        assertTrue(sbsft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.MinterAlreadyAdded.selector, minter)
        );
        sbsft.addMinter(minter);

        // removeMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSBSFT.MinterRemoved(minter);
        sbsft.removeMinter(minter);

        assertFalse(sbsft.isMinter(minter));

        // freezeMinters: success
        vm.prank(owner);
        sbsft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.MintersFrozen.selector)
        );
        sbsft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.MintersFrozen.selector)
        );
        sbsft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBSFT.MintersFrozen.selector)
        );
        sbsft.freezeMinters();
    }
}
