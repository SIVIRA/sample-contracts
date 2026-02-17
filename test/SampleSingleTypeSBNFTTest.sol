// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Test} from "forge-std/Test.sol";

import {IAirdroppableNFT} from "../contracts/IAirdroppableNFT.sol";
import {AbsSBNFT} from "../contracts/AbsSBNFT.sol";
import {SampleSingleTypeSBNFT} from "../contracts/SampleSingleTypeSBNFT.sol";

contract SampleSingleTypeSBNFTTest is Test {
    using Strings for uint256;

    SampleSingleTypeSBNFT private sbnft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        sbnft = new SampleSingleTypeSBNFT();
    }

    function testInitialState() public view {
        assertEq(sbnft.owner(), owner);
        assertFalse(sbnft.paused());
        assertEq(sbnft.minTokenType(), 0);
        assertEq(sbnft.maxTokenType(), 0);
    }

    function testInterface() public view {
        assertFalse(sbnft.supportsInterface(0x00000000));
        assertTrue(sbnft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(sbnft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(sbnft.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertTrue(sbnft.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(sbnft.supportsInterface(0x49064906)); // ERC4906
    }

    function testPauseAndUnpause() public {
        // pause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        sbnft.unpause();

        // pause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(owner);
        sbnft.pause();

        assertTrue(sbnft.paused());

        // pause: failure: EnforcePause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sbnft.pause();

        // unpause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(owner);
        sbnft.unpause();

        assertFalse(sbnft.paused());
    }

    function testFreezeTokenTypeRange() public {
        // freezeTokenTypeRange: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.freezeTokenTypeRange();

        // freezeTokenTypeRange: failure: TokenTypeRangeFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.TokenTypeRangeFrozen.selector)
        );
        sbnft.freezeTokenTypeRange();
    }

    function testSetBaseTokenURI() public {
        string memory baseTokenURI = "https://sbnft.metadata.com/";

        // setBaseTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.setBaseTokenURI(baseTokenURI);

        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        // airdrop: success
        vm.startPrank(minter);
        sbnft.airdrop(holder1);
        sbnft.airdrop(holder2);
        vm.stopPrank();

        assertEq(sbnft.tokenURI(0), "");
        assertEq(sbnft.tokenURI(1), "");

        // setBaseTokenURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.BatchMetadataUpdate(0, 1);
        sbnft.setBaseTokenURI(baseTokenURI);

        assertEq(
            sbnft.tokenURI(0),
            string(abi.encodePacked(baseTokenURI, "0/0"))
        );
        assertEq(
            sbnft.tokenURI(1),
            string(abi.encodePacked(baseTokenURI, "0/1"))
        );
    }

    function testSetTokenURIAndFreezeTokenURI() public {
        string memory baseTokenURI = "https://sbnft.metadata.com/";
        string memory tokenURI = "https://sbnft.metadata.com/0x0";

        // setTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.freezeTokenURI(0);

        // setTokenURI: failure: ERC721NonexistentToken
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        sbnft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: ERC721NonexistentToken
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        sbnft.freezeTokenURI(0);

        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        sbnft.airdrop(holder1);

        assertEq(sbnft.tokenURI(0), "");

        // setBaseTokenURI: success
        vm.prank(owner);
        sbnft.setBaseTokenURI(baseTokenURI);

        assertEq(
            sbnft.tokenURI(0),
            string(abi.encodePacked(baseTokenURI, "0/0"))
        );

        // setTokenURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.MetadataUpdate(0);
        sbnft.setTokenURI(0, tokenURI);

        assertEq(sbnft.tokenURI(0), tokenURI);

        // freezeTokenURI: success
        vm.prank(owner);
        sbnft.freezeTokenURI(0);

        // setTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.TokenURIFrozen.selector, 0)
        );
        sbnft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.TokenURIFrozen.selector, 0)
        );
        sbnft.freezeTokenURI(0);
    }

    function testAirdrop() public {
        // airdrop: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.InvalidMinter.selector, minter)
        );
        sbnft.airdrop(holder1);

        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        assertEq(sbnft.balanceOf(holder1), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.ownerOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    holder1,
                    0
                )
            );
            sbnft.tokenOfOwnerByIndex(holder1, 0);
        }
        assertEq(sbnft.totalSupply(), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    address(0),
                    0
                )
            );
            sbnft.tokenByIndex(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.tokenURI(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.tokenType(0);
        }
        assertEq(sbnft.typeSupply(0), 0);
        assertEq(sbnft.typeBalanceOf(holder1, 0), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.holdingPeriod(0);
        }

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(address(0), holder1, 0);
        sbnft.airdrop(holder1);

        assertEq(sbnft.balanceOf(holder1), 1);
        assertEq(sbnft.ownerOf(0), holder1);
        assertEq(sbnft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(sbnft.totalSupply(), 1);
        assertEq(sbnft.tokenByIndex(0), 0);
        assertEq(sbnft.tokenURI(0), "");
        assertEq(sbnft.tokenType(0), 0);
        assertEq(sbnft.typeSupply(0), 1);
        assertEq(sbnft.typeBalanceOf(holder1, 0), 1);
        assertEq(sbnft.holdingPeriod(0), 0);

        // airdrop: failure: AlreadyAirdropped
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                SampleSingleTypeSBNFT.AlreadyAirdropped.selector,
                holder1
            )
        );
        sbnft.airdrop(holder1);

        // pause: success
        vm.prank(owner);
        sbnft.pause();

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        sbnft.airdrop(holder1);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbnft.holdingPeriod(0), 1 days);
    }

    function testAirdropByType() public {
        // airdropByType: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        sbnft.airdropByType(holder1, 0);
    }

    function testAirdropWithTokenURI() public {
        // airdropWithTokenURI: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        sbnft.airdropWithTokenURI(holder1, "");
    }

    function testSafeTransferFrom() public {
        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        sbnft.airdrop(holder1);

        // safeTransferFrom: failure: Soulbound
        vm.prank(holder1);
        vm.expectRevert(abi.encodeWithSelector(AbsSBNFT.Soulbound.selector));
        sbnft.safeTransferFrom(holder1, holder2, 0);
    }

    function testBurn() public {
        string memory tokenURI = "https://sbnft.metadata.com/0x0";

        // burn: failure: ERC721NonexistentToken
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        sbnft.burn(0);

        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        sbnft.airdrop(holder1);

        // burn: failure: ERC721InsufficientApproval
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                owner,
                0
            )
        );
        sbnft.burn(0);

        // setTokenURI: success
        vm.prank(owner);
        sbnft.setTokenURI(0, tokenURI);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(sbnft.balanceOf(holder1), 1);
        assertEq(sbnft.ownerOf(0), holder1);
        assertEq(sbnft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(sbnft.totalSupply(), 1);
        assertEq(sbnft.tokenByIndex(0), 0);
        assertEq(sbnft.tokenURI(0), tokenURI);
        assertEq(sbnft.tokenType(0), 0);
        assertEq(sbnft.typeSupply(0), 1);
        assertEq(sbnft.typeBalanceOf(holder1, 0), 1);
        assertEq(sbnft.holdingPeriod(0), 1 days);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(holder1, address(0), 0);
        sbnft.burn(0);

        assertEq(sbnft.balanceOf(holder1), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.ownerOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    holder1,
                    0
                )
            );
            sbnft.tokenOfOwnerByIndex(holder1, 0);
        }
        assertEq(sbnft.totalSupply(), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    address(0),
                    0
                )
            );
            sbnft.tokenByIndex(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.tokenURI(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.tokenType(0);
        }
        assertEq(sbnft.typeSupply(0), 0);
        assertEq(sbnft.typeBalanceOf(holder1, 0), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            sbnft.holdingPeriod(0);
        }
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(sbnft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.addMinter(minter);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.removeMinter(minter);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.InvalidMinter.selector, address(0))
        );
        sbnft.addMinter(address(0));

        // removeMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.InvalidMinter.selector, minter)
        );
        sbnft.removeMinter(minter);

        // addMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSBNFT.MinterAdded(minter);
        sbnft.addMinter(minter);

        assertTrue(sbnft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.MinterAlreadyAdded.selector, minter)
        );
        sbnft.addMinter(minter);

        // removeMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsSBNFT.MinterRemoved(minter);
        sbnft.removeMinter(minter);

        assertFalse(sbnft.isMinter(minter));

        // freezeMinters: success
        vm.prank(owner);
        sbnft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.MintersFrozen.selector)
        );
        sbnft.addMinter(minter);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.MintersFrozen.selector)
        );
        sbnft.removeMinter(minter);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsSBNFT.MintersFrozen.selector)
        );
        sbnft.freezeMinters();
    }

    function testRefreshMetadata() public {
        // refreshMetadata: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        sbnft.refreshMetadata();

        // refreshMetadata: failure: NoTokensMinted
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                SampleSingleTypeSBNFT.NoTokensMinted.selector
            )
        );
        sbnft.refreshMetadata();

        // addMinter: success
        vm.prank(owner);
        sbnft.addMinter(minter);

        // airdrop: success
        vm.startPrank(minter);
        sbnft.airdrop(holder1);
        sbnft.airdrop(holder2);
        vm.stopPrank();

        // refreshMetadata: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.BatchMetadataUpdate(0, 1);
        sbnft.refreshMetadata();
    }
}
