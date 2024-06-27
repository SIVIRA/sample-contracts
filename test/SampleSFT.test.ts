import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSFT, SampleSFT__factory } from "../typechain-types";

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
    it("success");
  });

  describe("supportsInterface", () => {
    it("success");
  });

  describe("pausable", () => {
    it("all");
  });

  describe("tokenIDRange", () => {
    describe("freezeTokenIDRange", () => {
      it("failure: OwnableUnauthorizedAccount");

      it("failure: TokenIDRangeFrozen");
    });
  });

  describe("tokenURI", () => {
    it("failure: OwnableUnauthorizedAccount");

    it("failure: NonexistentTokenID");

    it("success -> failure: TokenURIFrozen");
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

    it("failure: not minter");

    it("failure: token id is not in range");
  });

  describe("safeTransferFrom", () => {
    it("success");
  })

  describe("royalty", () => {
    it("failure: OwnableUnauthorizedAccount");

    it("success -> failure: RoyaltyFrozen");
  })

  describe("minter", () => {
    it("all");
  })

  describe("holding", () => {
    describe("holdingPeriod", () => {
      it("all");
    });

    describe("update holding threshold", () => {
      it("all");
    });
  });
});
