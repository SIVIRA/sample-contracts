import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSFT, SampleSFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";

const SFT_CONTRACT_NAME = "SampleSFT" as const;

describe(SFT_CONTRACT_NAME, () => {
  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let sftFactory: SampleSFT__factory;
  let sft: SampleSFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sftFactory = await ethers.getContractFactory(SFT_CONTRACT_NAME);
    sft = await sftFactory.deploy();
    await sft.waitForDeployment();
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
      expect(await sft.supportsInterface("0x2a55205a")).to.be.true; // ERC2981
    });
  });

  describe("pause, unpause", () => {
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

  describe("registerToken, freezeTokenRegistration", () => {
    const TOKEN_URI = "https://sft-metadata.com/0x0";

    it("all", async () => {
      // registerToken: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).registerToken(0, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).freezeTokenRegistration())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // registerToken: failure: InvalidHoldingAmountThreshold
      await expect(sft.registerToken(0, TOKEN_URI, 0))
        .to.be.revertedWithCustomError(sft, "InvalidHoldingAmountThreshold")
        .withArgs(0);

      expect(await sft.isTokenRegistered(0)).to.be.false;
      await expect(sft.uri(0))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);
      await expect(sft.holdingAmountThreshold(0))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);

      // registerToken: success
      await expect(sft.registerToken(0, TOKEN_URI, 1))
        .to.emit(sft, "TokenRegistered")
        .withArgs(0, TOKEN_URI, 1);

      expect(await sft.isTokenRegistered(0)).to.be.true;
      expect(await sft.uri(0)).to.equal(TOKEN_URI);
      expect(await sft.holdingAmountThreshold(0)).to.equal(1);

      // registerToken: failure: TokenAlreadyRegistered
      await expect(sft.registerToken(0, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sft, "TokenAlreadyRegistered")
        .withArgs(0);

      // freezeTokenRegistration: success
      await sft.freezeTokenRegistration();

      // registerToken: failure: TokenRegistrationFrozen
      await expect(
        sft.registerToken(0, TOKEN_URI, 1)
      ).to.be.revertedWithCustomError(sft, "TokenRegistrationFrozen");

      // freezeTokenRegistration: failure: TokenRegistrationFrozen
      await expect(sft.freezeTokenRegistration()).to.be.revertedWithCustomError(
        sft,
        "TokenRegistrationFrozen"
      );
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

  describe("setURI, freezeURI", () => {
    const TOKEN_URI = "https://sft-metadata.com/0x0";

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sft.connect(minter).setURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeURI(0))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenUnregistered", async () => {
      await expect(sft.setURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);

      await expect(sft.freezeURI(0))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(0, "", 1);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 0, 1);

      expect(await sft.uri(0)).to.equal("");

      // setURI: success
      await expect(sft.setURI(0, TOKEN_URI))
        .to.emit(sft, "URI")
        .withArgs(TOKEN_URI, 0);

      expect(await sft.uri(0)).to.equal(TOKEN_URI);

      // freezeURI: success
      await expect(sft.freezeURI(0))
        .to.emit(sft, "PermanentURI")
        .withArgs(TOKEN_URI, 0);

      expect(await sft.uri(0)).to.equal(TOKEN_URI);

      // setURI: failure: TokenURIFrozen
      await expect(sft.setURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(0);

      // freezeURI: failure: TokenURIFrozen
      await expect(sft.freezeURI(0))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(0);
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

  describe("safeTransferFrom", () => {
    it("success", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 1);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const feeNumerator = BigInt(300);
    const feeDenominator = BigInt(10000);
    const salePrice = ethers.parseEther("1");

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        sft.connect(minter).setDefaultRoyalty(minter.address, feeNumerator)
      )
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeRoyalty())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success -> failure: RoyaltyFrozen", async () => {
      // setDefaultRoyalty: success
      await sft.setDefaultRoyalty(minter.address, feeNumerator);

      await expect(sft.royaltyInfo(0, salePrice))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);

      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(0, "", 1);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 0, 1);

      {
        const [receiver, amount] = await sft.royaltyInfo(0, salePrice);
        expect(receiver).to.equal(minter.address);
        expect(amount).to.equal((salePrice * feeNumerator) / feeDenominator);
      }

      // freezeRoyalty: success
      await sft.freezeRoyalty();

      // setDefaultRoyalty: failure: RoyaltyFrozen
      await expect(
        sft.setDefaultRoyalty(minter.address, feeNumerator)
      ).to.be.revertedWithCustomError(sft, "RoyaltyFrozen");

      // freezeRoyalty: failure: RoyaltyFrozen
      await expect(sft.freezeRoyalty()).to.be.revertedWithCustomError(
        sft,
        "RoyaltyFrozen"
      );
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
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
    });

    it("transfer tokens", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.registerToken(1, "", 2);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(0);

      await sft.connect(minter).airdrop(holder1.address, 1, 3);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1000);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(2);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(2001);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(2);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1000);

      await sft.connect(minter).airdrop(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(3);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1001);

      await sft.connect(holder2).burn(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(2);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1002);

      await sft.connect(holder2).burn(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
    });
  });
});
