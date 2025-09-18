// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "forge-std/console2.sol";

import {BaseSFT} from "../contracts/BaseSFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {SampleSFT} from "../contracts/SampleSFT.sol";
import {IAirdroppableSFT} from "../contracts/IAirdroppableSFT.sol";

contract SampleSFTTest is Test {
    SampleSFT sft;

    address runner = makeAddr("runner");
    address minter = makeAddr("minter");
    address holder1 = makeAddr("holder1");
    address holder2 = makeAddr("holder2");

    uint256 constant DUMMY_PERIOD = 60;

    function setUp() public {
        vm.startPrank(runner);
        sft = new SampleSFT();
        vm.stopPrank();
    }

    function test_InitialState() public {
        assertEq(sft.owner(), runner);
        assertTrue(sft.paused());
    }

    function test_SupportsInterface() public {
        assertFalse(sft.supportsInterface(0x00000000));
        assertTrue(sft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(sft.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(sft.supportsInterface(0x2a55205a)); // ERC2981
    }

    function test_PauseUnpause() public {
        // pause: failure: EnforcedPause
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.unpause();

        // unpause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(runner);
        sft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        sft.unpause();

        // pause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.pause();

        // pause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(runner);
        sft.pause();
    }

    function test_RegisterTokenAndFreezeTokenRegistration() public {
        string memory tokenURI = "https://sft-metadata.com/0x1";

        // registerToken: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.registerToken(1, tokenURI, 1);

        // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.freezeTokenRegistration();

        // registerToken: failure: InvalidHoldingAmountThreshold
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(
                BaseSFT.InvalidHoldingAmountThreshold.selector,
                0
            )
        );
        sft.registerToken(1, tokenURI, 0);

        assertFalse(sft.isTokenRegistered(1));
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.uri(1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.holdingAmountThreshold(1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.royaltyInfo(1, 1 ether);

        // registerToken: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseSFT.TokenRegistered(1, tokenURI, 1);
        sft.registerToken(1, tokenURI, 1);

        assertTrue(sft.isTokenRegistered(1));
        assertEq(sft.uri(1), tokenURI);
        assertEq(sft.holdingAmountThreshold(1), 1);

        (address receiver, uint256 amount) = sft.royaltyInfo(1, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);

        // registerToken: failure: TokenAlreadyRegistered
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenAlreadyRegistered.selector, 1)
        );
        sft.registerToken(1, tokenURI, 1);

        // freezeTokenRegistration: success
        vm.prank(runner);
        sft.freezeTokenRegistration();

        // registerToken: failure: TokenRegistrationFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenRegistrationFrozen.selector)
        );
        sft.registerToken(1, tokenURI, 1);

        // freezeTokenRegistration: failure: TokenRegistrationFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenRegistrationFrozen.selector)
        );
        sft.freezeTokenRegistration();
    }

    function test_SetSupplyCapAndFreezeSupplyCap() public {
        // setSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.freezeSupplyCap(0);

        // setSupplyCap: failure: TokenUnregistered
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 0)
        );
        sft.setSupplyCap(0, 0);

        // freezeSupplyCap: failure: TokenUnregistered
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 0)
        );
        sft.freezeSupplyCap(0);

        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 1);

        assertEq(sft.supplyCap(1), 0);

        // setSupplyCap: success
        vm.prank(runner);
        sft.setSupplyCap(1, 4);

        assertEq(sft.supplyCap(1), 4);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 2);

        // setSupplyCap: failure: InvalidSupplyCap
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.InvalidSupplyCap.selector, 1, 1)
        );
        sft.setSupplyCap(1, 1);

        // setSupplyCap: success
        vm.prank(runner);
        sft.setSupplyCap(1, 3);

        assertEq(sft.supplyCap(1), 3);

        // freezeSupplyCap: success
        vm.prank(runner);
        sft.freezeSupplyCap(1);

        // setSupplyCap: failure: SupplyCapFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.SupplyCapFrozen.selector, 1)
        );
        sft.setSupplyCap(1, 4);

        // freezeSupplyCap: failure: SupplyCapFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.SupplyCapFrozen.selector, 1)
        );
        sft.freezeSupplyCap(1);
    }

    function test_SetURIAndFreezeURI_UnauthorizedAccount() public {
        string memory tokenURI = "https://sft-metadata.com/0x1";

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.setURI(1, tokenURI);

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.freezeURI(1);
    }

    function test_SetURIAndFreezeURI_TokenUnregistered() public {
        string memory tokenURI = "https://sft-metadata.com/0x1";

        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.setURI(1, tokenURI);

        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.freezeURI(1);
    }

    function test_SetURIAndFreezeURI_Success_ThenFrozen() public {
        string memory tokenURI = "https://sft-metadata.com/0x1";

        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 1);

        assertEq(sft.uri(1), "");

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 1);

        // setURI: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.URI(tokenURI, 1);
        sft.setURI(1, tokenURI);

        assertEq(sft.uri(1), tokenURI);

        // freezeURI: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseSFT.PermanentURI(tokenURI, 1);
        sft.freezeURI(1);

        assertEq(sft.uri(1), tokenURI);

        // setURI: failure: TokenURIFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenURIFrozen.selector, 1)
        );
        sft.setURI(1, tokenURI);

        // freezeURI: failure: TokenURIFrozen
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenURIFrozen.selector, 1)
        );
        sft.freezeURI(1);
    }

    function test_Airdrop_InvalidMinter() public {
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.InvalidMinter.selector, minter)
        );
        sft.airdrop(holder1, 0, 1);
    }

    function test_Airdrop_EnforcedPause() public {
        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sft.airdrop(holder1, 0, 1);
    }

    function test_Airdrop_TokenUnregistered() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // airdrop: failure: TokenUnregistered
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 0)
        );
        sft.airdrop(holder1, 0, 1);
    }

    function test_Airdrop_SupplyCapExceeded() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 1);

        // setSupplyCap: success
        vm.prank(runner);
        sft.setSupplyCap(1, 1);

        // airdrop: failure: SupplyCapExceeded
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.SupplyCapExceeded.selector, 1)
        );
        sft.airdrop(holder1, 1, 2);
    }

    function test_Airdrop_Success() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 3);

        assertEq(sft.balanceOf(holder1, 1), 0);
        assertEq(sft.totalSupply(), 0);
        assertEq(sft.totalSupply(1), 0);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, address(0), holder1, 1, 1);
        sft.airdrop(holder1, 1, 1);

        assertEq(sft.balanceOf(holder1, 1), 1);
        assertEq(sft.totalSupply(), 1);
        assertEq(sft.totalSupply(1), 1);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(minter, address(0), holder1, 1, 2);
        sft.airdrop(holder1, 1, 2);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(sft.balanceOf(holder1, 1), 3);
        assertEq(sft.totalSupply(), 3);
        assertEq(sft.totalSupply(1), 3);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );
    }

    function test_SafeTransferFrom_TokenUnregistered() public {
        vm.prank(holder1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.safeTransferFrom(holder1, holder2, 1, 1, "0x");
    }

    function test_SafeTransferFrom_Success() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 3);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 4);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(sft.balanceOf(holder1, 1), 4);
        assertEq(sft.balanceOf(holder2, 1), 0);
        assertEq(sft.totalSupply(), 4);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, holder2, 1, 1);
        sft.safeTransferFrom(holder1, holder2, 1, 1, "0x");

        assertEq(sft.balanceOf(holder1, 1), 3);
        assertEq(sft.balanceOf(holder2, 1), 1);
        assertEq(sft.totalSupply(), 4);
        assertEq(sft.totalSupply(1), 4);
        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, holder2, 1, 2);
        sft.safeTransferFrom(holder1, holder2, 1, 2, "0x");

        uint256 holdingStartedAt2 = block.timestamp;

        assertEq(sft.balanceOf(holder1, 1), 1);
        assertEq(sft.balanceOf(holder2, 1), 3);
        assertEq(sft.totalSupply(), 4);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(
            sft.holdingPeriod(holder2, 1),
            block.timestamp - holdingStartedAt2
        );

        // safeTransferFrom: success
        vm.prank(holder2);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder2, holder2, holder1, 1, 3);
        sft.safeTransferFrom(holder2, holder1, 1, 3, "0x");

        uint256 holdingStartedAt3 = block.timestamp;

        assertEq(sft.balanceOf(holder1, 1), 4);
        assertEq(sft.balanceOf(holder2, 1), 0);
        assertEq(sft.totalSupply(), 4);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt3
        );
        assertEq(sft.holdingPeriod(holder2, 1), 0);
    }

    function test_SafeBatchTransferFrom_TokenUnregistered() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(holder1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.safeBatchTransferFrom(holder1, holder2, ids, amounts, "0x");
    }

    function test_SafeBatchTransferFrom_Success() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 3);
        vm.prank(runner);
        sft.registerToken(2, "", 3);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 4);

        uint256 holdingStartedAt1 = block.timestamp;

        vm.warp(block.timestamp + 1);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 2, 4);

        uint256 holdingStartedAt2 = block.timestamp;

        address[] memory accounts = new address[](4);
        accounts[0] = holder1;
        accounts[1] = holder1;
        accounts[2] = holder2;
        accounts[3] = holder2;

        uint256[] memory ids = new uint256[](4);
        ids[0] = 1;
        ids[1] = 2;
        ids[2] = 1;
        ids[3] = 2;

        uint256[] memory balances = sft.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 4);
        assertEq(balances[1], 4);
        assertEq(balances[2], 0);
        assertEq(balances[3], 0);

        assertEq(sft.totalSupply(), 8);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.totalSupply(2), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 1);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt1
        );
        assertEq(
            sft.holdingPeriod(holder1, 2),
            block.timestamp - holdingStartedAt2
        );
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);

        // safeBatchTransferFrom: success
        uint256[] memory transferIds = new uint256[](2);
        transferIds[0] = 1;
        transferIds[1] = 2;
        uint256[] memory transferAmounts = new uint256[](2);
        transferAmounts[0] = 1;
        transferAmounts[1] = 2;

        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            holder2,
            transferIds,
            transferAmounts
        );
        sft.safeBatchTransferFrom(
            holder1,
            holder2,
            transferIds,
            transferAmounts,
            "0x"
        );

        balances = sft.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 3);
        assertEq(balances[1], 2);
        assertEq(balances[2], 1);
        assertEq(balances[3], 2);

        assertEq(sft.totalSupply(), 8);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.totalSupply(2), 4);
        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt1
        );
        assertEq(sft.holdingPeriod(holder1, 2), 0);
        assertEq(sft.holdingPeriod(holder2, 1), 0);
        assertEq(sft.holdingPeriod(holder2, 2), 0);
    }

    function test_Burn_TokenUnregistered() public {
        vm.prank(holder1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.burn(holder1, 1, 1);
    }

    function test_Burn_Success() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 3);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 4);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(sft.balanceOf(holder1, 1), 4);
        assertEq(sft.totalSupply(), 4);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, address(0), 1, 1);
        sft.burn(holder1, 1, 1);

        assertEq(sft.balanceOf(holder1, 1), 3);
        assertEq(sft.totalSupply(), 3);
        assertEq(sft.totalSupply(1), 3);
        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt
        );

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferSingle(holder1, holder1, address(0), 1, 2);
        sft.burn(holder1, 1, 2);

        assertEq(sft.balanceOf(holder1, 1), 1);
        assertEq(sft.totalSupply(), 1);
        assertEq(sft.totalSupply(1), 1);
        assertEq(sft.holdingPeriod(holder1, 1), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(sft.holdingPeriod(holder1, 1), 0);
    }

    function test_BurnBatch_TokenUnregistered() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1;
        amounts[1] = 1;

        vm.prank(holder1);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 1)
        );
        sft.burnBatch(holder1, ids, amounts);
    }

    function test_BurnBatch_Success() public {
        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 3);
        vm.prank(runner);
        sft.registerToken(2, "", 3);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 4);

        uint256 holdingStartedAt1 = block.timestamp;

        vm.warp(block.timestamp + 1);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 2, 4);

        uint256 holdingStartedAt2 = block.timestamp;

        address[] memory accounts = new address[](2);
        accounts[0] = holder1;
        accounts[1] = holder1;

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        uint256[] memory balances = sft.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 4);
        assertEq(balances[1], 4);

        assertEq(sft.totalSupply(), 8);
        assertEq(sft.totalSupply(1), 4);
        assertEq(sft.totalSupply(2), 4);
        assertEq(sft.holdingPeriod(holder1, 1), 1);
        assertEq(sft.holdingPeriod(holder1, 2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt1
        );
        assertEq(
            sft.holdingPeriod(holder1, 2),
            block.timestamp - holdingStartedAt2
        );

        // burnBatch: success
        uint256[] memory burnAmounts = new uint256[](2);
        burnAmounts[0] = 1;
        burnAmounts[1] = 2;

        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            address(0),
            ids,
            burnAmounts
        );
        sft.burnBatch(holder1, ids, burnAmounts);

        balances = sft.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 3);
        assertEq(balances[1], 2);

        assertEq(sft.totalSupply(), 5);
        assertEq(sft.totalSupply(1), 3);
        assertEq(sft.totalSupply(2), 2);
        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt1
        );
        assertEq(sft.holdingPeriod(holder1, 2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(
            sft.holdingPeriod(holder1, 1),
            block.timestamp - holdingStartedAt1
        );
        assertEq(sft.holdingPeriod(holder1, 2), 0);

        // burnBatch: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC1155.TransferBatch(
            holder1,
            holder1,
            address(0),
            ids,
            burnAmounts
        );
        sft.burnBatch(holder1, ids, burnAmounts);

        balances = sft.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 2);
        assertEq(balances[1], 0);

        assertEq(sft.totalSupply(), 2);
        assertEq(sft.totalSupply(1), 2);
        assertEq(sft.totalSupply(2), 0);
        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(sft.holdingPeriod(holder1, 1), 0);
        assertEq(sft.holdingPeriod(holder1, 2), 0);
    }

    function test_SetDefaultRoyalty_UnauthorizedAccount() public {
        uint96 feeNumerator = 300;

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.setDefaultRoyalty(minter, feeNumerator);

        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.freezeRoyalty();
    }

    function test_SetDefaultRoyalty_Success_ThenFrozen() public {
        uint96 feeNumerator = 300;
        uint256 feeDenominator = 10000;

        // setDefaultRoyalty: success
        vm.prank(runner);
        sft.setDefaultRoyalty(minter, feeNumerator);

        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.TokenUnregistered.selector, 0)
        );
        sft.royaltyInfo(0, 1 ether);

        // unpause: success
        vm.prank(runner);
        sft.unpause();

        // addMinter: success
        vm.prank(runner);
        sft.addMinter(minter);

        // registerToken: success
        vm.prank(runner);
        sft.registerToken(1, "", 1);

        // airdrop: success
        vm.prank(minter);
        sft.airdrop(holder1, 1, 1);

        (address receiver, uint256 amount) = sft.royaltyInfo(1, 1 ether);
        assertEq(receiver, minter);
        assertEq(amount, (1 ether * feeNumerator) / feeDenominator);

        // freezeRoyalty: success
        vm.prank(runner);
        sft.freezeRoyalty();

        // setDefaultRoyalty: failure: RoyaltyFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseSFT.RoyaltyFrozen.selector));
        sft.setDefaultRoyalty(minter, feeNumerator);

        // freezeRoyalty: failure: RoyaltyFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseSFT.RoyaltyFrozen.selector));
        sft.freezeRoyalty();
    }

    function test_AddRemoveFreezeMinters() public {
        assertFalse(sft.isMinter(minter));

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.freezeMinters();

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.addMinter(minter);

        // addMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.InvalidMinter.selector, address(0))
        );
        sft.addMinter(address(0));

        // removeMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.InvalidMinter.selector, minter)
        );
        sft.removeMinter(minter);

        // addMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseSFT.MinterAdded(minter);
        sft.addMinter(minter);

        assertTrue(sft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(runner);
        vm.expectRevert(
            abi.encodeWithSelector(BaseSFT.MinterAlreadyAdded.selector, minter)
        );
        sft.addMinter(minter);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sft.removeMinter(minter);

        // removeMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BaseSFT.MinterRemoved(minter);
        sft.removeMinter(minter);

        assertFalse(sft.isMinter(minter));

        // freezeMinters: success
        vm.prank(runner);
        sft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseSFT.MintersFrozen.selector));
        sft.addMinter(minter);

        // removeMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseSFT.MintersFrozen.selector));
        sft.removeMinter(minter);

        // freezeMinters: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(BaseSFT.MintersFrozen.selector));
        sft.freezeMinters();
    }
}
