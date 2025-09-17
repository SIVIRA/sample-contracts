// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import "forge-std/console2.sol";

import {SampleMultipleTypeNFT} from "../contracts/SampleMultipleTypeNFT.sol";
import {BaseNFT} from "../contracts/BaseNFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IAirdroppableNFT} from "../contracts/IAirdroppableNFT.sol";

// Error definitions
error InvalidMaxTokenType(uint256 maxTokenType);
error AlreadyAirdropped(uint256 tokenType, address to);
error InvalidTokenTypeRange(uint256 minTokenType, uint256 maxTokenType);
error TokenTypeRangeFrozen();
error InvalidTokenType(uint256 tokenType);
error TokenURIFrozen(uint256 tokenID);
error RoyaltyFrozen();
error InvalidMinter(address minter);
error MinterAlreadyAdded(address minter);
error MintersFrozen();
error ERC721NonexistentToken(uint256 tokenId);
error ERC721OutOfBoundsIndex(address owner, uint256 index);
error ERC721InsufficientApproval(address spender, uint256 tokenId);

// Event definitions
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
event MetadataUpdate(uint256 _tokenId);
event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
event PermanentURI(string value, uint256 indexed id);
event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);
event MinterAdded(address indexed minter);
event MinterRemoved(address indexed minter);

contract SampleMultipleTypeNFTTest is Test {
    SampleMultipleTypeNFT nft;

    address runner = makeAddr("runner");
    address minter = makeAddr("minter");
    address holder1 = makeAddr("holder1");
    address holder2 = makeAddr("holder2");

    uint256 constant NFT_MAX_TOKEN_TYPE = 3;
    uint256 constant DUMMY_PERIOD = 60;

    function setUp() public {
        vm.startPrank(runner);
        nft = new SampleMultipleTypeNFT(NFT_MAX_TOKEN_TYPE);
        vm.stopPrank();
    }

    function test_InitialState() public {
        assertEq(nft.owner(), runner);
        assertTrue(nft.paused());
        assertEq(nft.minTokenType(), 1);
        assertEq(nft.maxTokenType(), NFT_MAX_TOKEN_TYPE);
    }

    function test_SupportsInterface() public {
        assertFalse(nft.supportsInterface(0x00000000));
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertTrue(nft.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
        assertTrue(nft.supportsInterface(0x49064906)); // ERC4906
        assertTrue(nft.supportsInterface(0xad092b5c)); // ERC4907
    }

    function test_PauseUnpause() public {
        // pause: failure: EnforcedPause
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        nft.pause();

        // unpause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.unpause();

        // unpause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Unpaused(runner);
        nft.unpause();

        // unpause: failure: ExpectedPause
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(Pausable.ExpectedPause.selector));
        nft.unpause();

        // pause: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.pause();

        // pause: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit Pausable.Paused(runner);
        nft.pause();
    }

    function test_SetMaxTokenTypeAndFreezeTokenTypeRange_UnauthorizedAccount() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.setMaxTokenType(NFT_MAX_TOKEN_TYPE + 1);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.freezeTokenTypeRange();
    }

    function test_SetMaxTokenType_InvalidMaxTokenType() public {
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(InvalidMaxTokenType.selector, NFT_MAX_TOKEN_TYPE - 1));
        nft.setMaxTokenType(NFT_MAX_TOKEN_TYPE - 1);
    }

    function test_SetMaxTokenType_Success_ThenFrozen() public {
        // setMaxTokenType: success
        vm.prank(runner);
        nft.setMaxTokenType(NFT_MAX_TOKEN_TYPE + 1);

        assertEq(nft.minTokenType(), 1);
        assertEq(nft.maxTokenType(), NFT_MAX_TOKEN_TYPE + 1);

        // freezeTokenTypeRange: success
        vm.prank(runner);
        nft.freezeTokenTypeRange();

        // setMaxTokenType: failure: TokenTypeRangeFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(TokenTypeRangeFrozen.selector));
        nft.setMaxTokenType(NFT_MAX_TOKEN_TYPE + 2);

        // freezeTokenTypeRange: failure: TokenTypeRangeFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(TokenTypeRangeFrozen.selector));
        nft.freezeTokenTypeRange();
    }

    function test_SetBaseTokenURI_UnauthorizedAccount() public {
        string memory baseTokenURI = "https://nft-metadata.world/";
        
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.setBaseTokenURI(baseTokenURI);
    }

    function test_SetBaseTokenURI_Success_Single() public {
        string memory baseTokenURI = "https://nft-metadata.world/";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        assertEq(nft.tokenURI(0), "");

        // setBaseTokenURI: success: single
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit MetadataUpdate(0);
        nft.setBaseTokenURI(baseTokenURI);

        assertEq(nft.tokenURI(0), string(abi.encodePacked(baseTokenURI, "1/0")));
    }

    function test_SetBaseTokenURI_Success_Plural() public {
        string memory baseTokenURI = "https://nft-metadata.world/";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);
        vm.prank(minter);
        nft.airdropByType(holder2, 1);

        assertEq(nft.tokenURI(0), "");
        assertEq(nft.tokenURI(1), "");

        // setBaseTokenURI: success: plural
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BatchMetadataUpdate(0, 1);
        nft.setBaseTokenURI(baseTokenURI);

        assertEq(nft.tokenURI(0), string(abi.encodePacked(baseTokenURI, "1/0")));
        assertEq(nft.tokenURI(1), string(abi.encodePacked(baseTokenURI, "1/1")));
    }

    function test_SetTokenURI_UnauthorizedAccount() public {
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.setTokenURI(0, tokenURI);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.freezeTokenURI(0);
    }

    function test_SetTokenURI_NonexistentToken() public {
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.setTokenURI(0, tokenURI);

        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.freezeTokenURI(0);
    }

    function test_SetTokenURI_Success_ThenFrozen() public {
        string memory baseTokenURI = "https://nft-metadata.world/";
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        assertEq(nft.tokenURI(0), "");

        // setBaseTokenURI: success
        vm.prank(runner);
        nft.setBaseTokenURI(baseTokenURI);

        assertEq(nft.tokenURI(0), string(abi.encodePacked(baseTokenURI, "1/0")));

        // setTokenURI: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit MetadataUpdate(0);
        nft.setTokenURI(0, tokenURI);

        assertEq(nft.tokenURI(0), tokenURI);

        // freezeTokenURI: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit PermanentURI(tokenURI, 0);
        nft.freezeTokenURI(0);

        // setTokenURI: failure: TokenURIFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(TokenURIFrozen.selector, 0));
        nft.setTokenURI(0, tokenURI);

        // freezeTokenURI: failure: TokenURIFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(TokenURIFrozen.selector, 0));
        nft.freezeTokenURI(0);
    }

    function test_Airdrop_UnsupportedFunction() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IAirdroppableNFT.UnsupportedFunction.selector));
        nft.airdrop(holder1);
    }

    function test_AirdropByType_InvalidMinter() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidMinter.selector, minter));
        nft.airdropByType(holder1, 1);
    }

    function test_AirdropByType_EnforcedPause() public {
        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        nft.airdropByType(holder1, 1);
    }

    function test_AirdropByType_InvalidTokenType() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: failure: InvalidTokenType
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenType.selector, 0));
        nft.airdropByType(holder1, 0);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenType.selector, NFT_MAX_TOKEN_TYPE + 1));
        nft.airdropByType(holder1, NFT_MAX_TOKEN_TYPE + 1);
    }

    function test_AirdropByType_Success() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        assertEq(nft.balanceOf(holder1), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.ownerOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, holder1, 0));
        nft.tokenOfOwnerByIndex(holder1, 0);
        assertEq(nft.totalSupply(), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, address(0), 0));
        nft.tokenByIndex(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.tokenURI(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.tokenType(0);
        assertEq(nft.typeSupply(1), 0);
        assertEq(nft.typeBalanceOf(holder1, 1), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.firstOwnerOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.holdingPeriod(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.royaltyInfo(0, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userExpires(0);

        // airdropByType: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit Transfer(address(0), holder1, 0);
        nft.airdropByType(holder1, 1);

        uint256 holdingStartedAt = block.timestamp;

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), "");
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 0);
        
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);
        
        assertEq(nft.holdingPeriod(0), block.timestamp - holdingStartedAt);
    }

    function test_AirdropByType_AlreadyAirdropped() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        // airdropByType: failure: AlreadyAirdropped
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AlreadyAirdropped.selector, 1, holder1));
        nft.airdropByType(holder1, 1);

        // airdropByType: success (different type)
        vm.prank(minter);
        nft.airdropByType(holder1, 2);

        assertEq(nft.balanceOf(holder1), 2);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.ownerOf(1), holder1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.typeBalanceOf(holder1, 2), 1);
    }

    function test_AirdropWithTokenURI_UnsupportedFunction() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(IAirdroppableNFT.UnsupportedFunction.selector));
        nft.airdropWithTokenURI(holder1, "");
    }

    function test_BulkAirdropByType_InvalidMinter() public {
        address[] memory holders = new address[](1);
        holders[0] = holder1;
        
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidMinter.selector, minter));
        nft.bulkAirdropByType(holders, 1);
    }

    function test_BulkAirdropByType_EnforcedPause() public {
        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        address[] memory holders = new address[](1);
        holders[0] = holder1;

        // bulkAirdropByType: failure: EnforcedPause
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        nft.bulkAirdropByType(holders, 1);
    }

    function test_BulkAirdropByType_InvalidTokenType() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        address[] memory holders = new address[](1);
        holders[0] = holder1;

        // bulkAirdropByType: failure: InvalidTokenType
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenType.selector, 0));
        nft.bulkAirdropByType(holders, 0);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(InvalidTokenType.selector, NFT_MAX_TOKEN_TYPE + 1));
        nft.bulkAirdropByType(holders, NFT_MAX_TOKEN_TYPE + 1);
    }

    function test_BulkAirdropByType_Success() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        assertEq(nft.balanceOf(holder1), 0);
        assertEq(nft.typeBalanceOf(holder1, 1), 0);
        assertEq(nft.balanceOf(holder2), 0);
        assertEq(nft.typeBalanceOf(holder2, 1), 0);

        address[] memory holders = new address[](2);
        holders[0] = holder1;
        holders[1] = holder2;

        // bulkAirdropByType: success
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit Transfer(address(0), holder1, 0);
        nft.bulkAirdropByType(holders, 1);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.balanceOf(holder2), 1);
        assertEq(nft.ownerOf(1), holder2);
        assertEq(nft.typeBalanceOf(holder2, 1), 1);
    }

    function test_BulkAirdropByType_AlreadyAirdropped() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        address[] memory holders = new address[](1);
        holders[0] = holder1;

        // bulkAirdropByType: success
        vm.prank(minter);
        nft.bulkAirdropByType(holders, 1);

        // bulkAirdropByType: failure: AlreadyAirdropped
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(AlreadyAirdropped.selector, 1, holder1));
        nft.bulkAirdropByType(holders, 1);

        // bulkAirdropByType: success (different type)
        vm.prank(minter);
        nft.bulkAirdropByType(holders, 2);

        assertEq(nft.balanceOf(holder1), 2);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.ownerOf(1), holder1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.typeBalanceOf(holder1, 2), 1);
    }

    function test_SafeTransferFrom_Success_DifferentHolder() public {
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        uint256 holdingStartedAt = block.timestamp;
        uint64 userExpiredAt = uint64(holdingStartedAt + DUMMY_PERIOD * 2);

        // setTokenURI: success
        vm.prank(runner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, userExpiredAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);
        
        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.balanceOf(holder2), 0);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, holder2, 0));
        nft.tokenOfOwnerByIndex(holder2, 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.typeBalanceOf(holder2, 1), 0);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), block.timestamp - holdingStartedAt);
        
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);

        // safeTransferFrom: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit Transfer(holder1, holder2, 0);
        nft.safeTransferFrom(holder1, holder2, 0);

        assertEq(nft.balanceOf(holder1), 0);
        assertEq(nft.balanceOf(holder2), 1);
        assertEq(nft.ownerOf(0), holder2);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, holder1, 0));
        nft.tokenOfOwnerByIndex(holder1, 0);
        assertEq(nft.tokenOfOwnerByIndex(holder2, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 0);
        assertEq(nft.typeBalanceOf(holder2, 1), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), 0);
        
        (receiver, amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);
    }

    function test_SafeTransferFrom_Success_SameHolder() public {
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        uint256 holdingStartedAt = block.timestamp;
        uint64 userExpiredAt = uint64(holdingStartedAt + DUMMY_PERIOD * 2);

        // setTokenURI: success
        vm.prank(runner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, userExpiredAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);
        
        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), block.timestamp - holdingStartedAt);
        
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);

        // safeTransferFrom: success (to same holder)
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit Transfer(holder1, holder1, 0);
        nft.safeTransferFrom(holder1, holder1, 0);

        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), block.timestamp - holdingStartedAt);
        
        (receiver, amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);
    }

    function test_Burn_NonexistentToken() public {
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.burn(0);
    }

    function test_Burn_InsufficientApproval() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        // burn: failure: ERC721InsufficientApproval
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721InsufficientApproval.selector, runner, 0));
        nft.burn(0);
    }

    function test_Burn_Success() public {
        string memory tokenURI = "https://nft-metadata.world/0x0";
        
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        uint256 holdingStartedAt = block.timestamp;
        uint64 userExpiredAt = uint64(holdingStartedAt + DUMMY_PERIOD * 2);

        // setTokenURI: success
        vm.prank(runner);
        nft.setTokenURI(0, tokenURI);

        // setUser: success
        vm.prank(holder1);
        nft.setUser(0, holder2, userExpiredAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);
        
        assertEq(nft.balanceOf(holder1), 1);
        assertEq(nft.ownerOf(0), holder1);
        assertEq(nft.tokenOfOwnerByIndex(holder1, 0), 0);
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenByIndex(0), 0);
        assertEq(nft.tokenURI(0), tokenURI);
        assertEq(nft.tokenType(0), 1);
        assertEq(nft.typeSupply(1), 1);
        assertEq(nft.typeBalanceOf(holder1, 1), 1);
        assertEq(nft.firstOwnerOf(0), holder1);
        assertEq(nft.holdingPeriod(0), block.timestamp - holdingStartedAt);
        
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, runner);
        assertEq(amount, 0);
        
        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);

        // burn: success
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit Transfer(holder1, address(0), 0);
        nft.burn(0);

        assertEq(nft.balanceOf(holder1), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.ownerOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, holder1, 0));
        nft.tokenOfOwnerByIndex(holder1, 0);
        assertEq(nft.totalSupply(), 0);
        vm.expectRevert(abi.encodeWithSelector(ERC721OutOfBoundsIndex.selector, address(0), 0));
        nft.tokenByIndex(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.tokenURI(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.tokenType(0);
        assertEq(nft.typeSupply(1), 0);
        assertEq(nft.typeBalanceOf(holder1, 1), 0);
        assertEq(nft.firstOwnerOf(0), holder1);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.holdingPeriod(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.royaltyInfo(0, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userExpires(0);
    }

    function test_SetDefaultRoyalty_UnauthorizedAccount() public {
        uint96 feeNumerator = 300;
        
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.setDefaultRoyalty(minter, feeNumerator);

        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.freezeRoyalty();
    }

    function test_SetDefaultRoyalty_Success_ThenFrozen() public {
        uint96 feeNumerator = 300;
        uint256 feeDenominator = 10000;
        
        // setDefaultRoyalty: success
        vm.prank(runner);
        nft.setDefaultRoyalty(minter, feeNumerator);

        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.royaltyInfo(0, 1 ether);

        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, minter);
        assertEq(amount, (1 ether * feeNumerator) / feeDenominator);

        // freezeRoyalty: success
        vm.prank(runner);
        nft.freezeRoyalty();

        // setDefaultRoyalty: failure: RoyaltyFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyFrozen.selector));
        nft.setDefaultRoyalty(minter, feeNumerator);

        // freezeRoyalty: failure: RoyaltyFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(RoyaltyFrozen.selector));
        nft.freezeRoyalty();
    }

    function test_SetUser_NonexistentToken() public {
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.setUser(0, holder2, uint64(block.timestamp + DUMMY_PERIOD));
    }

    function test_SetUser_InsufficientApproval() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        // setUser: failure: ERC721InsufficientApproval
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(ERC721InsufficientApproval.selector, runner, 0));
        nft.setUser(0, holder2, uint64(block.timestamp + DUMMY_PERIOD));
    }

    function test_SetUser_Success_ByOwner() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userExpires(0);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);

        uint64 userExpiredAt = uint64(block.timestamp + DUMMY_PERIOD);

        // setUser: success: by owner
        vm.prank(holder1);
        vm.expectEmit(true, true, true, true);
        emit UpdateUser(0, holder2, userExpiredAt);
        nft.setUser(0, holder2, userExpiredAt);

        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), userExpiredAt);
    }

    function test_SetUser_Success_ByApproved() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userOf(0);
        vm.expectRevert(abi.encodeWithSelector(ERC721NonexistentToken.selector, 0));
        nft.userExpires(0);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        // approve: success
        vm.prank(holder1);
        nft.approve(holder2, 0);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), 0);

        uint64 userExpiredAt = uint64(block.timestamp + DUMMY_PERIOD);

        // setUser: success: by approved account
        vm.prank(holder2);
        vm.expectEmit(true, true, true, true);
        emit UpdateUser(0, holder2, userExpiredAt);
        nft.setUser(0, holder2, userExpiredAt);

        assertEq(nft.userOf(0), holder2);
        assertEq(nft.userExpires(0), userExpiredAt);

        // time passed
        vm.warp(block.timestamp + DUMMY_PERIOD);

        assertEq(nft.userOf(0), address(0));
        assertEq(nft.userExpires(0), userExpiredAt);
    }

    function test_AddRemoveFreezeMinters() public {
        assertFalse(nft.isMinter(minter));

        // freezeMinters: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.freezeMinters();

        // addMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.addMinter(minter);

        // addMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(InvalidMinter.selector, address(0)));
        nft.addMinter(address(0));

        // removeMinter: failure: InvalidMinter
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(InvalidMinter.selector, minter));
        nft.removeMinter(minter);

        // addMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit MinterAdded(minter);
        nft.addMinter(minter);

        assertTrue(nft.isMinter(minter));

        // addMinter: failure: MinterAlreadyAdded
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(MinterAlreadyAdded.selector, minter));
        nft.addMinter(minter);

        // removeMinter: failure: OwnableUnauthorizedAccount
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.removeMinter(minter);

        // removeMinter: success
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit MinterRemoved(minter);
        nft.removeMinter(minter);

        assertFalse(nft.isMinter(minter));

        // freezeMinters: success
        vm.prank(runner);
        nft.freezeMinters();

        // addMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(MintersFrozen.selector));
        nft.addMinter(minter);

        // removeMinter: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(MintersFrozen.selector));
        nft.removeMinter(minter);

        // freezeMinters: failure: MintersFrozen
        vm.prank(runner);
        vm.expectRevert(abi.encodeWithSelector(MintersFrozen.selector));
        nft.freezeMinters();
    }

    function test_RefreshMetadata_UnauthorizedAccount() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, minter));
        nft.refreshMetadata();
    }

    function test_RefreshMetadata_Success_Single() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);

        // refreshMetadata: success: single
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit MetadataUpdate(0);
        nft.refreshMetadata();
    }

    function test_RefreshMetadata_Success_Plural() public {
        // unpause: success
        vm.prank(runner);
        nft.unpause();

        // addMinter: success
        vm.prank(runner);
        nft.addMinter(minter);

        // airdropByType: success
        vm.prank(minter);
        nft.airdropByType(holder1, 1);
        vm.prank(minter);
        nft.airdropByType(holder2, 1);

        // refreshMetadata: success: plural
        vm.prank(runner);
        vm.expectEmit(true, true, true, true);
        emit BatchMetadataUpdate(0, 1);
        nft.refreshMetadata();
    }
}
