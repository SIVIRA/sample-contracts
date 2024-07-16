import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleFT, SampleFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";

const FT_CONTRACT_NAME = "SampleFT" as const;

describe(FT_CONTRACT_NAME, function () {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let ftFactory: SampleFT__factory;
  let ft: SampleFT;

  const HOLDING_THRESHOLD = 10;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    ftFactory = await ethers.getContractFactory(FT_CONTRACT_NAME);
    ft = await ftFactory.deploy(
      runner.address,
      "Test",
      "TS",
      HOLDING_THRESHOLD
    );
    await ft.waitForDeployment();
  });

  describe("pausable", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(ft.pause()).to.be.revertedWithCustomError(
        ft,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).unpause())
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(ft.unpause())
        .to.emit(ft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(ft.unpause()).to.be.revertedWithCustomError(
        ft,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).pause())
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(ft.pause()).to.emit(ft, "Paused").withArgs(runner.address);
    });
  });

  describe("minter", () => {
    it("all", async () => {
      expect(await ft.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(ft.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(ft, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(ft.removeMinter(minter.address))
        .to.be.revertedWithCustomError(ft, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(ft.addMinter(minter.address))
        .to.emit(ft, "MinterAdded")
        .withArgs(minter.address);

      expect(await ft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(ft.addMinter(minter.address))
        .to.be.revertedWithCustomError(ft, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(ft.removeMinter(minter.address))
        .to.emit(ft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await ft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await ft.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(ft.addMinter(minter.address)).to.be.revertedWithCustomError(
        ft,
        "MintersFrozen"
      );

      // removeMinters: failure: MintersFrozen
      await expect(
        ft.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(ft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(ft.freezeMinters()).to.be.revertedWithCustomError(
        ft,
        "MintersFrozen"
      );
    });

    it("failure: InvalidMinter", async () => {
      await ft.unpause();
      await ft.addMinter(minter.address);

      await expect(ft.connect(holder1).airdrop(holder2.address, 10))
        .to.be.revertedWithCustomError(ft, "InvalidMinter")
        .withArgs(holder1.address);
    });
  });

  describe("cap", () => {
    it("success", async () => {
      await ft.unpause();

      expect(await ft.cap()).to.be.eq(0);
      await ft.setCap(1000);
      expect(await ft.cap()).to.be.eq(1000);
      await ft.setCap(0);
      expect(await ft.cap()).to.be.eq(0);
    });

    it("freezable", async () => {
      await ft.unpause();

      expect(await ft.cap()).to.be.eq(0);
      await ft.setCap(1000);
      expect(await ft.cap()).to.be.eq(1000);
      await ft.freezeCap();
      await expect(ft.setCap(2000)).to.be.revertedWithCustomError(
        ft,
        "CapFrozen"
      );
    });

    it("over cap mint", async () => {
      await ft.unpause();
      await ft.addMinter(minter.address);

      await ft.setCap(100);
      expect(await ft.cap()).to.be.eq(100);

      await expect(ft.connect(minter).airdrop(holder1.address, 1000))
        .to.be.revertedWithCustomError(ft, "ExceededCap")
        .withArgs(1000, 100);
    });

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(ft.connect(minter).setCap(100))
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(ft.connect(minter).freezeCap())
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: InvalidCap", async () => {
      await ft.unpause();
      await ft.addMinter(minter.address);

      await ft.setCap(100);
      expect(await ft.cap()).to.be.eq(100);
      await ft.connect(minter).airdrop(holder1.address, 100);
      expect(await ft.totalSupply()).to.be.eq(100);

      await expect(ft.setCap(1))
        .to.be.revertedWithCustomError(ft, "InvalidCap")
        .withArgs(1);
    });
  });

  describe("holding", () => {
    it("airdrop and over threshold", async () => {
      await ft.unpause();
      await ft.addMinter(minter.address);

      expect(await ft.balanceOf(holder1.address)).to.be.eq(0);
      await expect(ft.holdingPeriod(holder1))
        .to.be.revertedWithCustomError(ft, "InsufficientBalance")
        .withArgs(holder1.address);

      await ft.connect(minter).airdrop(holder1.address, 100);
      expect(await ft.balanceOf(holder1.address)).to.be.eq(100);
      await helpers.time.increase(1000);
      expect(await ft.holdingPeriod(holder1)).to.be.eq(1000);
    });

    it("transfer tokens and under threshold", async () => {
      await ft.unpause();
      await ft.addMinter(minter.address);

      await ft.connect(minter).airdrop(holder1.address, 10);
      expect(await ft.balanceOf(holder1.address)).to.be.eq(10);
      await helpers.time.increase(1000);
      expect(await ft.holdingPeriod(holder1)).to.be.eq(1000);

      await ft.connect(holder1).burn(1);
      expect(await ft.balanceOf(holder1.address)).to.be.eq(9);
      await expect(ft.holdingPeriod(holder1))
        .to.be.revertedWithCustomError(ft, "InsufficientBalance")
        .withArgs(holder1.address);

      await ft.connect(minter).airdrop(holder2.address, 9);
      expect(await ft.balanceOf(holder2.address)).to.be.eq(9);
      await expect(ft.holdingPeriod(holder2))
        .to.be.revertedWithCustomError(ft, "InsufficientBalance")
        .withArgs(holder2.address);

      await ft.connect(minter).airdrop(holder1.address, 10);
      await ft.connect(holder1).transfer(holder2.address, 1);
      expect(await ft.balanceOf(holder2.address)).to.be.eq(10);
      await helpers.time.increase(1000);
      expect(await ft.holdingPeriod(holder2)).to.be.eq(1000);
    });
  });
});
