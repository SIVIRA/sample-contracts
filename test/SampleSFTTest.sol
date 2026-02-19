// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {AbsSFT} from "../contracts/AbsSFT.sol";
import {SampleSFT} from "../contracts/SampleSFT.sol";

import {Test} from "./Test.sol";

contract SampleSFTTest is Test {
    SampleSFT private sft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private royaltyReceiver = makeAddr("royaltyReceiver");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        sft = new SampleSFT();
    }

    function testInitialState() public view {
        assertEq(sft.owner(), owner);
        assertFalse(sft.paused());
    }

    function testInterface() public view {
        assertFalse(sft.supportsInterface(0x00000000));
        assertTrue(sft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(sft.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(sft.supportsInterface(0x2a55205a)); // ERC2981
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
        sft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        sft.unpause();

        // pause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(owner);
        sft.pause();

        assertTrue(sft.paused());

        // pause: failure: EnforcePause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sft.pause();

        // unpause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(owner);
        sft.unpause();

        assertFalse(sft.paused());
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
        sft.registerToken(1, "", 1);

        // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.freezeTokenRegistration();

        // registerToken: failure: InvalidHoldingAmountThreshold
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                AbsSFT.InvalidHoldingAmountThreshold.selector,
                0
            )
        );
        sft.registerToken(1, "", 0);

        assertFalse(sft.isTokenRegistered(1));
        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 1)
            );
            sft.uri(1);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 1)
            );
            sft.holdingAmountThreshold(1);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 1)
            );
            sft.royaltyInfo(1, 0);
        }

        // registerToken: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSFT.TokenRegistered(1, tokenURI, 1);
        sft.registerToken(1, tokenURI, 1);

        assertTrue(sft.isTokenRegistered(1));
        assertEq(sft.uri(1), tokenURI);
        assertEq(sft.holdingAmountThreshold(1), 1);
        {
            (address receiver, uint256 amount) = sft.royaltyInfo(1, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }

        // registerToken: failure: TokenAlreadyRegistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenAlreadyRegistered.selector, 1)
        );
        sft.registerToken(1, "", 0);

        // freezeTokenRegistration: success
        vm.prank(owner);
        sft.freezeTokenRegistration();

        // registerToken: failure: TokenRegistrationFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenRegistrationFrozen.selector)
        );
        sft.registerToken(1, "", 0);

        // freezeTokenRegistration: failure: TokenRegistrationFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenRegistrationFrozen.selector)
        );
        sft.freezeTokenRegistration();
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
        sft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.freezeSupplyCap(0);

        // setSupplyCap: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.freezeSupplyCap(0);

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 1);

        assertEq(sft.supplyCap(1), 0);

        // setSupplyCap: success
        vm.prank(owner);
        sft.setSupplyCap(1, 200);

        assertEq(sft.supplyCap(1), 200);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 100);

        // setSupplyCap: failure: InvalidSupplyCap
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.InvalidSupplyCap.selector, 1, 99)
        );
        sft.setSupplyCap(1, 99);

        // setSupplyCap: success
        vm.prank(owner);
        sft.setSupplyCap(1, 100);

        assertEq(sft.supplyCap(1), 100);

        // freezeSupplyCap: success
        vm.prank(owner);
        sft.freezeSupplyCap(1);

        // setSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.SupplyCapFrozen.selector, 1)
        );
        sft.setSupplyCap(1, 0);

        // freezeSupplyCap: failure: SupplyCapFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.SupplyCapFrozen.selector, 1)
        );
        sft.freezeSupplyCap(1);
    }

    function setURIAndFreezeURI() public {
        string memory tokenURI = "https://sft.metadata.com/0x1";

        // setURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.setURI(0, "");

        // freezeURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.freezeURI(0);

        // setURI: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.setURI(0, "");

        // freezeURI: failure: TokenUnregistered
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.freezeURI(0);

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 1);

        assertEq(sft.uri(1), "");

        // setURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.URI(tokenURI, 1);
        sft.setURI(1, tokenURI);

        assertEq(sft.uri(1), tokenURI);

        // freezeURI: success
        vm.prank(owner);
        sft.freezeURI(1);

        // setURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenURIFrozen.selector, 1)
        );
        sft.setURI(1, "");

        // freezeURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenURIFrozen.selector, 1)
        );
        sft.freezeURI(1);
    }

    function testAirdrop() public {
        // airdrop: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.InvalidMinter.selector, minter)
        );
        sft.airdrop(holder1, 0, 0);

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // airdrop: failure: TokenUnregistered
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.airdrop(holder1, 0, 0);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 100);

        // setSupplyCap: success
        vm.prank(owner);
        sft.setSupplyCap(1, 100);

        // airdrop: failure: SupplyCapExceeded
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.SupplyCapExceeded.selector, 1, 101)
        );
        sft.airdrop(holder1, 1, 101);

        assertEq(sft.balanceOf(holder1, 1), 0);
        assertEq(sft.totalSupply(), 0);
        assertEq(sft.totalSupply(1), 0);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, ZERO_ADDRESS, holder1, 1, 99);
        sft.airdrop(holder1, 1, 99);

        assertEq(sft.balanceOf(holder1, 1), 99);
        assertEq(sft.totalSupply(), 99);
        assertEq(sft.totalSupply(1), 99);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, ZERO_ADDRESS, holder1, 1, 1);
        sft.airdrop(holder1, 1, 1);

        assertEq(sft.balanceOf(holder1, 1), 100);
        assertEq(sft.totalSupply(), 100);
        assertEq(sft.totalSupply(1), 100);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // pause: success
        vm.prank(owner);
        sft.pause();

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sft.airdrop(ZERO_ADDRESS, 0, 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
    }

    function testSafeTransferFrom() public {
        // safeTransferFrom: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.safeTransferFrom(ZERO_ADDRESS, ZERO_ADDRESS, 0, 0, "0x");

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 100);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 199);

        assertEq(sft.balanceOf(holder1, 1), 199);
        assertEq(sft.balanceOf(holder2, 1), 0);
        assertEq(sft.totalSupply(), 199);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, holder2, 1, 99);
        sft.safeTransferFrom(holder1, holder2, 1, 99, "0x");

        assertEq(sft.balanceOf(holder1, 1), 100);
        assertEq(sft.balanceOf(holder2, 1), 99);
        assertEq(sft.totalSupply(), 199);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 2 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, holder2, 1, 1);
        sft.safeTransferFrom(holder1, holder2, 1, 1, "0x");

        assertEq(sft.balanceOf(holder1, 1), 99);
        assertEq(sft.balanceOf(holder2, 1), 100);
        assertEq(sft.totalSupply(), 199);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 1 days);
    }

    function testSafeBatchTransferFrom() public {
        // safeBatchTransferFrom: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.safeBatchTransferFrom(
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            toDynamicArray2(0, 0),
            toDynamicArray2(0, 0),
            "0x"
        );

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.startPrank(owner);
        sft.registerToken(1, "", 100);
        sft.registerToken(2, "", 100);
        vm.stopPrank();

        // airdrop: success
        vm.startPrank(minter);
        sft.airdrop(holder1, 1, 199);
        sft.airdrop(holder1, 2, 199);
        vm.stopPrank();

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray4(holder1, holder1, holder2, holder2),
                toDynamicArray4(1, 2, 1, 2)
            ),
            toDynamicArray4(199, 199, 0, 0)
        );
        assertEq(sft.totalSupply(), 398);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.totalSupply(2), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder1, 2), 1 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // safeBatchTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            holder2,
            toDynamicArray2(1, 2),
            toDynamicArray2(99, 99)
        );
        sft.safeBatchTransferFrom(
            holder1,
            holder2,
            toDynamicArray2(1, 2),
            toDynamicArray2(99, 99),
            "0x"
        );

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray4(holder1, holder1, holder2, holder2),
                toDynamicArray4(1, 2, 1, 2)
            ),
            toDynamicArray4(100, 100, 99, 99)
        );
        assertEq(sft.totalSupply(), 398);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.totalSupply(2), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder1, 2), 1 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 2 days);
        assertEq(sft.holdingPeriod(holder1, 2), 2 days);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // safeBatchTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            holder2,
            toDynamicArray2(1, 2),
            toDynamicArray2(1, 1)
        );
        sft.safeBatchTransferFrom(
            holder1,
            holder2,
            toDynamicArray2(1, 2),
            toDynamicArray2(1, 1),
            "0x"
        );

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray4(holder1, holder1, holder2, holder2),
                toDynamicArray4(1, 2, 1, 2)
            ),
            toDynamicArray4(99, 99, 100, 100)
        );
        assertEq(sft.totalSupply(), 398);
        assertEq(sft.totalSupply(1), 199);
        assertEq(sft.totalSupply(2), 199);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 1 days);
        assertEq(sft.holdingPeriod(holder2, 2), 1 days);
    }

    function testBurn() public {
        // burn: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.burn(ZERO_ADDRESS, 0, 0);

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 100);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 101);

        assertEq(sft.balanceOf(holder1, 1), 101);
        assertEq(sft.totalSupply(), 101);
        assertEq(sft.totalSupply(1), 101);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 1 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, ZERO_ADDRESS, 1, 1);
        sft.burn(holder1, 1, 1);

        assertEq(sft.balanceOf(holder1, 1), 100);
        assertEq(sft.totalSupply(), 100);
        assertEq(sft.totalSupply(1), 100);
        assertEq(sft.holdingPeriod(holder1, 1), 1 days);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 2 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, ZERO_ADDRESS, 1, 1);
        sft.burn(holder1, 1, 1);

        assertEq(sft.balanceOf(holder1, 1), 99);
        assertEq(sft.totalSupply(), 99);
        assertEq(sft.totalSupply(1), 99);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
    }

    function burnBatch() public {
        // burnBatch: failure: TokenUnregistered
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
        );
        sft.burnBatch(
            ZERO_ADDRESS,
            toDynamicArray2(0, 0),
            toDynamicArray2(0, 0)
        );

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.startPrank(owner);
        sft.registerToken(1, "", 100);
        sft.registerToken(2, "", 100);
        vm.stopPrank();

        // airdrop: success
        vm.startPrank(minter);
        sft.airdrop(holder1, 1, 101);
        sft.airdrop(holder1, 2, 101);
        vm.stopPrank();

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(101, 101)
        );
        assertEq(sft.totalSupply(), 202);
        assertEq(sft.totalSupply(1), 101);
        assertEq(sft.totalSupply(2), 101);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder1, 2), 1 days);

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
        sft.burnBatch(holder1, toDynamicArray2(1, 2), toDynamicArray2(1, 1));

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(100, 100)
        );
        assertEq(sft.totalSupply(), 200);
        assertEq(sft.totalSupply(1), 100);
        assertEq(sft.totalSupply(2), 100);
        assertEq(sft.holdingPeriod(holder1, 1), 1 days);
        assertEq(sft.holdingPeriod(holder1, 2), 1 days);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sft.holdingPeriod(holder1, 1), 2 days);
        assertEq(sft.holdingPeriod(holder1, 2), 2 days);

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
        sft.burnBatch(holder1, toDynamicArray2(1, 2), toDynamicArray2(1, 1));

        assertEq(
            sft.balanceOfBatch(
                toDynamicArray2(holder1, holder1),
                toDynamicArray2(1, 2)
            ),
            toDynamicArray2(99, 99)
        );
        assertEq(sft.totalSupply(), 198);
        assertEq(sft.totalSupply(1), 99);
        assertEq(sft.totalSupply(2), 99);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
    }

    function testSetDefaultRoyaltyAndFreezeRoyalty() public {
        uint96 feeNumerator = 100;
        uint96 feeDenominator = 10000;

        // setDefaultRoyalty: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.setDefaultRoyalty(ZERO_ADDRESS, 0);

        // freezeRoyalty: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.freezeRoyalty();

        // setDefaultRoyalty: success
        vm.prank(owner);
        sft.setDefaultRoyalty(royaltyReceiver, feeNumerator);

        {
            vm.expectRevert(
                abi.encodeWithSelector(AbsSFT.TokenUnregistered.selector, 0)
            );
            sft.royaltyInfo(0, 0);
        }

        // addMinter: success
        vm.prank(owner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(owner);
        sft.registerToken(1, "", 1);

        {
            (address receiver, uint256 amount) = sft.royaltyInfo(1, 1 ether);
            assertEq(receiver, royaltyReceiver);
            assertEq(amount, (1 ether * feeNumerator) / feeDenominator);
        }

        // freezeRoyalty: success
        vm.prank(owner);
        sft.freezeRoyalty();

        // setDefaultRoyalty: failure: RoyaltyFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsSFT.RoyaltyFrozen.selector));
        sft.setDefaultRoyalty(ZERO_ADDRESS, 0);

        // freezeRoyalty: failure: RoyaltyFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsSFT.RoyaltyFrozen.selector));
        sft.freezeRoyalty();
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(sft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        sft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.InvalidMinter.selector, ZERO_ADDRESS)
        );
        sft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.InvalidMinter.selector, minter)
        );
        sft.removeMinter(minter);

        // addMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSFT.MinterAdded(minter);
        sft.addMinter(minter);

        assertTrue(sft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSFT.MinterAlreadyAdded.selector, minter)
        );
        sft.addMinter(minter);

        // removeMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSFT.MinterRemoved(minter);
        sft.removeMinter(minter);

        assertFalse(sft.isMinter(minter));

        // freezeMinters: success
        vm.prank(owner);
        sft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsSFT.MintersFrozen.selector));
        sft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsSFT.MintersFrozen.selector));
        sft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsSFT.MintersFrozen.selector));
        sft.freezeMinters();
    }
}
