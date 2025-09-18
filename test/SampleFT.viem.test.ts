import { test, describe, beforeEach, before } from "node:test";
import assert from "node:assert";
import hre from "hardhat";
import type { HardhatViemHelpers, PublicClient, TestClient } from "@nomicfoundation/hardhat-viem/types";
import { zeroAddress, type Address, getAddress } from "viem";

const FT_CONTRACT_NAME = "SampleFT" as const;
const FT_HOLDING_AMOUNT_THRESHOLD = 3n as const; // must be greater than or equal to 2

describe(FT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60n as const;

  let runner: Address;
  let minter: Address;
  let holder1: Address;
  let holder2: Address;

  let viem: HardhatViemHelpers;
  let publicClient: PublicClient;
  let testClient: TestClient;

  let ft: any;

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
    ft = await viem.deployContract(FT_CONTRACT_NAME, [FT_HOLDING_AMOUNT_THRESHOLD]);
  });

  describe("initial state", () => {
    test("success", async () => {
      assert.strictEqual(await ft.read.owner(), runner);
      assert.strictEqual(await ft.read.paused(), true);
      assert.strictEqual(await ft.read.supplyCap(), 0n);
      assert.strictEqual(await ft.read.holdingAmountThreshold(), FT_HOLDING_AMOUNT_THRESHOLD);
    });
  });

  describe("pause, unpause", () => {
    test("all", async () => {
      // pause: failure: EnforcedPause
      await viem.assertions.revertWithCustomError(ft.write.pause([], { account: runner }), ft, "EnforcedPause");

      // unpause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.unpause([], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // unpause: success
      await viem.assertions.emitWithArgs(ft.write.unpause([], { account: runner }), ft, "Unpaused", [runner]);

      // unpause: failure: ExpectedPause
      await viem.assertions.revertWithCustomError(ft.write.unpause([], { account: runner }), ft, "ExpectedPause");

      // pause: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.pause([], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // pause: success
      await viem.assertions.emitWithArgs(ft.write.pause([], { account: runner }), ft, "Paused", [runner]);
    });
  });

  describe("setSupplyCap, freezeSupplyCap", () => {
    test("all", async () => {
      // setSupplyCap: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.setSupplyCap([0n], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // freezeSupplyCap: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.freezeSupplyCap([], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // unpause: success
      await ft.write.unpause([], { account: runner });

      // addMinter: success
      await ft.write.addMinter([minter], { account: runner });

      // setSupplyCap: success
      await ft.write.setSupplyCap([4n], { account: runner });

      assert.strictEqual(await ft.read.supplyCap(), 4n);

      // airdrop: success
      await ft.write.airdrop([holder1, 2n], { account: minter });

      // setSupplyCap: failure: InvalidSupplyCap
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.setSupplyCap([1n], { account: runner }), ft, "InvalidSupplyCap", [1n]);

      // setSupplyCap: success
      await ft.write.setSupplyCap([3n], { account: runner });

      assert.strictEqual(await ft.read.supplyCap(), 3n);

      // freezeSupplyCap: success
      await ft.write.freezeSupplyCap([], { account: runner });

      // setSupplyCap: failure: SupplyCapFrozen
      await viem.assertions.revertWithCustomError(ft.write.setSupplyCap([4n], { account: runner }), ft, "SupplyCapFrozen");

      // freezeSupplyCap: failure: SupplyCapFrozen
      await viem.assertions.revertWithCustomError(ft.write.freezeSupplyCap([], { account: runner }), ft, "SupplyCapFrozen");
    });
  });

  describe("airdrop", () => {
    test("success", async () => {
      // unpause: success
      await ft.write.unpause([], { account: runner });

      // addMinter: success
      await ft.write.addMinter([minter], { account: runner });

      assert.strictEqual(await ft.read.balanceOf([holder1]), 0n);
      assert.strictEqual(await ft.read.totalSupply(), 0n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // airdrop: success
      await viem.assertions.emitWithArgs(ft.write.airdrop([holder1, 1n], { account: minter }), ft, "Transfer", [zeroAddress, holder1, 1n]);

      assert.strictEqual(await ft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await ft.read.totalSupply(), 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // airdrop: success
      await viem.assertions.emitWithArgs(
        ft.write.airdrop([holder1, FT_HOLDING_AMOUNT_THRESHOLD - 1n], { account: minter }),
        ft,
        "Transfer",
        [zeroAddress, holder1, FT_HOLDING_AMOUNT_THRESHOLD - 1n]
      );

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock = await publicClient.getBlock();
      const currentTime = BigInt(currentBlock.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime - holdingStartedAt);
    });
  });

  describe("transfer", () => {
    test("success", async () => {
      // unpause: success
      await ft.write.unpause([], { account: runner });

      // addMinter: success
      await ft.write.addMinter([minter], { account: runner });

      // airdrop: success
      await ft.write.airdrop([holder1, FT_HOLDING_AMOUNT_THRESHOLD + 1n], { account: minter });

      let holdingStartedAt1 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.balanceOf([holder2]), 0n);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock1 = await publicClient.getBlock();
      const currentTime1 = BigInt(currentBlock1.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime1 - holdingStartedAt1);

      // transfer: success
      await viem.assertions.emitWithArgs(ft.write.transfer([holder2, 1n], { account: holder1 }), ft, "Transfer", [holder1, holder2, 1n]);

      const currentBlock2 = await publicClient.getBlock();
      const currentTime2 = BigInt(currentBlock2.timestamp);

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.balanceOf([holder2]), 1n);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime2 - holdingStartedAt1);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock3 = await publicClient.getBlock();
      const currentTime3 = BigInt(currentBlock3.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime3 - holdingStartedAt1);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);

      // transfer: success
      await viem.assertions.emitWithArgs(
        ft.write.transfer([holder2, FT_HOLDING_AMOUNT_THRESHOLD - 1n], { account: holder1 }),
        ft,
        "Transfer",
        [holder1, holder2, FT_HOLDING_AMOUNT_THRESHOLD - 1n]
      );

      const holdingStartedAt2 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await ft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await ft.read.balanceOf([holder2]), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock4 = await publicClient.getBlock();
      const currentTime4 = BigInt(currentBlock4.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), currentTime4 - holdingStartedAt2);

      // transfer: success
      await viem.assertions.emitWithArgs(
        ft.write.transfer([holder1, FT_HOLDING_AMOUNT_THRESHOLD], { account: holder2 }),
        ft,
        "Transfer",
        [holder2, holder1, FT_HOLDING_AMOUNT_THRESHOLD]
      );

      holdingStartedAt1 = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.balanceOf([holder2]), 0n);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock5 = await publicClient.getBlock();
      const currentTime5 = BigInt(currentBlock5.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime5 - holdingStartedAt1);
      assert.strictEqual(await ft.read.holdingPeriod([holder2]), 0n);
    });
  });

  describe("burn", () => {
    test("success", async () => {
      // unpause: success
      await ft.write.unpause([], { account: runner });

      // addMinter: success
      await ft.write.addMinter([minter], { account: runner });

      // airdrop: success
      await ft.write.airdrop([holder1, FT_HOLDING_AMOUNT_THRESHOLD + 1n], { account: minter });

      const holdingStartedAt = await publicClient.getBlock().then((block: any) => BigInt(block.timestamp));

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD + 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock1 = await publicClient.getBlock();
      const currentTime1 = BigInt(currentBlock1.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime1 - holdingStartedAt);

      // burn: success
      await viem.assertions.emitWithArgs(ft.write.burn([1n], { account: holder1 }), ft, "Transfer", [holder1, zeroAddress, 1n]);

      const currentBlock2 = await publicClient.getBlock();
      const currentTime2 = BigInt(currentBlock2.timestamp);

      assert.strictEqual(await ft.read.balanceOf([holder1]), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.totalSupply(), FT_HOLDING_AMOUNT_THRESHOLD);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime2 - holdingStartedAt);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });
      const currentBlock3 = await publicClient.getBlock();
      const currentTime3 = BigInt(currentBlock3.timestamp);

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), currentTime3 - holdingStartedAt);

      // burn: success
      await viem.assertions.emitWithArgs(
        ft.write.burn([FT_HOLDING_AMOUNT_THRESHOLD - 1n], { account: holder1 }),
        ft,
        "Transfer",
        [holder1, zeroAddress, FT_HOLDING_AMOUNT_THRESHOLD - 1n]
      );

      assert.strictEqual(await ft.read.balanceOf([holder1]), 1n);
      assert.strictEqual(await ft.read.totalSupply(), 1n);
      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);

      // time passed
      await testClient.increaseTime({ seconds: Number(DUMMY_PERIOD) });

      assert.strictEqual(await ft.read.holdingPeriod([holder1]), 0n);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    test("all", async () => {
      assert.strictEqual(await ft.read.isMinter([minter]), false);

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.freezeMinters([], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.addMinter([minter], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // addMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.addMinter([zeroAddress], { account: runner }), ft, "InvalidMinter", [zeroAddress]);

      // removeMinter: failure: InvalidMinter
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.removeMinter([minter], { account: runner }), ft, "InvalidMinter", [minter]);

      // addMinter: success
      await viem.assertions.emitWithArgs(ft.write.addMinter([minter], { account: runner }), ft, "MinterAdded", [minter]);

      assert.strictEqual(await ft.read.isMinter([minter]), true);

      // addMinter: failure: MinterAlreadyAdded
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.addMinter([minter], { account: runner }), ft, "MinterAlreadyAdded", [minter]);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await viem.assertions.revertWithCustomErrorWithArgs(ft.write.removeMinter([minter], { account: minter }), ft, "OwnableUnauthorizedAccount", [minter]);

      // removeMinter: success
      await viem.assertions.emitWithArgs(ft.write.removeMinter([minter], { account: runner }), ft, "MinterRemoved", [minter]);

      assert.strictEqual(await ft.read.isMinter([minter]), false);

      // freezeMinters: success
      await ft.write.freezeMinters([], { account: runner });

      // addMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(ft.write.addMinter([minter], { account: runner }), ft, "MintersFrozen");

      // removeMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(ft.write.removeMinter([minter], { account: runner }), ft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await viem.assertions.revertWithCustomError(ft.write.freezeMinters([], { account: runner }), ft, "MintersFrozen");
    });
  });
});