import { expect } from "chai";
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
    runner = walletClients[0].account.address;
    minter = walletClients[1].account.address;
    holder1 = walletClients[2].account.address;
    holder2 = walletClients[3].account.address;

    viem = v;
  });

  beforeEach(async () => {
    nft = await viem.deployContract(NFT_CONTRACT_NAME, [NFT_MAX_TOKEN_TYPE]);
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await nft.read.owner()).to.equal(getAddress(runner));
      expect(await nft.read.paused()).to.be.true;
      expect(await nft.read.minTokenType()).to.equal(1n);
      expect(await nft.read.maxTokenType()).to.equal(BigInt(NFT_MAX_TOKEN_TYPE));
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await nft.read.supportsInterface(["0x00000000"])).to.be.false;
      expect(await nft.read.supportsInterface(["0x01ffc9a7"])).to.be.true; // ERC165
      expect(await nft.read.supportsInterface(["0x80ac58cd"])).to.be.true; // ERC721
      expect(await nft.read.supportsInterface(["0x780e9d63"])).to.be.true; // ERC721Enumerable
      expect(await nft.read.supportsInterface(["0x5b5e139f"])).to.be.true; // ERC721Metadata
      expect(await nft.read.supportsInterface(["0x2a55205a"])).to.be.true; // ERC2981
      expect(await nft.read.supportsInterface(["0x49064906"])).to.be.true; // ERC4906
      expect(await nft.read.supportsInterface(["0xad092b5c"])).to.be.true; // ERC4907
    });
  });

  describe("pause, unpause", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.pause([], { account: runner }), nft, "EnforcedPause");

      // unpause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.unpause([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      // unpause: success
      await viem.assertions.emitWithArgs(nft.write.unpause([], { account: runner }), nft, "Unpaused", [getAddress(runner)]);

      // unpause: failure: ExpectedPause
      await viem.assertions.revertWithCustomError(nft.write.unpause([], { account: runner }), nft, "ExpectedPause");

      // pause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.pause([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      // pause: success
      await viem.assertions.emitWithArgs(nft.write.pause([], { account: runner }), nft, "Paused", [getAddress(runner)]);
    });
  });

  describe("setMaxTokenType, freezeTokenTypeRange", async () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenTypeRange([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);
    });

    it("failure: InvalidMaxTokenType", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE - 1)], { account: runner }), nft, "InvalidMaxTokenType", [BigInt(NFT_MAX_TOKEN_TYPE - 1)]);
    });

    it("success -> failure: TokenTypeRangeFrozen", async () => {
      // setMaxTokenType: success
      await nft.write.setMaxTokenType([BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: runner });

      expect(await nft.read.minTokenType()).to.equal(1n);
      expect(await nft.read.maxTokenType()).to.equal(BigInt(NFT_MAX_TOKEN_TYPE + 1));

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

    it("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);
    });

    it("success: single", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      expect(await nft.read.tokenURI([0n])).to.equal("");

      // setBaseTokenURI: success: single
      await viem.assertions.emitWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner }), nft, "MetadataUpdate", [0n]);

      expect(await nft.read.tokenURI([0n])).to.equal(BASE_TOKEN_URI + "1/0");
    });

    it("success: plural", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });
      await nft.write.airdropByType([holder2, 1n], { account: minter });

      expect(await nft.read.tokenURI([0n])).to.equal("");
      expect(await nft.read.tokenURI([1n])).to.equal("");

      // setBaseTokenURI: success: plural
      await viem.assertions.emitWithArgs(nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner }), nft, "BatchMetadataUpdate", [0n, 1n]);

      expect(await nft.read.tokenURI([0n])).to.equal(BASE_TOKEN_URI + "1/0");
      expect(await nft.read.tokenURI([1n])).to.equal(BASE_TOKEN_URI + "1/1");
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/" as const;
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);
    });

    it("failure: ERC721NonexistentToken", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "ERC721NonexistentToken", [0n]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      expect(await nft.read.tokenURI([0n])).to.equal("");

      // setBaseTokenURI: success
      await nft.write.setBaseTokenURI([BASE_TOKEN_URI], { account: runner });

      expect(await nft.read.tokenURI([0n])).to.equal(BASE_TOKEN_URI + "1/0");

      // setTokenURI: success
      await viem.assertions.emitWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "MetadataUpdate", [0n]);

      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);

      // freezeTokenURI: success
      await viem.assertions.emitWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "PermanentURI", [TOKEN_URI, 0n]);

      // setTokenURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setTokenURI([0n, TOKEN_URI], { account: runner }), nft, "TokenURIFrozen", [0n]);

      // freezeTokenURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeTokenURI([0n], { account: runner }), nft, "TokenURIFrozen", [0n]);
    });
  });

  describe("airdrop", () => {
    it("failure: UnsupportedFunction", async () => {
      await viem.assertions.revertWithCustomError(nft.write.airdrop([holder1], { account: minter }), nft, "UnsupportedFunction");
    });
  });

  describe("airdropByType", () => {
    it("failure: InvalidMinter", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "InvalidMinter", [getAddress(minter)]);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "EnforcedPause");
    });

    it("failure: InvalidTokenType", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: failure: InvalidTokenType
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 0n], { account: minter }), nft, "InvalidTokenType", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "InvalidTokenType", [BigInt(NFT_MAX_TOKEN_TYPE + 1)]);
    });

    it("success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      expect(await nft.read.balanceOf([holder1])).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.ownerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [getAddress(holder1), 0n]);
      expect(await nft.read.totalSupply()).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenByIndex([0n]), nft, "ERC721OutOfBoundsIndex", [zeroAddress, 0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenURI([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenType([0n]), nft, "ERC721NonexistentToken", [0n]);
      expect(await nft.read.typeSupply([1n])).to.equal(0n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.firstOwnerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.holdingPeriod([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.royaltyInfo([0n, parseEther("1")]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);

      // airdropByType: success
      await viem.assertions.emitWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "Transfer", [zeroAddress, getAddress(holder1), 0n]);

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.tokenOfOwnerByIndex([holder1, 0n])).to.equal(0n);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal("");
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(0n);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      expect(await nft.read.holdingPeriod([0n])).to.equal(currentTime - holdingStartedAt);
    });

    it("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // airdropByType: failure: AlreadyAirdropped
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.airdropByType([holder1, 1n], { account: minter }), nft, "AlreadyAirdropped", [1n, getAddress(holder1)]);

      // airdropByType: success
      await nft.write.airdropByType([holder1, 2n], { account: minter });

      expect(await nft.read.balanceOf([holder1])).to.equal(2n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.ownerOf([1n])).to.equal(getAddress(holder1));
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 2n])).to.equal(1n);
    });
  });

  describe("airdropWithTokenURI", () => {
    it("failure: UnsupportedFunction", async () => {
      await viem.assertions.revertWithCustomError(nft.write.airdropWithTokenURI([holder1, ""], { account: minter }), nft, "UnsupportedFunction");
    });
  });

  describe("bulkAirdropByType", () => {
    it("failure: InvalidMinter", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "InvalidMinter", [getAddress(minter)]);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "EnforcedPause");
    });

    it("failure: InvalidTokenType", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: failure: InvalidTokenType
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 0n], { account: minter }), nft, "InvalidTokenType", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], BigInt(NFT_MAX_TOKEN_TYPE + 1)], { account: minter }), nft, "InvalidTokenType", [BigInt(NFT_MAX_TOKEN_TYPE + 1)]);
    });

    it("success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      expect(await nft.read.balanceOf([holder1])).to.equal(0n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(0n);

      expect(await nft.read.balanceOf([holder2])).to.equal(0n);
      expect(await nft.read.typeBalanceOf([holder2, 1n])).to.equal(0n);

      // bulkAirdropByType: success
      await viem.assertions.emitWithArgs(nft.write.bulkAirdropByType([[holder1, holder2], 1n], { account: minter }), nft, "Transfer", [zeroAddress, getAddress(holder1), 0n]);

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);

      expect(await nft.read.balanceOf([holder2])).to.equal(1n);
      expect(await nft.read.ownerOf([1n])).to.equal(getAddress(holder2));
      expect(await nft.read.typeBalanceOf([holder2, 1n])).to.equal(1n);
    });

    it("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // bulkAirdropByType: success
      await nft.write.bulkAirdropByType([[holder1], 1n], { account: minter });

      // bulkAirdropByType: failure: AlreadyAirdropped
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.bulkAirdropByType([[holder1], 1n], { account: minter }), nft, "AlreadyAirdropped", [1n, getAddress(holder1)]);

      // bulkAirdropByType: success
      await nft.write.bulkAirdropByType([[holder1], 2n], { account: minter });

      expect(await nft.read.balanceOf([holder1])).to.equal(2n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.ownerOf([1n])).to.equal(getAddress(holder1));
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 2n])).to.equal(1n);
    });
  });

  describe("safeTransferFrom", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("success: from holder1 to holder2", async () => {
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

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.balanceOf([holder2])).to.equal(0n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.tokenOfOwnerByIndex([holder1, 0n])).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder2, 0n]), nft, "ERC721OutOfBoundsIndex", [getAddress(holder2), 0n]);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder2, 1n])).to.equal(0n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(nft.write.safeTransferFrom([holder1, holder2, 0n], { account: holder1 }), nft, "Transfer", [getAddress(holder1), getAddress(holder2), 0n]);

      expect(await nft.read.balanceOf([holder1])).to.equal(0n);
      expect(await nft.read.balanceOf([holder2])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder2));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [getAddress(holder1), 0n]);
      expect(await nft.read.tokenOfOwnerByIndex([holder2, 0n])).to.equal(0n);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(0n);
      expect(await nft.read.typeBalanceOf([holder2, 1n])).to.equal(1n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(0n);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(0n);
    });

    it("success: from holder1 to holder1", async () => {
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

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.tokenOfOwnerByIndex([holder1, 0n])).to.equal(0n);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(nft.write.safeTransferFrom([holder1, holder1, 0n], { account: holder1 }), nft, "Transfer", [getAddress(holder1), getAddress(holder1), 0n]);

      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.tokenOfOwnerByIndex([holder1, 0n])).to.equal(0n);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(updatedTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);
    });
  });

  describe("burn", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("failure: ERC721NonexistentToken", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.burn([0n], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // burn: failure: ERC721InsufficientApproval
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.burn([0n], { account: runner }), nft, "ERC721InsufficientApproval", [getAddress(runner), 0n]);
    });

    it("success", async () => {
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

      expect(await nft.read.balanceOf([holder1])).to.equal(1n);
      expect(await nft.read.ownerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.tokenOfOwnerByIndex([holder1, 0n])).to.equal(0n);
      expect(await nft.read.totalSupply()).to.equal(1n);
      expect(await nft.read.tokenByIndex([0n])).to.equal(0n);
      expect(await nft.read.tokenURI([0n])).to.equal(TOKEN_URI);
      expect(await nft.read.tokenType([0n])).to.equal(1n);
      expect(await nft.read.typeSupply([1n])).to.equal(1n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(1n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      expect(await nft.read.holdingPeriod([0n])).to.equal(currentTime - holdingStartedAt);
      {
        const [receiver, amount] = await nft.read.royaltyInfo([0n, parseEther("1")]);
        expect(receiver).to.equal(getAddress(runner));
        expect(amount).to.equal(0n);
      }
      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);

      // burn: success
      await viem.assertions.emitWithArgs(nft.write.burn([0n], { account: holder1 }), nft, "Transfer", [getAddress(holder1), zeroAddress, 0n]);

      expect(await nft.read.balanceOf([holder1])).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.ownerOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenOfOwnerByIndex([holder1, 0n]), nft, "ERC721OutOfBoundsIndex", [getAddress(holder1), 0n]);
      expect(await nft.read.totalSupply()).to.equal(0n);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenByIndex([0n]), nft, "ERC721OutOfBoundsIndex", [zeroAddress, 0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenURI([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.tokenType([0n]), nft, "ERC721NonexistentToken", [0n]);
      expect(await nft.read.typeSupply([1n])).to.equal(0n);
      expect(await nft.read.typeBalanceOf([holder1, 1n])).to.equal(0n);
      expect(await nft.read.firstOwnerOf([0n])).to.equal(getAddress(holder1));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.holdingPeriod([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.royaltyInfo([0n, parseEther("1")]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const feeNumerator = 300n;
    const feeDenominator = 10000n;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setDefaultRoyalty([minter, feeNumerator], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeRoyalty([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);
    });

    it("success -> failure: RoyaltyFrozen", async () => {
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
        expect(receiver).to.equal(getAddress(minter));
        expect(amount).to.equal((parseEther("1") * feeNumerator) / feeDenominator);
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
    it("failure: ERC721NonexistentToken", async () => {
      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setUser([0n, holder2, currentTime + DUMMY_PERIOD], { account: runner }), nft, "ERC721NonexistentToken", [0n]);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // setUser: failure: ERC721InsufficientApproval
      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.setUser([0n, holder2, currentTime + DUMMY_PERIOD], { account: runner }), nft, "ERC721InsufficientApproval", [getAddress(runner), 0n]);
    });

    it("success: by owner", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userOf([0n]), nft, "ERC721NonexistentToken", [0n]);
      await viem.assertions.revertWithCustomErrorWithArgs(nft.read.userExpires([0n]), nft, "ERC721NonexistentToken", [0n]);

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(0n);

      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = currentTime + DUMMY_PERIOD;

      // setUser: success: by owner
      await viem.assertions.emitWithArgs(nft.write.setUser([0n, holder2, userExpiredAt], { account: holder1 }), nft, "UpdateUser", [0n, getAddress(holder2), userExpiredAt]);

      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      await testClient.mine({ blocks: 1 });
      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);
    });

    it("success: by approved account", async () => {
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

      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(0n);

      const currentTime = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));
      const userExpiredAt = currentTime + DUMMY_PERIOD;

      // setUser: success: by approved account
      await viem.assertions.emitWithArgs(nft.write.setUser([0n, holder2, userExpiredAt], { account: holder2 }), nft, "UpdateUser", [0n, getAddress(holder2), userExpiredAt]);

      expect(await nft.read.userOf([0n])).to.equal(getAddress(holder2));
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      await testClient.mine({ blocks: 1 });
      const updatedBlock = await publicClient.getBlock();
      const updatedTime = BigInt(updatedBlock.timestamp);

      expect(await nft.read.userOf([0n])).to.equal(zeroAddress);
      expect(await nft.read.userExpires([0n])).to.equal(userExpiredAt);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    it("all", async () => {
      expect(await nft.read.isMinter([minter])).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.freezeMinters([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      // addMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([minter], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      // addMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([zeroAddress], { account: runner }), nft, "InvalidMinter", [zeroAddress]);

      // removeMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.removeMinter([minter], { account: runner }), nft, "InvalidMinter", [getAddress(minter)]);

      // addMinter: success
      await viem.assertions.emitWithArgs(nft.write.addMinter([minter], { account: runner }), nft, "MinterAdded", [getAddress(minter)]);

      expect(await nft.read.isMinter([minter])).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.addMinter([minter], { account: runner }), nft, "MinterAlreadyAdded", [getAddress(minter)]);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.removeMinter([minter], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);

      // removeMinter: success
      await viem.assertions.emitWithArgs(nft.write.removeMinter([minter], { account: runner }), nft, "MinterRemoved", [getAddress(minter)]);

      expect(await nft.read.isMinter([minter])).to.be.false;

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
    it("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(nft.write.refreshMetadata([], { account: minter }), nft, "OwnableUnauthorizedAccount", [getAddress(minter)]);
    });

    it("success: single", async () => {
      // unpause: success
      await nft.write.unpause([], { account: runner });

      // addMinter: success
      await nft.write.addMinter([minter], { account: runner });

      // airdropByType: success
      await nft.write.airdropByType([holder1, 1n], { account: minter });

      // refreshMetadata: success: single
      await viem.assertions.emitWithArgs(nft.write.refreshMetadata([], { account: runner }), nft, "MetadataUpdate", [0n]);
    });

    it("success: plural", async () => {
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
