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

import {IAirdroppableNFT} from "../contracts/IAirdroppableNFT.sol";
import {AbsNFT} from "../contracts/AbsNFT.sol";
import {SampleTypelessNFT} from "../contracts/SampleTypelessNFT.sol";

import {Test} from "./Test.sol";

contract SampleTypelessNFTTest is Test {
    using Strings for uint256;

    SampleTypelessNFT private nft;

    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");
    address private royaltyReceiver = makeAddr("royaltyReceiver");
    address private holder1 = makeAddr("holder1");
    address private holder2 = makeAddr("holder2");

    function setUp() public {
        vm.prank(owner);
        nft = new SampleTypelessNFT();
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
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
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
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
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

    function testSetTokenURIAndFreezeTokenURI() public {
        string memory tokenURI1 = "https://nft.metadata.com/v1/0x0";
        string memory tokenURI2 = "https://nft.metadata.com/v2/0x0";

        // setTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.setTokenURI(0, "");

        // freezeTokenURI: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
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
        nft.setTokenURI(0, "");

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

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, tokenURI1);

        assertEq(nft.tokenURI(0), tokenURI1);

        // setTokenURI: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.MetadataUpdate(0);
        nft.setTokenURI(0, tokenURI2);

        assertEq(nft.tokenURI(0), tokenURI2);

        // freezeTokenURI: success
        vm.prank(owner);
        nft.freezeTokenURI(0);

        // setTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.TokenURIFrozen.selector, 0)
        );
        nft.setTokenURI(0, "");

        // freezeTokenURI: failure: TokenURIFrozen
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.TokenURIFrozen.selector, 0)
        );
        nft.freezeTokenURI(0);
    }

    function testAirdrop() public {
        // airdrop: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        nft.airdrop(ZERO_ADDRESS);
    }

    function testAirdropByType() public {
        // airdropByType: failure: UnsupportedFunction
        vm.expectRevert(
            abi.encodeWithSelector(
                IAirdroppableNFT.UnsupportedFunction.selector
            )
        );
        nft.airdropByType(ZERO_ADDRESS, 0);
    }

    function testAirdropWithTokenURI() public {
        string memory tokenURI = "https://nft.metadata.com/0x0";

        // airdropWithTokenURI: failure: InvalidMinter
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.InvalidMinter.selector, minter)
        );
        nft.airdropWithTokenURI(holder1, tokenURI);

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
                    ZERO_ADDRESS,
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

        // airdropWithTokenURI: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(ZERO_ADDRESS, holder1, 0);
        nft.airdropWithTokenURI(holder1, tokenURI);

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
        assertEq(nft.holdingPeriod(0), 0);
        {
            (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
            assertEq(receiver, owner);
            assertEq(amount, 0);
        }
        assertEq(nft.userOf(0), ZERO_ADDRESS);
        assertEq(nft.userExpires(0), 0);

        // pause: success
        vm.prank(owner);
        nft.pause();

        // airdropWithTokenURI: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(
            abi.encodeWithSelector(Pausable.EnforcedPause.selector)
        );
        nft.airdropWithTokenURI(ZERO_ADDRESS, "");

        // time passes...
        vm.warp(block.timestamp + 1 days);

        assertEq(nft.holdingPeriod(0), 1 days);
    }

    function testSafeTransferFromHolder1ToHolder2() public {
        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, "");

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
        assertEq(nft.tokenURI(0), "");
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
        emit IERC4907.UpdateUser(0, ZERO_ADDRESS, 0);
        nft.safeTransferFrom(holder1, holder2, 0);

        assertEq(nft.balanceOf(holder1), 0);
        assertEq(nft.balanceOf(holder2), 1);
        assertEq(nft.ownerOf(0), holder2);
        assertEq(nft.tokenOfOwnerByIndex(holder2, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), "");
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
        assertEq(nft.userOf(0), ZERO_ADDRESS);
        assertEq(nft.userExpires(0), 0);
    }

    function testSafeTransferFromHolder1ToHolder1() public {
        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, "");

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
        assertEq(nft.tokenURI(0), "");
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
        assertEq(nft.tokenURI(0), "");
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

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, tokenURI);

        // burn: failure: ERC721InsufficientApproval
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721InsufficientApproval.selector,
                ZERO_ADDRESS,
                0
            )
        );
        nft.burn(0);

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
        emit IERC721.Transfer(holder1, ZERO_ADDRESS, 0);
        vm.expectEmit(true, true, true, true);
        emit IERC4907.UpdateUser(0, ZERO_ADDRESS, 0);
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
                    ZERO_ADDRESS,
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
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.setDefaultRoyalty(ZERO_ADDRESS, 0);

        // freezeRoyalty: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
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

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, "");

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
        nft.setDefaultRoyalty(ZERO_ADDRESS, 0);

        // freezeRoyalty: failure: RoyaltyFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.RoyaltyFrozen.selector));
        nft.freezeRoyalty();
    }

    function testSetUser() public {
        // setUser: failure: ERC721NonexistentToken
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC721Errors.ERC721NonexistentToken.selector,
                0
            )
        );
        nft.setUser(0, ZERO_ADDRESS, 0);

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

        // airdropWithTokenURI: success
        vm.prank(minter);
        nft.airdropWithTokenURI(holder1, "");

        assertEq(nft.userOf(0), ZERO_ADDRESS);
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

        assertEq(nft.userOf(0), ZERO_ADDRESS);
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

        assertEq(nft.userOf(0), ZERO_ADDRESS);
        assertEq(nft.userExpires(0), block.timestamp);
    }

    function testAddMinterAndRemoveMinterAndFreezeMinters() public {
        assertFalse(nft.isMinter(minter));

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.freezeMinters();

        // addMinter: failure: InvalidMinter
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(AbsNFT.InvalidMinter.selector, ZERO_ADDRESS)
        );
        nft.addMinter(ZERO_ADDRESS);

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
        nft.addMinter(ZERO_ADDRESS);

        // removeMinter: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.MintersFrozen.selector));
        nft.removeMinter(ZERO_ADDRESS);

        // freezeMinters: failure: MintersFrozen
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(AbsNFT.MintersFrozen.selector));
        nft.freezeMinters();
    }

    function testRefreshMetadata() public {
        // refreshMetadata: failure: OwnableUnauthorizedAccount
        vm.prank(ZERO_ADDRESS);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                ZERO_ADDRESS
            )
        );
        nft.refreshMetadata();

        // refreshMetadata: failure: NoTokensMinted
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SampleTypelessNFT.NoTokensMinted.selector)
        );
        nft.refreshMetadata();

        // addMinter: success
        vm.prank(owner);
        nft.addMinter(minter);

        // airdropWithTokenURI: success
        vm.startPrank(minter);
        nft.airdropWithTokenURI(holder1, "");
        nft.airdropWithTokenURI(holder2, "");
        vm.stopPrank();

        // refreshMetadata: success
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit IERC4906.BatchMetadataUpdate(0, 1);
        nft.refreshMetadata();
    }
}
