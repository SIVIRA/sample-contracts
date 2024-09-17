import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSBSFT, SampleSBSFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";

const SBSFT_CONTRACT_NAME = "SampleSBSFT" as const;

describe(SBSFT_CONTRACT_NAME, function () {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let sftFactory: SampleSBSFT__factory;
  let sft: SampleSBSFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sftFactory = await ethers.getContractFactory(SBSFT_CONTRACT_NAME);
    sft = await sftFactory.deploy();
    await sft.waitForDeployment();
  });

  describe("safeTransaferFrom", () => {
    it("failure: Soulbound", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 1);
      await sft.connect(minter).airdrop(holder1.address, 1, 1);

      await expect(
        sft
          .connect(holder1)
          .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x")
      ).to.be.revertedWithCustomError(sft, "Soulbound");
    });
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sft.owner()).to.equal(runner.address);
      expect(await sft.paused()).to.be.true;
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await sft.supportsInterface("0x00000000")).to.be.false;
      expect(await sft.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await sft.supportsInterface("0xd9b67a26")).to.be.true; // ERC1155
    });
  });

  describe("pausable", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(sft.pause()).to.be.revertedWithCustomError(
        sft,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).unpause())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(sft.unpause())
        .to.emit(sft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(sft.unpause()).to.be.revertedWithCustomError(
        sft,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).pause())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(sft.pause()).to.emit(sft, "Paused").withArgs(runner.address);
    });
  });

  describe("freezeTokenRegistration", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sft.connect(minter).freezeTokenRegistration())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenRegistrationFrozen", async () => {
      await expect(sft.freezeTokenRegistration()).to.be.not.reverted;
      await expect(sft.freezeTokenRegistration()).to.be.revertedWithCustomError(
        sft,
        "TokenRegistrationFrozen"
      );
    });
  });

  describe("registerToken", () => {
    it("success", async () => {
      await sft.unpause();

      await expect(sft.registerToken(1, "https://example.com/tokens/1.json", 1))
        .to.be.not.reverted;
      expect(await sft.uri(1)).to.equal("https://example.com/tokens/1.json");
    });

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        sft
          .connect(minter)
          .registerToken(1, "https://example.com/tokens/1.json", 1)
      )
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenAlreadyRegistered", async () => {
      await sft.unpause();

      await sft.registerToken(1, "https://example.com/tokens/1.json", 1);
      await expect(sft.registerToken(1, "https://example.com/tokens/1.json", 1))
        .to.be.revertedWithCustomError(sft, "TokenAlreadyRegistered")
        .withArgs(1);
    });

    it("failure: InvalidHoldingAmountThreshold", async () => {
      await sft.unpause();

      await expect(sft.registerToken(1, "https://example.com/tokens/1.json", 0))
        .to.be.revertedWithCustomError(sft, "InvalidHoldingAmountThreshold")
        .withArgs(0);
    });
  });

  describe("isTokenRegistered", () => {
    it("registered", async () => {
      await sft.unpause();
      await sft.registerToken(1, "https://example.com/tokens/1.json", 1);
      expect(await sft.isTokenRegistered(1)).to.be.true;
    });

    it("not registered", async () => {
      expect(await sft.isTokenRegistered(999)).to.be.false;
    });
  });

  describe("uri", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        sft.connect(minter).setURI(0, "https://example.com/tokens/0.json")
      )
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeURI(0))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenUnregistered", async () => {
      await expect(sft.setURI(999, "https://example.com/tokens/999.json"))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(999);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      await sft.unpause();
      await sft.registerToken(1, "", 1);
      await sft.addMinter(minter.address);
      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.uri(1)).to.equal("");
      await sft.setURI(1, "https://example.com/tokens/1.json");
      expect(await sft.uri(1)).to.equal("https://example.com/tokens/1.json");

      const updatedUri = "https://updated.com/tokens/1.json";
      await expect(sft.setURI(1, updatedUri))
        .to.emit(sft, "URI")
        .withArgs(updatedUri, 1);
      expect(await sft.uri(1)).to.equal(updatedUri);

      await expect(sft.freezeURI(1))
        .to.emit(sft, "PermanentURI")
        .withArgs(updatedUri, 1);
      expect(await sft.uri(1)).to.equal(updatedUri);

      await expect(sft.setURI(1, "https://example.com/tokens/1.json"))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);
      await expect(sft.freezeURI(1))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);
    });
  });

  describe("token cap", () => {
    it("all", async () => {
      await sft.unpause();
      await sft.registerToken(1, "", 1);
      await sft.setSupplyCap(1, 1);
      await sft.addMinter(minter.address);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      await expect(
        sft.connect(minter).airdrop(holder1.address, 1, 1)
      ).to.be.revertedWithCustomError(sft, "SupplyCapExceeded");

      await sft.setSupplyCap(1, 10);
      await sft.connect(minter).airdrop(holder1.address, 1, 9);
      expect(await sft.balanceOf(holder1.address, 1)).to.be.equal(10);

      await expect(sft.setSupplyCap(1, 3))
        .to.be.revertedWithCustomError(sft, "InvalidSupplyCap")
        .withArgs(1, 3);

      await sft.setSupplyCap(1, 0);
      expect(await sft.supplyCap(1)).to.equal(0);
    });

    it("freezable", async () => {
      await sft.unpause();
      await sft.registerToken(1, "", 1);

      await sft.setSupplyCap(1, 10);
      expect(await sft.supplyCap(1)).to.equal(10);

      await sft.freezeSupplyCap(1);
      await expect(sft.setSupplyCap(1, 99))
        .to.be.revertedWithCustomError(sft, "SupplyCapFrozen")
        .withArgs(1);
    });

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sft.connect(minter).setSupplyCap(1, 1))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeSupplyCap(1))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });
  });

  describe("airdrop", () => {
    it("success", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 1);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft["totalSupply()"]()).to.equal(1);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(1);
    });

    it("failure: not minter", async () => {
      await expect(sft.connect(holder1).airdrop(holder1.address, 1, 1))
        .to.be.revertedWithCustomError(sft, "InvalidMinter")
        .withArgs(holder1.address);
    });

    it("failure: token id is not registered", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await expect(sft.connect(minter).airdrop(holder1.address, 999, 1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(999);
    });

    it("failure: paused", async () => {
      await sft.addMinter(minter.address);
      await expect(
        sft.connect(minter).airdrop(holder1.address, 1, 1)
      ).to.be.revertedWithCustomError(sft, "EnforcedPause");
    });
  });

  describe("minter", () => {
    it("all", async () => {
      expect(await sft.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(sft.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(sft, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(sft.removeMinter(minter.address))
        .to.be.revertedWithCustomError(sft, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(sft.addMinter(minter.address))
        .to.emit(sft, "MinterAdded")
        .withArgs(minter.address);

      expect(await sft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(sft.addMinter(minter.address))
        .to.be.revertedWithCustomError(sft, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(sft.removeMinter(minter.address))
        .to.emit(sft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await sft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await sft.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(sft.addMinter(minter.address)).to.be.revertedWithCustomError(
        sft,
        "MintersFrozen"
      );

      // removeMinters: failure: MintersFrozen
      await expect(
        sft.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(sft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(sft.freezeMinters()).to.be.revertedWithCustomError(
        sft,
        "MintersFrozen"
      );
    });
  });

  describe("holding", () => {
    it("airdrop and over threshold", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 2);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(2);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1000);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(2001);
    });

    it("burn tokens", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 2);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);

      await sft.connect(minter).airdrop(holder1.address, 1, 3);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1000);

      await sft.connect(holder1).burn(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(2);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1001);

      await sft.connect(holder1).burn(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
    });
  });
});
