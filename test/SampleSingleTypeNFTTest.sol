// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.33;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC4907} from "../contracts/IERC4907.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Test} from "forge-std/Test.sol";

import {IAirdroppableNFT} from "../contracts/IAirdroppableNFT.sol";
import {AbsNFT} from "../contracts/AbsNFT.sol";
import {SampleSingleTypeNFT} from "../contracts/SampleSingleTypeNFT.sol";

contract SampleSingleTypeNFTTest is Test {
    using Strings for uint256;

    SampleSingleTypeNFT private nft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private royaltyReceiver = makeAddr("royaltyReceiver");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        nft = new SampleSingleTypeNFT();
    }

    function testInitialState() public view {
        assertEq(nft.owner(), owner);
        assertFalse(nft.paused());
        assertEq(nft.minTokenType(), 0);
        assertEq(nft.maxTokenType(), 0);
    }

    function testInterface() public view {
        assertFalse(nft.supportsInterface(0x00000000));
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertTrue(nft.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
        assertTrue(nft.supportsInterface(0x49064906)); // ERC4906
        assertTrue(nft.supportsInterface(0xad092b5c)); // ERC4907
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
        nft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.ExpectedPause.selector)
        );
        nft.unpause();

        // pause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(owner);
        nft.pause();

        assertTrue(nft.paused());

        // pause: failure: EnforcePause
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        nft.pause();

        // unpause: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(owner);
        nft.unpause();

        assertFalse(nft.paused());
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
        nft.freezeTokenTypeRange();

        // freezeTokenTypeRange: failure: TokenTypeRangeFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.TokenTypeRangeFrozen.selector)
        );
        nft.freezeTokenTypeRange();
    }

    function testSetBaseTokenURI() public {
        string memory baseTokenURI = "https://nft.metadata.com/";

        // setBaseTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.setBaseTokenURI(baseTokenURI);

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.startPrank(minter);
        nft.airdrop(holder1);
        nft.airdrop(holder2);
        vm.stopPrank();

        assertEq(nft.tokenURI(0), "");
        assertEq(nft.tokenURI(1), "");

        // setBaseTokenURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.BatchMetadataUpdate(0, 1);
        nft.setBaseTokenURI(baseTokenURI);

        assertEq(
            nft.tokenURI(0),
            string(abi.encodePacked(baseTokenURI, "0/0"))
        );
        assertEq(
            nft.tokenURI(1),
            string(abi.encodePacked(baseTokenURI, "0/1"))
        );
    }

    function testSetTokenURIAndFreezeTokenURI() public {
        string memory baseTokenURI = "https://nft.metadata.com/";
        string memory tokenURI = "https://nft.metadata.com/0x0";

        // setTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.freezeTokenURI(0);

        // setTokenURI: failure: ERC721NonexistentToken
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        nft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: ERC721NonexistentToken
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        nft.freezeTokenURI(0);

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        assertEq(nft.tokenURI(0), "");

        // setBaseTokenURI: success
        vm.prank(owner);
        nft.setBaseTokenURI(baseTokenURI);

        assertEq(
            nft.tokenURI(0),
            string(abi.encodePacked(baseTokenURI, "0/0"))
        );

        // setTokenURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.MetadataUpdate(0);
        nft.setTokenURI(0, tokenURI);

        assertEq(nft.tokenURI(0), tokenURI);

        // freezeTokenURI: success
        vm.prank(owner);
        nft.freezeTokenURI(0);

        // setTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.TokenURIFrozen.selector, 0)
        );
        nft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.TokenURIFrozen.selector, 0)
        );
        nft.freezeTokenURI(0);
    }

    function testAirdrop() public {
        // airdrop: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.InvalidMinter.selector, minter)
        );
        nft.airdrop(holder1);

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        assertEq(nft.balanceOf(holder1), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.ownerOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    holder1,
                    0
                )
            );
            nft.tokenOfOwnerByIndex(holder1, 0);
        }
        assertEq(nft.totalSupply(), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    address(0),
                    0
                )
            );
            nft.tokenByIndex(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.tokenURI(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.tokenType(0);
        }
        assertEq(nft.typeSupply(0), 0);
        assertEq(nft.typeBalanceOf(holder1, 0), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.firstOwnerOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.holdingPeriod(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.royaltyInfo(0, 0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userExpires(0);
        }

        // airdrop: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(address(0), holder1, 0);
        nft.airdrop(holder1);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), "");
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 0);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);

        // airdrop: failure: AlreadyAirdropped
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                SampleSingleTypeNFT.AlreadyAirdropped.selector,
                holder1
            )
        );
        nft.airdrop(holder1);

        // pause: success
        vm.prank(owner);
        nft.pause();

        // airdrop: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        nft.airdrop(holder1);

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.holdingPeriod(0), 1 days);
    }

    function testAirdropByType() public {
        // airdropByType: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        nft.airdropByType(holder1, 0);
    }

    function testAirdropWithTokenURI() public {
        // airdropWithTokenURI: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        nft.airdropWithTokenURI(holder1, "");
    }

    function testSafeTransferFromHolder1ToHolder2() public {
        string memory tokenURI = "https://nft.metadata.com/0x0";

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        // setTokenURI: success
        vm.prank(owner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, uint64(block.timestamp + 2 days));

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.balanceOf(holder2), 0);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 1);
        assertEq(nft.typeBalanceOf(holder2, 0), 0);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 1 days);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(holder1, holder2, 0);
        vm.expectEmit(true, true, true, true);
        emit IERC4907.UpdateUser(0, address(0), 0);
        nft.safeTransferFrom(holder1, holder2, 0);

        assertEq(nft.balanceOf(holder1), 0);
        assertEq(nft.balanceOf(holder2), 1);
        assertEq(nft.ownerOf(0), holder2);
        assertEq(nft.tokenOfOwnerByIndex(holder2, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 0);
        assertEq(nft.typeBalanceOf(holder2, 0), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 0);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);
    }

    function testSafeTransferFromHolder1ToHolder1() public {
        string memory tokenURI = "https://nft.metadata.com/0x0";

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        // setTokenURI: success
        vm.prank(owner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, uint64(block.timestamp + 2 days));

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 1 days);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(holder1, holder1, 0);
        nft.safeTransferFrom(holder1, holder1, 0);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 1 days);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));
    }

    function testBurn() public {
        string memory tokenURI = "https://nft.metadata.com/0x0";

        // burn: failure: ERC721NonexistentToken
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        nft.burn(0);

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        // burn: failure: ERC721InsufficientApproval
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                owner,
                0
            )
        );
        nft.burn(0);

        // setTokenURI: success
        vm.prank(owner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, uint64(block.timestamp + 2 days));

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 0);
        assertEq(nft.typeSupply(0), 1);
        assertEq(nft.typeBalanceOf(holder1, 0), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 1 days);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(holder1, address(0), 0);
        vm.expectEmit(true, true, true, true);
        emit IERC4907.UpdateUser(0, address(0), 0);
        nft.burn(0);

        assertEq(nft.balanceOf(holder1), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.ownerOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    holder1,
                    0
                )
            );
            nft.tokenOfOwnerByIndex(holder1, 0);
        }
        assertEq(nft.totalSupply(), 0);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    ERC721Enumerable.ERC721OutOfBoundsIndex.selector,
                    address(0),
                    0
                )
            );
            nft.tokenByIndex(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.tokenURI(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.tokenType(0);
        }
        assertEq(nft.typeSupply(0), 0);
        assertEq(nft.typeBalanceOf(holder1, 0), 0);
        assertEq(nft.firstOwnerOf(0), holder1);
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.holdingPeriod(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.royaltyInfo(0, 0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userExpires(0);
        }
    }

    function testSetDefaultRoyaltyAndFreezeRoyalty() public {
        uint96 feeNumerator = 100;
        uint96 feeDenominator = 10000;

        // setDefaultRoyalty: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.setDefaultRoyalty(royaltyReceiver, feeNumerator);

        // freezeRoyalty: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.freezeRoyalty();

        // setDefaultRoyalty: success
        vm.prank(owner);
        nft.setDefaultRoyalty(royaltyReceiver, feeNumerator);

        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.royaltyInfo(0, 0);
        }

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, royaltyReceiver);
            assertEq(amount, (1 ether * feeNumerator) / feeDenominator);
        }

        // freezeRoyalty: success
        vm.prank(owner);
        nft.freezeRoyalty();

        // setDefaultRoyalty: failure: RoyaltyFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.RoyaltyFrozen.selector));
        nft.setDefaultRoyalty(owner, feeNumerator);

        // freezeRoyalty: failure: RoyaltyFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.RoyaltyFrozen.selector));
        nft.freezeRoyalty();
    }

    function testSetUser() public {
        // setUser: failure: ERC721NonexistentToken
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        nft.setUser(0, owner, 0);

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userOf(0);
        }
        {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IERC721Errors.ERC721NonexistentToken.selector,
                    0
                )
            );
            nft.userExpires(0);
        }

        // airdrop: success
        vm.prank(minter);
        nft.airdrop(holder1);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);

        // setUser: failure: ERC721InsufficientApproval
        vm.prank(holder2);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                holder2,
                0
            )
        );
        nft.setUser(0, holder2, 0);

        // setUser: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit IERC4907.UpdateUser(0, holder2, uint64(block.timestamp + 1 days));
        nft.setUser(0, holder2, uint64(block.timestamp + 1 days));

        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), block.timestamp);

        // approve: success
        vm.prank(holder1);
        nft.approve(holder2, 0);

        // setUser: success
        vm.prank(holder2);
        vm.expectEmit(true, true, true, true);
        emit IERC4907.UpdateUser(0, holder2, uint64(block.timestamp + 1 days));
        nft.setUser(0, holder2, uint64(block.timestamp + 1 days));

        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), uint64(block.timestamp + 1 days));

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), block.timestamp);
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(nft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.addMinter(minter);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.removeMinter(minter);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                minter
            )
        );
        nft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.InvalidMinter.selector, address(0))
        );
        nft.addMinter(address(0));

        // removeMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.InvalidMinter.selector, minter)
        );
        nft.removeMinter(minter);

        // addMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsNFT.MinterAdded(minter);
        nft.addMinter(minter);

        assertTrue(nft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.MinterAlreadyAdded.selector, minter)
        );
        nft.addMinter(minter);

        // removeMinter: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit AbsNFT.MinterRemoved(minter);
        nft.removeMinter(minter);

        assertFalse(nft.isMinter(minter));

        // freezeMinters: success
        vm.prank(owner);
        nft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.MintersFrozen.selector));
        nft.addMinter(minter);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.MintersFrozen.selector));
        nft.removeMinter(minter);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.MintersFrozen.selector));
        nft.freezeMinters();
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
        nft.refreshMetadata();

        // refreshMetadata: failure: NoTokensMinted
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SampleSingleTypeNFT.NoTokensMinted.selector)
        );
        nft.refreshMetadata();

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdrop: success
        vm.startPrank(minter);
        nft.airdrop(holder1);
        nft.airdrop(holder2);
        vm.stopPrank();

        // refreshMetadata: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.BatchMetadataUpdate(0, 1);
        nft.refreshMetadata();
    }
}
