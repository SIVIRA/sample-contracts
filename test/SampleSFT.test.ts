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
    sft = await sftFactory.deploy(runner.address, 0, 10);
    await sft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sft.owner()).to.equal(runner.address);
      expect(await sft.paused()).to.be.true;
      expect(await sft.minTokenID()).to.equal(0);
      expect(await sft.maxTokenID()).to.equal(10);
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

  describe("freezeTokenIDRange", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sft.connect(minter).freezeTokenIDRange())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenIDRangeFrozen", async () => {
      await expect(sft.freezeTokenIDRange()).to.be.not.reverted;
      await expect(sft.freezeTokenIDRange()).to.be.revertedWithCustomError(
        sft,
        "TokenIDRangeFrozen"
      );
    });
  });

  describe("tokenURI", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        sft.connect(minter).setTokenURI(0, "https://example.com/tokens/0.json")
      )
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeTokenURI(0))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: NonexistentTokenID", async () => {
      await expect(sft.setTokenURI(999, "https://example.com/tokens/999.json"))
        .to.be.revertedWithCustomError(sft, "NonexistentToken")
        .withArgs(999);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.uri(1)).to.equal("");
      await sft.setTokenURI(1, "https://example.com/tokens/1.json");
      expect(await sft.uri(1)).to.equal("https://example.com/tokens/1.json");

      const updatedUri = "https://updated.com/tokens/1.json";
      await expect(sft.setTokenURI(1, updatedUri))
        .to.emit(sft, "URI")
        .withArgs(updatedUri, 1);
      expect(await sft.uri(1)).to.equal(updatedUri);

      await expect(sft.freezeTokenURI(1))
        .to.emit(sft, "PermanentURI")
        .withArgs(updatedUri, 1);
      expect(await sft.uri(1)).to.equal(updatedUri);

      await expect(sft.setTokenURI(1, "https://example.com/tokens/1.json"))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);
      await expect(sft.freezeTokenURI(1))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);
    });
  });

  describe("airdrop", () => {
    it("success", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);

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

    it("failure: token id is not in range", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);
      expect(await sft.minTokenID()).to.equal(0);
      expect(await sft.maxTokenID()).to.equal(10);
      await expect(sft.connect(minter).airdrop(holder1.address, 11, 1))
        .to.be.revertedWithCustomError(sft, "InvalidTokenIDRange")
        .withArgs(0, 10);
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

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
    });
  });

  describe("royalty", () => {
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
        .to.be.revertedWithCustomError(sft, "NonexistentToken")
        .withArgs(0);

      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

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
    it("airdrop and raise threshold", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      await expect(sft.holdingPeriod(holder1, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder1.address, 1);

      await sft.setHoldingThreshold(1, 2);
      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      await expect(sft.holdingPeriod(holder1, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder1.address, 1);

      await sft.connect(minter).airdrop(holder1.address, 1, 1);
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(2);
      await helpers.time.increase(1000);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1000);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      await expect(sft.holdingPeriod(holder1, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder1.address, 1);
    });

    it("transfer tokens", async () => {
      await sft.unpause();
      await sft.addMinter(minter.address);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(0);
      await sft.setHoldingThreshold(1, 2);

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
      await expect(sft.holdingPeriod(holder2, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder2.address, 1);

      await sft
        .connect(holder1)
        .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x");
      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(2);
      await helpers.time.increase(1000);
      await expect(sft.holdingPeriod(holder1, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder1.address, 1);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1000);

      await sft.connect(minter).airdrop(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(3);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1001);

      await sft.connect(holder2).burn(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(2);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(1002);
      await sft.connect(holder2).burn(holder2.address, 1, 1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
      await expect(sft.holdingPeriod(holder2, 1))
        .to.be.revertedWithCustomError(sft, "InsufficientBalance")
        .withArgs(holder2.address, 1);
    });

    describe("setHodlingThreshold", () => {
      it("failure: OwnableUnauthorizedAccount", async () => {
        await expect(sft.connect(minter).setHoldingThreshold(1, 2))
          .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
          .withArgs(minter.address);
      });

      it("failure: InvalidHoldingThreshold", async () => {
        await expect(
          sft.setHoldingThreshold(1, 0)
        ).to.be.revertedWithCustomError(sft, "InvalidHoldingThreshold");
      });

      it("failure: HoldingThresholdFrozen", async () => {
        await sft.unpause();
        await sft.addMinter(minter.address);
        await sft.connect(minter).airdrop(holder1.address, 1, 1);
        await sft.setHoldingThreshold(1, 2);
        await sft.freezeHoldingThreshold(1);

        await expect(sft.setHoldingThreshold(1, 3))
          .to.be.revertedWithCustomError(sft, "HoldingThresholdFrozen")
          .withArgs(1);
      });
    });

    describe("freezeHoldingThreshold", () => {
      it("failure: OwnableUnauthorizedAccount", async () => {
        await expect(sft.connect(minter).freezeHoldingThreshold(1))
          .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
          .withArgs(minter.address);
      });
    });
  });
});
