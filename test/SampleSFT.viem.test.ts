import { test, describe, beforeEach, before } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import type { HardhatViemHelpers, PublicClient, TestClient } from "@nomicfoundation/hardhat-viem/types";
import { parseEther, zeroAddress, type Address, getAddress } from "viem";

const SFT_CONTRACT_NAME = "SampleSFT" as const;

describe(SFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60n as const;

  let runner: Address;
  let minter: Address;
  let holder1: Address;
  let holder2: Address;

  let viem: HardhatViemHelpers;
  let publicClient: PublicClient;
  let testClient: TestClient;

  let sft: any;

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
    sft = await viem.deployContract(SFT_CONTRACT_NAME, []);
  });

  describe("initial state", () => {
    test("success", async () => {
      assert.strictEqual(await sft.read.owner(), runner);
      assert.strictEqual(await sft.read.paused(), true);
    });
  });

  describe("supportsInterface", () => {
    test("success", async () => {
      assert.strictEqual(await sft.read.supportsInterface(["0x00000000"]), false);
      assert.strictEqual(await sft.read.supportsInterface(["0x01ffc9a7"]), true); // ERC165
      assert.strictEqual(await sft.read.supportsInterface(["0xd9b67a26"]), true); // ERC1155
      assert.strictEqual(await sft.read.supportsInterface(["0x2a55205a"]), true); // ERC2981
    });
  });

  describe("pause, unpause", () => {
    test("all", async () => {
      // pause: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(sft.write.pause([], { account: runner }), sft, "EnforcedPause");

      // unpause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.unpause([], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // unpause: success
      await viem.assertions.emitWithArgs(sft.write.unpause([], { account: runner }), sft, "Unpaused", [runner]);

      // unpause: failure: ExpectedPause
      await viem.assertions.revertWithCustomError(sft.write.unpause([], { account: runner }), sft, "ExpectedPause");

      // pause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.pause([], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // pause: success
      await viem.assertions.emitWithArgs(sft.write.pause([], { account: runner }), sft, "Paused", [runner]);
    });
  });

  describe("registerToken, freezeTokenRegistration", () => {
    const TOKEN_URI = "https://sft-metadata.com/0x1";

    test("all", async () => {
      // registerToken: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.registerToken([1n, TOKEN_URI, 1n], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeTokenRegistration([], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // registerToken: failure: InvalidHoldingAmountThreshold
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.registerToken([1n, TOKEN_URI, 0n], { account: runner }), sft, "InvalidHoldingAmountThreshold", [0n]);

      assert.strictEqual(await sft.read.isTokenRegistered([1n]), false);
      await viem.assertions.revertWithCustomErrorWithArgs(sft.read.uri([1n]), sft, "TokenUnregistered", [1n]);
      await viem.assertions.revertWithCustomErrorWithArgs(sft.read.holdingAmountThreshold([1n]), sft, "TokenUnregistered", [1n]);
      await viem.assertions.revertWithCustomErrorWithArgs(sft.read.royaltyInfo([1n, parseEther("1")]), sft, "TokenUnregistered", [1n]);

      // registerToken: success
      await viem.assertions.emitWithArgs(sft.write.registerToken([1n, TOKEN_URI, 1n], { account: runner }), sft, "TokenRegistered", [1n, TOKEN_URI, 1n]);

      assert.strictEqual(await sft.read.isTokenRegistered([1n]), true);
      assert.strictEqual(await sft.read.uri([1n]), TOKEN_URI);
      assert.strictEqual(await sft.read.holdingAmountThreshold([1n]), 1n);
      {
        const [receiver, amount] = await sft.read.royaltyInfo([1n, parseEther("1")]);
        assert.strictEqual(receiver, runner);
        assert.strictEqual(amount, 0n);
      }

      // registerToken: failure: TokenAlreadyRegistered
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.registerToken([1n, TOKEN_URI, 1n], { account: runner }), sft, "TokenAlreadyRegistered", [1n]);

      // freezeTokenRegistration: success
      await sft.write.freezeTokenRegistration([], { account: runner });

      // registerToken: failure: TokenRegistrationFrozen
      await viem.assertions.revertWithCustomError(sft.write.registerToken([1n, TOKEN_URI, 1n], { account: runner }), sft, "TokenRegistrationFrozen");

      // freezeTokenRegistration: failure: TokenRegistrationFrozen
      await viem.assertions.revertWithCustomError(sft.write.freezeTokenRegistration([], { account: runner }), sft, "TokenRegistrationFrozen");
    });
  });

  describe("setSupplyCap, freezeSupplyCap", () => {
    test("all", async () => {
      // setSupplyCap: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setSupplyCap([0n, 0n], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // freezeSupplyCap: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeSupplyCap([0n], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // setSupplyCap: failure: TokenUnregistered
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setSupplyCap([0n, 0n], { account: runner }), sft, "TokenUnregistered", [0n]);

      // freezeSupplyCap: failure: TokenUnregistered
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeSupplyCap([0n], { account: runner }), sft, "TokenUnregistered", [0n]);

      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 1n], { account: runner });

      assert.strictEqual(await sft.read.supplyCap([1n]), 0n);

      // setSupplyCap: success
      await sft.write.setSupplyCap([1n, 4n], { account: runner });

      assert.strictEqual(await sft.read.supplyCap([1n]), 4n);

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 2n], { account: minter });

      // setSupplyCap: failure: InvalidSupplyCap
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setSupplyCap([1n, 1n], { account: runner }), sft, "InvalidSupplyCap", [1n, 1n]);

      // setSupplyCap: success
      await sft.write.setSupplyCap([1n, 3n], { account: runner });

      assert.strictEqual(await sft.read.supplyCap([1n]), 3n);

      // freezeSupplyCap: success
      await sft.write.freezeSupplyCap([1n], { account: runner });

      // setSupplyCap: failure: SupplyCapFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setSupplyCap([1n, 4n], { account: runner }), sft, "SupplyCapFrozen", [1n]);

      // freezeSupplyCap: failure: SupplyCapFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeSupplyCap([1n], { account: runner }), sft, "SupplyCapFrozen", [1n]);
    });
  });

  describe("setURI, freezeURI", () => {
    const TOKEN_URI = "https://sft-metadata.com/0x1";

    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setURI([1n, TOKEN_URI], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeURI([1n], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("failure: TokenUnregistered", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setURI([1n, TOKEN_URI], { account: runner }), sft, "TokenUnregistered", [1n]);

      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeURI([1n], { account: runner }), sft, "TokenUnregistered", [1n]);
    });

    test("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 1n], { account: runner });

      assert.strictEqual(await sft.read.uri([1n]), "");

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 1n], { account: minter });

      // setURI: success
      await viem.assertions.emitWithArgs(sft.write.setURI([1n, TOKEN_URI], { account: runner }), sft, "URI", [TOKEN_URI, 1n]);

      assert.strictEqual(await sft.read.uri([1n]), TOKEN_URI);

      // freezeURI: success
      await viem.assertions.emitWithArgs(sft.write.freezeURI([1n], { account: runner }), sft, "PermanentURI", [TOKEN_URI, 1n]);

      assert.strictEqual(await sft.read.uri([1n]), TOKEN_URI);

      // setURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setURI([1n, TOKEN_URI], { account: runner }), sft, "TokenURIFrozen", [1n]);

      // freezeURI: failure: TokenURIFrozen
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeURI([1n], { account: runner }), sft, "TokenURIFrozen", [1n]);
    });
  });

  describe("airdrop", () => {
    test("failure: InvalidMinter", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.airdrop([holder1, 0n, 1n], { account: minter }), sft, "InvalidMinter", [minter]);
    });

    test("failure: EnforcedPause", async () => {
      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // airdrop: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(sft.write.airdrop([holder1, 0n, 1n], { account: minter }), sft, "EnforcedPause");
    });

    test("failure: TokenUnregistered", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // airdrop: failure: TokenUnregistered
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.airdrop([holder1, 0n, 1n], { account: minter }), sft, "TokenUnregistered", [0n]);
    });

    test("failure: SupplyCapExceeded", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 1n], { account: runner });

      // setSupplyCap: success
      await sft.write.setSupplyCap([1n, 1n], { account: runner });

      // airdrop: failure: SupplyCapExceeded
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.airdrop([holder1, 1n, 2n], { account: minter }), sft, "SupplyCapExceeded", [1n]);
    });

    test("success", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 3n], { account: runner });

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.totalSupply([]), 0n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // airdrop: success
      await viem.assertions.emitWithArgs(sft.write.airdrop([holder1, 1n, 1n], { account: minter }), sft, "TransferSingle", [minter, zeroAddress, holder1, 1n, 1n]);

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await sft.read.totalSupply([]), 1n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 1n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // airdrop: success
      await viem.assertions.emitWithArgs(sft.write.airdrop([holder1, 1n, 2n], { account: minter }), sft, "TransferSingle", [minter, zeroAddress, holder1, 1n, 2n]);

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 3n);
      assert.strictEqual(await sft.read.totalSupply([]), 3n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 3n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);
    });
  });

  describe("safeTransferFrom", () => {
    test("failure: TokenUnregistered", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.safeTransferFrom([holder1, holder2, 1n, 1n, "0x"], { account: holder1 }), sft, "TokenUnregistered", [1n]);
    });

    test("success", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 3n], { account: runner });

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 4n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 4n);
      assert.strictEqual(await sft.read.balanceOf([holder2, 1n]), 0n);
      assert.strictEqual(await sft.read.totalSupply([]), 4n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      let currentBlock = await publicClient.getBlock();
      let currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(sft.write.safeTransferFrom([holder1, holder2, 1n, 1n, "0x"], { account: holder1 }), sft, "TransferSingle", [holder1, holder1, holder2, 1n, 1n]);

      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 3n);
      assert.strictEqual(await sft.read.balanceOf([holder2, 1n]), 1n);
      assert.strictEqual(await sft.read.totalSupply([]), 4n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(sft.write.safeTransferFrom([holder1, holder2, 1n, 2n, "0x"], { account: holder1 }), sft, "TransferSingle", [holder1, holder1, holder2, 1n, 2n]);

      const holdingStartedAt2 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await sft.read.balanceOf([holder2, 1n]), 3n);
      assert.strictEqual(await sft.read.totalSupply([]), 4n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), currentTime - holdingStartedAt2);

      // safeTransferFrom: success
      await viem.assertions.emitWithArgs(sft.write.safeTransferFrom([holder2, holder1, 1n, 3n, "0x"], { account: holder2 }), sft, "TransferSingle", [holder2, holder2, holder1, 1n, 3n]);

      const holdingStartedAt3 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 4n);
      assert.strictEqual(await sft.read.balanceOf([holder2, 1n]), 0n);
      assert.strictEqual(await sft.read.totalSupply([]), 4n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt3);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);
    });
  });

  describe("safeBatchTransferFrom", () => {
    test("failure: TokenUnregistered", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.safeBatchTransferFrom([holder1, holder2, [1n, 2n], [1n, 1n], "0x"], { account: holder1 }), sft, "TokenUnregistered", [1n]);
    });

    test("success", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 3n], { account: runner });
      await sft.write.registerToken([2n, "", 3n], { account: runner });

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 4n], { account: minter });

      const holdingStartedAt1 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      // airdrop: success
      await sft.write.airdrop([holder1, 2n, 4n], { account: minter });

      const holdingStartedAt2 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      const [balance11, balance12, balance21, balance22] = await sft.read.balanceOfBatch([
        [holder1, holder1, holder2, holder2],
        [1n, 2n, 1n, 2n]
      ]);
      assert.strictEqual(balance11, 4n);
      assert.strictEqual(balance12, 4n);
      assert.strictEqual(balance21, 0n);
      assert.strictEqual(balance22, 0n);

      assert.strictEqual(await sft.read.totalSupply([]), 8n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.totalSupply([2n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 1n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 2n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      let currentBlock = await publicClient.getBlock();
      let currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt1);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), currentTime - holdingStartedAt2);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 2n]), 0n);

      // safeBatchTransferFrom: success
      await viem.assertions.emitWithArgs(sft.write.safeBatchTransferFrom([holder1, holder2, [1n, 2n], [1n, 2n], "0x"], { account: holder1 }), sft, "TransferBatch", [holder1, holder1, holder2, [1n, 2n], [1n, 2n]]);

      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      const [newBalance11, newBalance12, newBalance21, newBalance22] = await sft.read.balanceOfBatch([
        [holder1, holder1, holder2, holder2],
        [1n, 2n, 1n, 2n]
      ]);
      assert.strictEqual(newBalance11, 3n);
      assert.strictEqual(newBalance12, 2n);
      assert.strictEqual(newBalance21, 1n);
      assert.strictEqual(newBalance22, 2n);

      assert.strictEqual(await sft.read.totalSupply([]), 8n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.totalSupply([2n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt1);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder2, 2n]), 0n);
    });
  });

  describe("burn", () => {
    test("failure: TokenUnregistered", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.burn([holder1, 1n, 1n], { account: holder1 }), sft, "TokenUnregistered", [1n]);
    });

    test("success", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 3n], { account: runner });

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 4n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 4n);
      assert.strictEqual(await sft.read.totalSupply([]), 4n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      let currentBlock = await publicClient.getBlock();
      let currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);

      // burn: success
      await viem.assertions.emitWithArgs(sft.write.burn([holder1, 1n, 1n], { account: holder1 }), sft, "TransferSingle", [holder1, holder1, zeroAddress, 1n, 1n]);

      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 3n);
      assert.strictEqual(await sft.read.totalSupply([]), 3n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 3n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt);

      // burn: success
      await viem.assertions.emitWithArgs(sft.write.burn([holder1, 1n, 2n], { account: holder1 }), sft, "TransferSingle", [holder1, holder1, zeroAddress, 1n, 2n]);

      assert.strictEqual(await sft.read.balanceOf([holder1, 1n]), 1n);
      assert.strictEqual(await sft.read.totalSupply([]), 1n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 1n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
    });
  });

  describe("burnBatch", () => {
    test("failure: TokenUnregistered", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.burnBatch([holder1, [1n, 2n], [1n, 1n]], { account: holder1 }), sft, "TokenUnregistered", [1n]);
    });

    test("success", async () => {
      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 3n], { account: runner });
      await sft.write.registerToken([2n, "", 3n], { account: runner });

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 4n], { account: minter });

      const holdingStartedAt1 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      // airdrop: success
      await sft.write.airdrop([holder1, 2n, 4n], { account: minter });

      const holdingStartedAt2 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      const [balance11, balance12] = await sft.read.balanceOfBatch([
        [holder1, holder1],
        [1n, 2n]
      ]);
      assert.strictEqual(balance11, 4n);
      assert.strictEqual(balance12, 4n);

      assert.strictEqual(await sft.read.totalSupply([]), 8n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 4n);
      assert.strictEqual(await sft.read.totalSupply([2n]), 4n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 1n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      let currentBlock = await publicClient.getBlock();
      let currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt1);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), currentTime - holdingStartedAt2);

      // burnBatch: success
      await viem.assertions.emitWithArgs(sft.write.burnBatch([holder1, [1n, 2n], [1n, 2n]], { account: holder1 }), sft, "TransferBatch", [holder1, holder1, zeroAddress, [1n, 2n], [1n, 2n]]);

      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      const [newBalance11, newBalance12] = await sft.read.balanceOfBatch([
        [holder1, holder1],
        [1n, 2n]
      ]);
      assert.strictEqual(newBalance11, 3n);
      assert.strictEqual(newBalance12, 2n);

      assert.strictEqual(await sft.read.totalSupply([]), 5n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 3n);
      assert.strictEqual(await sft.read.totalSupply([2n]), 2n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt1);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      currentBlock = await publicClient.getBlock();
      currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), currentTime - holdingStartedAt1);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);

      // burnBatch: success
      await viem.assertions.emitWithArgs(sft.write.burnBatch([holder1, [1n, 2n], [1n, 2n]], { account: holder1 }), sft, "TransferBatch", [holder1, holder1, zeroAddress, [1n, 2n], [1n, 2n]]);

      const [finalBalance11, finalBalance12] = await sft.read.balanceOfBatch([
        [holder1, holder1],
        [1n, 2n]
      ]);
      assert.strictEqual(finalBalance11, 2n);
      assert.strictEqual(finalBalance12, 0n);

      assert.strictEqual(await sft.read.totalSupply([]), 2n);
      assert.strictEqual(await sft.read.totalSupply([1n]), 2n);
      assert.strictEqual(await sft.read.totalSupply([2n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });

      assert.strictEqual(await sft.read.holdingPeriod([holder1, 1n]), 0n);
      assert.strictEqual(await sft.read.holdingPeriod([holder1, 2n]), 0n);
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const feeNumerator = 300n;
    const feeDenominator = 10000n;

    test("failure: OwnableUnauthorizedAccount", async () => {
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.setDefaultRoyalty([minter, feeNumerator], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeRoyalty([], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);
    });

    test("success -> failure: RoyaltyFrozen", async () => {
      // setDefaultRoyalty: success
      await sft.write.setDefaultRoyalty([minter, feeNumerator], { account: runner });

      await viem.assertions.revertWithCustomErrorWithArgs(sft.read.royaltyInfo([0n, parseEther("1")]), sft, "TokenUnregistered", [0n]);

      // unpause: success
      await sft.write.unpause([], { account: runner });

      // addMinter: success
      await sft.write.addMinter([minter], { account: runner });

      // registerToken: success
      await sft.write.registerToken([1n, "", 1n], { account: runner });

      // airdrop: success
      await sft.write.airdrop([holder1, 1n, 1n], { account: minter });

      {
        const [receiver, amount] = await sft.read.royaltyInfo([1n, parseEther("1")]);
        assert.strictEqual(receiver, minter);
        assert.strictEqual(amount, (parseEther("1") * feeNumerator) / feeDenominator);
      }

      // freezeRoyalty: success
      await sft.write.freezeRoyalty([], { account: runner });

      // setDefaultRoyalty: failure: RoyaltyFrozen
      await viem.assertions.revertWithCustomError(sft.write.setDefaultRoyalty([minter, feeNumerator], { account: runner }), sft, "RoyaltyFrozen");

      // freezeRoyalty: failure: RoyaltyFrozen
      await viem.assertions.revertWithCustomError(sft.write.freezeRoyalty([], { account: runner }), sft, "RoyaltyFrozen");
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    test("all", async () => {
      assert.strictEqual(await sft.read.isMinter([minter]), false);

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.freezeMinters([], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.addMinter([minter], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.addMinter([zeroAddress], { account: runner }), sft, "InvalidMinter", [zeroAddress]);

      // removeMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.removeMinter([minter], { account: runner }), sft, "InvalidMinter", [minter]);

      // addMinter: success
      await viem.assertions.emitWithArgs(sft.write.addMinter([minter], { account: runner }), sft, "MinterAdded", [minter]);

      assert.strictEqual(await sft.read.isMinter([minter]), true);

      // addMinter: failure: MinterAlreadyAdded
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.addMinter([minter], { account: runner }), sft, "MinterAlreadyAdded", [minter]);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(sft.write.removeMinter([minter], { account: minter }), sft, "OwnableUnauthorizedAccount", [minter]);

      // removeMinter: success
      await viem.assertions.emitWithArgs(sft.write.removeMinter([minter], { account: runner }), sft, "MinterRemoved", [minter]);

      assert.strictEqual(await sft.read.isMinter([minter]), false);

      // freezeMinters: success
      await sft.write.freezeMinters([], { account: runner });

      // addMinter: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(sft.write.addMinter([minter], { account: runner }), sft, "MintersFrozen");

      // removeMinter: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(sft.write.removeMinter([minter], { account: runner }), sft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(sft.write.freezeMinters([], { account: runner }), sft, "MintersFrozen");
    });
  });
});