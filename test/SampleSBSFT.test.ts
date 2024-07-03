import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSBSFT, SampleSBSFT__factory } from "../typechain-types";

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
    sft = await sftFactory.deploy(runner.address);
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
});
