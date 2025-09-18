import { test, describe, beforeEach, before } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import type { HardhatViemHelpers, PublicClient, TestClient } from "@nomicfoundation/hardhat-viem/types";
import { parseEther, zeroAddress, type Address, getAddress } from "viem";

const NFT_CONTRACT_NAME = "SampleMultipleTypeNFT" as const;
const NFT_MAX_TOKEN_TYPE = 3 as const; // must be greater than or equal to 2

describe(NFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60n as const;

  let runner: Address;
  let minter: Address;
  let holder1: Address;
  let holder2: Address;

  let viem: HardhatViemHelpers;
  let publicClient: PublicClient;
  let testClient: TestClient;

  let nft: any;

  before(async () => {
    const { viem: v } = await hre.network.connect();

    publicClient = await v.getPublicClient();
    testClient = await v.getTestClient();

    const walletClients = await v.getWalletClients();
    runner = getAddress(walletClients[0].account.address);
    minter = getAddress(walletClients[1].account.address);
    holder1 = getAddress(walletClients[2].account.address);
    holder2 = getAddress(walletClients[3].account.address);

    viem = v;
  });

  beforeEach(async () => {
    nft = await viem.deployContract(NFT_CONTRACT_NAME, [NFT_MAX_TOKEN_TYPE]);
  });

  describe("initial state", () => {
    test("success", async () => {
      assert.strictEqual(await nft.read.owner(), runner);
      assert.strictEqual(await nft.read.paused(), true);
      assert.strictEqual(await nft.read.minTokenType(), 1n);
      assert.strictEqual(await nft.read.maxTokenType(), BigInt(NFT_MAX_TOKEN_TYPE));
    });
  });

  describe("supportsInterface", () => {
    test("success", async () => {
      assert.strictEqual(await nft.read.supportsInterface(["0x00000000"]), false);
      assert.strictEqual(await nft.read.supportsInterface(["0x01ffc9a7"]), true); // ERC165
      assert.strictEqual(await nft.read.supportsInterface(["0x80ac58cd"]), true); // ERC721
      assert.strictEqual(await nft.read.supportsInterface(["0x780e9d63"]), true); // ERC721Enumerable
      assert.strictEqual(await nft.read.supportsInterface(["0x5b5e139f"]), true); // ERC721Metadata
      assert.strictEqual(await nft.read.supportsInterface(["0x2a55205a"]), true); // ERC2981
      assert.strictEqual(await nft.read.supportsInterface(["0x49064906"]), true); // ERC4906
      assert.strictEqual(await nft.read.supportsInterface(["0xad092b5c"]), true); // ERC4907
    });
  });

  describe("pause, unpause", () => {
    test("all", async () => {
      // pause: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.pause([], { account: runner }), nft, "EnforcedPause");

      // unpause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.unpause([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      // unpause: success
      await viem.assertions.emitWithArgs(nft.write.unpause([], { account: runner }), nft, "Unpaused", [runner]);

      // unpause: failure: ExpectedPause
      await viem.assertions.revertWithCustomError(nft.write.unpause([], { account: runner }), nft, "ExpectedPause");

      // pause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.pause([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      // pause: success
      await viem.assertions.emitWithArgs(nft.write.pause([], { account: runner }), nft, "Paused", [runner]);
    });
  });

  describe("setMaxTokenType, freezeTokenTypeRange", async () => {
    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenTypeRange([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("failure: InvalidMaxTokenType", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE - 1)], { account: runner }), nft, "InvalidMaxTokenType", [BigInt(NFT_MAX_TOKEN_TYPE - 1)]);
    });

    test("success -> failure: TokenTypeRangeFrozen", async () => {
      // setMaxTokenType: success
      await nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: runner });

      assert.strictEqual(await nft.read.minTokenType(), 1n);
      assert.strictEqual(await nft.read.maxTokenType(), BigInt(NFT_MAX_TOKEN_TYPE + 1));

      // freezeTokenTypeRange: success
      await nft.write.freezeTokenTypeRange([], { account: runner });

      // setMaxTokenType: failure: TokenTypeRangeFrozen
      await viem.assertions.revertWithCustomError(
        nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE + 2)], { account: runner }), nft, "TokenTypeRangeFrozen");

      // freezeTokenTypeRange: failure: TokenTypeRangeFrozen
      await viem.assertions.revertWithCustomError(nft.write.freezeTokenTypeRange([], { account: runner }), nft, "TokenTypeRangeFrozen");
    });
  });

  describe("setBaseTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/" as const;

    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("success: single", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      assert.strictEqual(await nft.read.tokenURI([0n]), "");

      // setBaseTokenURI: success: single
      await viem.assertions.emitWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner }), nft, "MetadataUpdate", [0n]);

      assert.strictEqual(await nft.read.tokenURI([0n]), BASE_TOKEN_URI + "1/0");
    });

    test("success: plural", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });
      await nft.write.airdropByType([holder2, 1n], { account: minter });

      assert.strictEqual(await nft.read.tokenURI([0n]), "");
      assert.strictEqual(await nft.read.tokenURI([1n]), "");

      // setBaseTokenURI: success: plural
      await viem.assertions.emitWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner }), nft, "BatchMetadataUpdate", [0n, 1n]);

      assert.strictEqual(await nft.read.tokenURI([0n]), BASE_TOKEN_URI + "1/0");
      assert.strictEqual(await nft.read.tokenURI([1n]), BASE_TOKEN_URI + "1/1");
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/" as const;
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("failure: ERC721NonexistentToken", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "ERC721NonexistentToken", [0n]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    test("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      assert.strictEqual(await nft.read.tokenURI([0n]), "");

      // setBaseTokenURI: success
      await nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner });

      assert.strictEqual(await nft.read.tokenURI([0n]), BASE_TOKEN_URI + "1/0");

      // setTokenURI: success
      await viem.assertions.emitWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "MetadataUpdate", [0n]);

      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);

      // freezeTokenURI: success
      await viem.assertions.emitWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "PermanentURI", [TOKEN_URI, 0n]);

      // setTokenURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "TokenURIFrozen", [0n]);

      // freezeTokenURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "TokenURIFrozen", [0n]);
    });
  });

  describe("airdrop", () => {
    test("failure: UnsupportedFunction", async () => {
      await viem.assertions.revertWithCustomError(nft.write.airdrop([holder1], { account: minter }), nft, "UnsupportedFunction");
    });
  });

  describe("airdropByType", () => {
    test("failure: InvalidMinter", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "InvalidMinter", [minter]);
    });

    test("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "EnforcedPause");
    });

    test("failure: InvalidTokenType", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: failure: InvalidTokenType
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 0n], { account: minter }), nft, "InvalidTokenType", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "InvalidTokenType", [BigInt(NFT_MAX_TOKEN_TYPE + 1)]);
    });

    test("success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      assert.strictEqual(await nft.read.balanceOf([holder1]), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.ownerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [holder1, 0n]);
      assert.strictEqual(await nft.read.totalSupply(), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenByIndex([0n]), nft, "ERC721OutOfBoundsIndex", [zeroAddress, 0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenURI([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenType([0n]), nft, "ERC721NonexistentToken", [0n]);
      assert.strictEqual(await nft.read.typeSupply([1n]), 0n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.firstOwnerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.holdingPeriod([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.royaltyInfo([0n, parseEther("1")]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);

      // airdropByType: success
      await viem.assertions.emitWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "Transfer", [zeroAddress, holder1, 0n]);

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder1, 0n]), 0n);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), "");
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), 0n);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await nft.read.holdingPeriod([0n]), currentTime - holdingStartedAt);
    });

    test("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // airdropByType: failure: AlreadyAirdropped
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "AlreadyAirdropped", [1n, holder1]);

      // airdropByType: success
      await nft.write.airdropByType([holder1, 2n], { account: minter });

      assert.strictEqual(await nft.read.balanceOf([holder1]), 2n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.ownerOf([1n]), holder1);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 2n]), 1n);
    });
  });

  describe("airdropWithTokenURI", () => {
    test("failure: UnsupportedFunction", async () => {
      await viem.assertions.revertWithCustomError(nft.write.airdropWithTokenURI([holder1, ""], { account: minter }), nft, "UnsupportedFunction");
    });
  });

  describe("bulkAirdropByType", () => {
    test("failure: InvalidMinter", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "InvalidMinter", [minter]);
    });

    test("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "EnforcedPause");
    });

    test("failure: InvalidTokenType", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: failure: InvalidTokenType
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 0n], { account: minter }), nft, "InvalidTokenType", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "InvalidTokenType", [BigInt(NFT_MAX_TOKEN_TYPE + 1)]);
    });

    test("success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      assert.strictEqual(await nft.read.balanceOf([holder1]), 0n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 0n);

      assert.strictEqual(await nft.read.balanceOf([holder2]), 0n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder2, 1n]), 0n);

      // bulkAirdropByType: success
      await viem.assertions.emitWithArgs(nft.write.bulkAirdropByType([[holder1, holder2], 1n], { account: minter }), nft, "Transfer", [zeroAddress, holder1, 0n]);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);

      assert.strictEqual(await nft.read.balanceOf([holder2]), 1n);
      assert.strictEqual(await nft.read.ownerOf([1n]), holder2);
      assert.strictEqual(await nft.read.typeBalanceOf([holder2, 1n]), 1n);
    });

    test("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: success
      await nft.write.bulkAirdropByType([[holder1], 1n], { account: minter });

      // bulkAirdropByType: failure: AlreadyAirdropped
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "AlreadyAirdropped", [1n, holder1]);

      // bulkAirdropByType: success
      await nft.write.bulkAirdropByType([[holder1], 2n], { account: minter });

      assert.strictEqual(await nft.read.balanceOf([holder1]), 2n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.ownerOf([1n]), holder1);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 2n]), 1n);
    });
  });

  describe("safeTransferFrom", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    test("success: from holder1 to holder2", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2n;

      // setTokenURI: success
      await nft.write.setTokenURI([0n, TOKEN_URI], { account: runner });

      // setUser: success
      await nft.write.setUser([0n, holder2, userExpiredAt], { account: holder1 });

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.balanceOf([holder2]), 0n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder1, 0n]), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder2, 0n]), nft, "ERC721OutOfBoundsIndex", [holder2, 0n]);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder2, 1n]), 0n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(nft.write.safeTransferFrom([holder1, holder2, 0n], { account: holder1 }), nft, "Transfer", [holder1, holder2, 0n]);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 0n);
      assert.strictEqual(await nft.read.balanceOf([holder2]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder2);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [holder1, 0n]);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder2, 0n]), 0n);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 0n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder2, 1n]), 1n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), 0n);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), 0n);
    });

    test("success: from holder1 to holder1", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2n;

      // setTokenURI: success
      await nft.write.setTokenURI([0n, TOKEN_URI], { account: runner });

      // setUser: success
      await nft.write.setUser([0n, holder2, userExpiredAt], { account: holder1 });

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder1, 0n]), 0n);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(nft.write.safeTransferFrom([holder1, holder1, 0n], { account: holder1 }), nft, "Transfer", [holder1, holder1, 0n]);

      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder1, 0n]), 0n);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), updatedTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);
    });
  });

  describe("burn", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    test("failure: ERC721NonexistentToken", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.burn([0n], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    test("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // burn: failure: ERC721InsufficientApproval
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.burn([0n], { account: runner }), nft, "ERC721InsufficientApproval", [runner, 0n]);
    });

    test("success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2n;

      // setTokenURI: success
      await nft.write.setTokenURI([0n, TOKEN_URI], { account: runner });

      // setUser: success
      await nft.write.setUser([0n, holder2, userExpiredAt], { account: holder1 });

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await nft.read.ownerOf([0n]), holder1);
      assert.strictEqual(await nft.read.tokenOfOwnerByIndex([holder1, 0n]), 0n);
      assert.strictEqual(await nft.read.totalSupply(), 1n);
      assert.strictEqual(await nft.read.tokenByIndex([0n]), 0n);
      assert.strictEqual(await nft.read.tokenURI([0n]), TOKEN_URI);
      assert.strictEqual(await nft.read.tokenType([0n]), 1n);
      assert.strictEqual(await nft.read.typeSupply([1n]), 1n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      assert.strictEqual(await nft.read.holdingPeriod([0n]), currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }
      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);

      // burn: success
      await viem.assertions.emitWithArgs(nft.write.burn([0n], { account: holder1 }), nft, "Transfer", [holder1, zeroAddress, 0n]);

      assert.strictEqual(await nft.read.balanceOf([holder1]), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.ownerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [holder1, 0n]);
      assert.strictEqual(await nft.read.totalSupply(), 0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenByIndex([0n]), nft, "ERC721OutOfBoundsIndex", [zeroAddress, 0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenURI([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenType([0n]), nft, "ERC721NonexistentToken", [0n]);
      assert.strictEqual(await nft.read.typeSupply([1n]), 0n);
      assert.strictEqual(await nft.read.typeBalanceOf([holder1, 1n]), 0n);
      assert.strictEqual(await nft.read.firstOwnerOf([0n]), holder1);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.holdingPeriod([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.royaltyInfo([0n, parseEther("1")]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const feeNumerator = 300n;
    const feeDenominator = 10000n;

    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setDefaultRoyalty([minter, feeNumerator], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeRoyalty([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("success -> failure: RoyaltyFrozen", async () => {
      // setDefaultRoyalty: success
      await nft.write.setDefaultRoyalty([minter, feeNumerator], { account: runner });

      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.royaltyInfo([0n, parseEther("1")]), nft, "ERC721NonexistentToken", [0n]);

      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        assert.strictEqual(receiver, minter);
        assert.strictEqual(amount, (parseEther("1") * feeNumerator) / feeDenominator);
      }

      // freezeRoyalty: success
      await nft.write.freezeRoyalty([], { account: runner });

      // setDefaultRoyalty: failure: RoyaltyFrozen
      await viem.assertions.revertWithCustomError(nft.write.setDefaultRoyalty([minter, feeNumerator], { account: runner }), nft, "RoyaltyFrozen");

      // freezeRoyalty: failure: RoyaltyFrozen
      await viem.assertions.revertWithCustomError(nft.write.freezeRoyalty([], { account: runner }), nft, "RoyaltyFrozen");
    });
  });

  describe("setUser", () => {
    test("failure: ERC721NonexistentToken", async () => {
      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setUser([0n, holder2, currentTime + DUMMY_PERIOD], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    test("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // setUser: failure: ERC721InsufficientApproval
      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setUser([0n, holder2, currentTime + DUMMY_PERIOD], { account: runner }), nft, "ERC721InsufficientApproval", [runner, 0n]);
    });

    test("success: by owner", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), 0n);

      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = currentTime + DUMMY_PERIOD;

      // setUser: success: by owner
      await viem.assertions.emitWithArgs(nft.write.setUser([0n, holder2, userExpiredAt], { account: holder1 }), nft, "UpdateUser", [0n, holder2, userExpiredAt]);

      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      await testClient.mine({ blocks: 1 });
      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);
    });

    test("success: by approved account", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // approve: success
      await nft.write.approve([holder2, 0n], { account: holder1 });

      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), 0n);

      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = currentTime + DUMMY_PERIOD;

      // setUser: success: by approved account
      await viem.assertions.emitWithArgs(nft.write.setUser([0n, holder2, userExpiredAt], { account: holder2 }), nft, "UpdateUser", [0n, holder2, userExpiredAt]);

      assert.strictEqual(await nft.read.userOf([0n]), holder2);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      await testClient.mine({ blocks: 1 });
      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      assert.strictEqual(await nft.read.userOf([0n]), zeroAddress);
      assert.strictEqual(await nft.read.userExpires([0n]), userExpiredAt);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    test("all", async () => {
      assert.strictEqual(await nft.read.isMinter([minter]), false);

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeMinters([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([minter], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([zeroAddress], { account: runner }), nft, "InvalidMinter", [zeroAddress]);

      // removeMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.removeMinter([minter], { account: runner }), nft, "InvalidMinter", [minter]);

      // addMinter: success
      await viem.assertions.emitWithArgs(nft.write.addMinter([minter], { account: runner }), nft, "MinterAdded", [minter]);

      assert.strictEqual(await nft.read.isMinter([minter]), true);

      // addMinter: failure: MinterAlreadyAdded
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([minter], { account: runner }), nft, "MinterAlreadyAdded", [minter]);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.removeMinter([minter], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);

      // removeMinter: success
      await viem.assertions.emitWithArgs(nft.write.removeMinter([minter], { account: runner }), nft, "MinterRemoved", [minter]);

      assert.strictEqual(await nft.read.isMinter([minter]), false);

      // freezeMinters: success
      await nft.write.freezeMinters([], { account: runner });

      // addMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(nft.write.addMinter([minter], { account: runner }), nft, "MintersFrozen");

      // removeMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(nft.write.removeMinter([minter], { account: runner }), nft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(nft.write.freezeMinters([], { account: runner }), nft, "MintersFrozen");
    });
  });

  describe("refreshMetadata", () => {
    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.refreshMetadata([], { account: minter }), nft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("success: single", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // refreshMetadata: success: single
      await viem.assertions.emitWithArgs(nft.write.refreshMetadata([], { account: runner }), nft, "MetadataUpdate", [0n]);
    });

    test("success: plural", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });
      await nft.write.airdropByType([holder2, 1n], { account: minter });

      // refreshMetadata: success: plural
      await viem.assertions.emitWithArgs(nft.write.refreshMetadata([], { account: runner }), nft, "BatchMetadataUpdate", [0n, 1n]);
    });
  });
});
