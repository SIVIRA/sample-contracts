import { expect, util } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleFT, SampleFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const FT_CONTRACT_NAME = "SampleFT" as const;
const FT_HOLDING_AMOUNT_THRESHOLD = 3 as const; // must be greater than or equal to 2

describe(FT_CONTRACT_NAME, function () {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let ftFactory: SampleFT__factory;
  let ft: SampleFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    ftFactory = await ethers.getContractFactory(FT_CONTRACT_NAME);
    ft = await ftFactory.deploy(FT_HOLDING_AMOUNT_THRESHOLD);
    await ft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await ft.owner()).to.equal(runner.address);
      expect(await ft.paused()).to.be.true;
      expect(await ft.supplyCap()).to.equal(0);
      expect(await ft.holdingAmountThreshold()).to.be.eq(
        FT_HOLDING_AMOUNT_THRESHOLD
      );
    });
  });

  describe("pause, unpause", () => {
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

  describe("setSupplyCap, freezeSupplyCap", () => {
    it("all", async () => {
      // setSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).setSupplyCap(0))
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(ft.connect(minter).freezeSupplyCap())
        .to.be.revertedWithCustomError(ft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await ft.unpause();

      // addMinter: success
      await ft.addMinter(minter.address);

      // setSupplyCap: success
      await ft.setSupplyCap(4);

      expect(await ft.supplyCap()).to.equal(4);

      // airdrop: success
      await ft.connect(minter).airdrop(holder1.address, 2);

      // setSupplyCap: failure: InvalidSupplyCap
      await expect(ft.setSupplyCap(1))
        .to.be.revertedWithCustomError(ft, "InvalidSupplyCap")
        .withArgs(1);

      // setSupplyCap: success
      await ft.setSupplyCap(3);

      expect(await ft.supplyCap()).to.equal(3);

      // freezeSupplyCap: success
      await ft.freezeSupplyCap();

      // setSupplyCap: failure: SupplyCapFrozen
      await expect(ft.setSupplyCap(4)).to.be.revertedWithCustomError(
        ft,
        "SupplyCapFrozen"
      );

      // freezeSupplyCap: failure: SupplyCapFrozen
      await expect(ft.freezeSupplyCap()).to.be.revertedWithCustomError(
        ft,
        "SupplyCapFrozen"
      );
    });
  });

  describe("airdrop", () => {
    it("success", async () => {
      // unpause: success
      await ft.unpause();

      // addMinter: success
      await ft.addMinter(minter.address);

      expect(await ft.balanceOf(holder1.address)).to.equal(0);
      expect(await ft.totalSupply()).to.equal(0);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);

      // airdrop: success
      await expect(ft.connect(minter).airdrop(holder1.address, 1))
        .to.emit(ft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 1);

      expect(await ft.balanceOf(holder1.address)).to.equal(1);
      expect(await ft.totalSupply()).to.equal(1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
      }

      // airdrop: success
      await expect(
        ft
          .connect(minter)
          .airdrop(holder1.address, FT_HOLDING_AMOUNT_THRESHOLD - 1)
      )
        .to.emit(ft, "Transfer")
        .withArgs(
          ethers.ZeroAddress,
          holder1.address,
          FT_HOLDING_AMOUNT_THRESHOLD - 1
        );

      const holdingStartedAt = await utils.now();

      expect(await ft.balanceOf(holder1.address)).to.equal(
        FT_HOLDING_AMOUNT_THRESHOLD
      );
      expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt
        );
      }
    });
  });

  describe("transfer", () => {
    it("success", async () => {
      // unpause: success
      await ft.unpause();

      // addMinter: success
      await ft.addMinter(minter.address);

      // airdrop: success
      await ft
        .connect(minter)
        .airdrop(holder1.address, FT_HOLDING_AMOUNT_THRESHOLD + 1);

      let holdingStartedAt1 = await utils.now();

      expect(await ft.balanceOf(holder1.address)).to.equal(
        FT_HOLDING_AMOUNT_THRESHOLD + 1
      );
      expect(await ft.balanceOf(holder2.address)).to.equal(0);
      expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD + 1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
      expect(await ft.holdingPeriod(holder2.address)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt1
        );
      }

      // transfer: success
      await expect(ft.connect(holder1).transfer(holder2.address, 1))
        .to.emit(ft, "Transfer")
        .withArgs(holder1.address, holder2.address, 1);

      {
        const now = await utils.now();

        expect(await ft.balanceOf(holder1.address)).to.equal(
          FT_HOLDING_AMOUNT_THRESHOLD
        );
        expect(await ft.balanceOf(holder2.address)).to.equal(1);
        expect(await ft.totalSupply()).to.equal(
          FT_HOLDING_AMOUNT_THRESHOLD + 1
        );
        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt1
        );
        expect(await ft.holdingPeriod(holder2.address)).to.equal(0);
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt1
        );
        expect(await ft.holdingPeriod(holder2.address)).to.equal(0);
      }

      // transfer: success
      await expect(
        ft
          .connect(holder1)
          .transfer(holder2.address, FT_HOLDING_AMOUNT_THRESHOLD - 1)
      )
        .to.emit(ft, "Transfer")
        .withArgs(
          holder1.address,
          holder2.address,
          FT_HOLDING_AMOUNT_THRESHOLD - 1
        );

      const holdingStartedAt2 = await utils.now();

      expect(await ft.balanceOf(holder1.address)).to.equal(1);
      expect(await ft.balanceOf(holder2.address)).to.equal(
        FT_HOLDING_AMOUNT_THRESHOLD
      );
      expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD + 1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
      expect(await ft.holdingPeriod(holder2.address)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
        expect(await ft.holdingPeriod(holder2.address)).to.equal(
          now - holdingStartedAt2
        );
      }

      // transfer: success
      await expect(
        ft
          .connect(holder2)
          .transfer(holder1.address, FT_HOLDING_AMOUNT_THRESHOLD)
      )
        .to.emit(ft, "Transfer")
        .withArgs(
          holder2.address,
          holder1.address,
          FT_HOLDING_AMOUNT_THRESHOLD
        );

      holdingStartedAt1 = await utils.now();

      expect(await ft.balanceOf(holder1.address)).to.equal(
        FT_HOLDING_AMOUNT_THRESHOLD + 1
      );
      expect(await ft.balanceOf(holder2.address)).to.equal(0);
      expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD + 1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
      expect(await ft.holdingPeriod(holder2.address)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt1
        );
        expect(await ft.holdingPeriod(holder2.address)).to.equal(0);
      }
    });
  });

  describe("burn", () => {
    it("success", async () => {
      // unpause: success
      await ft.unpause();

      // addMinter: success
      await ft.addMinter(minter.address);

      // airdrop: success
      await ft
        .connect(minter)
        .airdrop(holder1.address, FT_HOLDING_AMOUNT_THRESHOLD + 1);

      const holdingStartedAt = await utils.now();

      expect(await ft.balanceOf(holder1.address)).to.equal(
        FT_HOLDING_AMOUNT_THRESHOLD + 1
      );
      expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD + 1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(ft.connect(holder1).burn(1))
        .to.emit(ft, "Transfer")
        .withArgs(holder1.address, ethers.ZeroAddress, 1);

      {
        const now = await utils.now();

        expect(await ft.balanceOf(holder1.address)).to.equal(
          FT_HOLDING_AMOUNT_THRESHOLD
        );
        expect(await ft.totalSupply()).to.equal(FT_HOLDING_AMOUNT_THRESHOLD);
        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt
        );
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(ft.connect(holder1).burn(FT_HOLDING_AMOUNT_THRESHOLD - 1))
        .to.emit(ft, "Transfer")
        .withArgs(
          holder1.address,
          ethers.ZeroAddress,
          FT_HOLDING_AMOUNT_THRESHOLD - 1
        );

      expect(await ft.balanceOf(holder1.address)).to.equal(1);
      expect(await ft.totalSupply()).to.equal(1);
      expect(await ft.holdingPeriod(holder1.address)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await ft.holdingPeriod(holder1.address)).to.equal(0);
      }
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
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
  });
});
