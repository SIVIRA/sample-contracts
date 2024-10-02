import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSFT, SampleSFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const SFT_CONTRACT_NAME = "SampleSFT" as const;

describe(SFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60 as const;

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
    const TOKEN_URI = "https://sft-metadata.com/0x1";

    it("all", async () => {
      // registerToken: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).registerToken(1, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).freezeTokenRegistration())
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // registerToken: failure: InvalidHoldingAmountThreshold
      await expect(sft.registerToken(1, TOKEN_URI, 0))
        .to.be.revertedWithCustomError(sft, "InvalidHoldingAmountThreshold")
        .withArgs(0);

      expect(await sft.isTokenRegistered(1)).to.be.false;
      await expect(sft.uri(1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
      await expect(sft.holdingAmountThreshold(1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
      await expect(sft.royaltyInfo(1, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);

      // registerToken: success
      await expect(sft.registerToken(1, TOKEN_URI, 1))
        .to.emit(sft, "TokenRegistered")
        .withArgs(1, TOKEN_URI, 1);

      expect(await sft.isTokenRegistered(1)).to.be.true;
      expect(await sft.uri(1)).to.equal(TOKEN_URI);
      expect(await sft.holdingAmountThreshold(1)).to.equal(1);
      {
        const [receiver, amount] = await sft.royaltyInfo(
          1,
          ethers.parseEther("1")
        );
        expect(receiver).to.equal(runner.address);
        expect(amount).to.equal(0);
      }

      // registerToken: failure: TokenAlreadyRegistered
      await expect(sft.registerToken(1, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sft, "TokenAlreadyRegistered")
        .withArgs(1);

      // freezeTokenRegistration: success
      await sft.freezeTokenRegistration();

      // registerToken: failure: TokenRegistrationFrozen
      await expect(
        sft.registerToken(1, TOKEN_URI, 1)
      ).to.be.revertedWithCustomError(sft, "TokenRegistrationFrozen");

      // freezeTokenRegistration: failure: TokenRegistrationFrozen
      await expect(sft.freezeTokenRegistration()).to.be.revertedWithCustomError(
        sft,
        "TokenRegistrationFrozen"
      );
    });
  });

  describe("setSupplyCap, freezeSupplyCap", () => {
    it("all", async () => {
      // setSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).setSupplyCap(0, 0))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(sft.connect(minter).freezeSupplyCap(0))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // setSupplyCap: failure: TokenUnregistered
      await expect(sft.setSupplyCap(0, 0))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);

      // freezeSupplyCap: failure: TokenUnregistered
      await expect(sft.freezeSupplyCap(0))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);

      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 1);

      expect(await sft.supplyCap(1)).to.equal(0);

      // setSupplyCap: success
      await sft.setSupplyCap(1, 4);

      expect(await sft.supplyCap(1)).to.equal(4);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 2);

      // setSupplyCap: failure: InvalidSupplyCap
      await expect(sft.setSupplyCap(1, 1))
        .to.be.revertedWithCustomError(sft, "InvalidSupplyCap")
        .withArgs(1, 1);

      // setSupplyCap: success
      await sft.setSupplyCap(1, 3);

      expect(await sft.supplyCap(1)).to.equal(3);

      // freezeSupplyCap: success
      await sft.freezeSupplyCap(1);

      // setSupplyCap: failure: SupplyCapFrozen
      await expect(sft.setSupplyCap(1, 4))
        .to.be.revertedWithCustomError(sft, "SupplyCapFrozen")
        .withArgs(1);

      // freezeSupplyCap: failure: SupplyCapFrozen
      await expect(sft.freezeSupplyCap(1))
        .to.be.revertedWithCustomError(sft, "SupplyCapFrozen")
        .withArgs(1);
    });
  });

  describe("setURI, freezeURI", () => {
    const TOKEN_URI = "https://sft-metadata.com/0x1";

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sft.connect(minter).setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sft.connect(minter).freezeURI(1))
        .to.be.revertedWithCustomError(sft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenUnregistered", async () => {
      await expect(sft.setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);

      await expect(sft.freezeURI(1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 1);

      expect(await sft.uri(1)).to.equal("");

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 1);

      // setURI: success
      await expect(sft.setURI(1, TOKEN_URI))
        .to.emit(sft, "URI")
        .withArgs(TOKEN_URI, 1);

      expect(await sft.uri(1)).to.equal(TOKEN_URI);

      // freezeURI: success
      await expect(sft.freezeURI(1))
        .to.emit(sft, "PermanentURI")
        .withArgs(TOKEN_URI, 1);

      expect(await sft.uri(1)).to.equal(TOKEN_URI);

      // setURI: failure: TokenURIFrozen
      await expect(sft.setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);

      // freezeURI: failure: TokenURIFrozen
      await expect(sft.freezeURI(1))
        .to.be.revertedWithCustomError(sft, "TokenURIFrozen")
        .withArgs(1);
    });
  });

  describe("airdrop", () => {
    it("failure: InvalidMinter", async () => {
      await expect(sft.connect(minter).airdrop(holder1.address, 0, 1))
        .to.be.revertedWithCustomError(sft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sft.addMinter(minter.address);

      // airdrop: failure: EnforcedPause
      await expect(
        sft.connect(minter).airdrop(holder1.address, 0, 1)
      ).to.be.revertedWithCustomError(sft, "EnforcedPause");
    });

    it("failure: TokenUnregistered", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // airdrop: failure: TokenUnregistered
      await expect(sft.connect(minter).airdrop(holder1.address, 0, 1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(0);
    });

    it("failure: SupplyCapExceeded", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 1);

      // setSupplyCap: success
      await sft.setSupplyCap(1, 1);

      // airdrop: failure: SupplyCapExceeded
      await expect(sft.connect(minter).airdrop(holder1.address, 1, 2))
        .to.be.revertedWithCustomError(sft, "SupplyCapExceeded")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 3);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sft["totalSupply()"]()).to.equal(0);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(0);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      // airdrop: success
      await expect(sft.connect(minter).airdrop(holder1.address, 1, 1))
        .to.emit(sft, "TransferSingle")
        .withArgs(minter.address, ethers.ZeroAddress, holder1.address, 1, 1);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft["totalSupply()"]()).to.equal(1);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      }

      // airdrop: success
      await expect(sft.connect(minter).airdrop(holder1.address, 1, 2))
        .to.emit(sft, "TransferSingle")
        .withArgs(minter.address, ethers.ZeroAddress, holder1.address, 1, 2);

      const holdingStartedAt = await utils.now();

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
      expect(await sft["totalSupply()"]()).to.equal(3);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(3);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }
    });
  });

  describe("safeTransferFrom", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(
        sft.safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x")
      )
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 3);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 4);

      let holdingStartedAt11 = await utils.now();

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(4);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(0);
      expect(await sft["totalSupply()"]()).to.equal(4);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);

      // safeTransferFrom: success
      await expect(
        sft
          .connect(holder1)
          .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x")
      )
        .to.emit(sft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, holder2.address, 1, 1);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(1);
      expect(await sft["totalSupply()"]()).to.equal(4);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
      }

      // safeTransferFrom: success
      await expect(
        sft
          .connect(holder1)
          .safeTransferFrom(holder1.address, holder2.address, 1, 2, "0x")
      )
        .to.emit(sft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, holder2.address, 1, 2);

      const holdingStartedAt21 = await utils.now();

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(3);
      expect(await sft["totalSupply()"]()).to.equal(4);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(
          now - holdingStartedAt21
        );
      }

      // safeTransferFrom: success
      await expect(
        sft
          .connect(holder2)
          .safeTransferFrom(holder2.address, holder1.address, 1, 3, "0x")
      )
        .to.emit(sft, "TransferSingle")
        .withArgs(holder2.address, holder2.address, holder1.address, 1, 3);

      holdingStartedAt11 = await utils.now();

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(4);
      expect(await sft.balanceOf(holder2.address, 1)).to.equal(0);
      expect(await sft["totalSupply()"]()).to.equal(4);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
      }
    });
  });

  describe("safeBatchTransferFrom", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(
        sft.safeBatchTransferFrom(
          holder1.address,
          holder2.address,
          [1, 2],
          [1, 1],
          "0x"
        )
      )
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 3);
      await sft.registerToken(2, "", 3);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 4);

      let holdingStartedAt11 = await utils.now();

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 2, 4);

      const holdingStartedAt12 = await utils.now();

      {
        const [balance11, balance12, balance21, balance22] =
          await sft.balanceOfBatch(
            [
              holder1.address,
              holder1.address,
              holder2.address,
              holder2.address,
            ],
            [1, 2, 1, 2]
          );
        expect(balance11).to.equal(4);
        expect(balance12).to.equal(4);
        expect(balance21).to.equal(0);
        expect(balance22).to.equal(0);
      }
      expect(await sft["totalSupply()"]()).to.equal(8);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft["totalSupply(uint256)"](2)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder2, 2)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(
          now - holdingStartedAt12
        );
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(0);
      }

      // safeBatchTransferFrom: success
      await expect(
        sft
          .connect(holder1)
          .safeBatchTransferFrom(
            holder1.address,
            holder2.address,
            [1, 2],
            [1, 2],
            "0x"
          )
      )
        .to.emit(sft, "TransferBatch")
        .withArgs(
          holder1.address,
          holder1.address,
          holder2.address,
          [1, 2],
          [1, 2]
        );

      {
        const now = await utils.now();

        {
          const [balance11, balance12, balance21, balance22] =
            await sft.balanceOfBatch(
              [
                holder1.address,
                holder1.address,
                holder2.address,
                holder2.address,
              ],
              [1, 2, 1, 2]
            );
          expect(balance11).to.equal(3);
          expect(balance12).to.equal(2);
          expect(balance21).to.equal(1);
          expect(balance22).to.equal(2);
        }
        expect(await sft["totalSupply()"]()).to.equal(8);
        expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
        expect(await sft["totalSupply(uint256)"](2)).to.equal(4);
        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(0);
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(0);
      }

      // safeBatchTransferFrom: success
      await expect(
        sft
          .connect(holder1)
          .safeBatchTransferFrom(
            holder1.address,
            holder2.address,
            [1, 2],
            [1, 2],
            "0x"
          )
      )
        .to.emit(sft, "TransferBatch")
        .withArgs(
          holder1.address,
          holder1.address,
          holder2.address,
          [1, 2],
          [1, 2]
        );

      const holdingStartedAt22 = await utils.now();

      {
        {
          const [balance11, balance12, balance21, balance22] =
            await sft.balanceOfBatch(
              [
                holder1.address,
                holder1.address,
                holder2.address,
                holder2.address,
              ],
              [1, 2, 1, 2]
            );
          expect(balance11).to.equal(2);
          expect(balance12).to.equal(0);
          expect(balance21).to.equal(2);
          expect(balance22).to.equal(4);
        }
        expect(await sft["totalSupply()"]()).to.equal(8);
        expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
        expect(await sft["totalSupply(uint256)"](2)).to.equal(4);
        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(0);
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(
          now - holdingStartedAt22
        );
      }

      // safeBatchTransferFrom: success
      await expect(
        sft
          .connect(holder2)
          .safeBatchTransferFrom(
            holder2.address,
            holder1.address,
            [1, 2],
            [2, 1],
            "0x"
          )
      )
        .to.emit(sft, "TransferBatch")
        .withArgs(
          holder2.address,
          holder2.address,
          holder1.address,
          [1, 2],
          [2, 1]
        );

      holdingStartedAt11 = await utils.now();

      {
        const now = await utils.now();

        {
          const [balance11, balance12, balance21, balance22] =
            await sft.balanceOfBatch(
              [
                holder1.address,
                holder1.address,
                holder2.address,
                holder2.address,
              ],
              [1, 2, 1, 2]
            );
          expect(balance11).to.equal(4);
          expect(balance12).to.equal(1);
          expect(balance21).to.equal(0);
          expect(balance22).to.equal(3);
        }
        expect(await sft["totalSupply()"]()).to.equal(8);
        expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
        expect(await sft["totalSupply(uint256)"](2)).to.equal(4);
        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(
          now - holdingStartedAt22
        );
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder2, 2)).to.equal(
          now - holdingStartedAt22
        );
      }
    });
  });

  describe("burn", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(sft.burn(holder1.address, 1, 1))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 3);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 4);

      const holdingStartedAt = await utils.now();

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(4);
      expect(await sft["totalSupply()"]()).to.equal(4);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(sft.connect(holder1).burn(holder1.address, 1, 1))
        .to.emit(sft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, ethers.ZeroAddress, 1, 1);

      {
        const now = await utils.now();

        expect(await sft.balanceOf(holder1.address, 1)).to.equal(3);
        expect(await sft["totalSupply()"]()).to.equal(3);
        expect(await sft["totalSupply(uint256)"](1)).to.equal(3);
        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(sft.connect(holder1).burn(holder1.address, 1, 2))
        .to.emit(sft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, ethers.ZeroAddress, 1, 2);

      expect(await sft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sft["totalSupply()"]()).to.equal(1);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      }
    });
  });

  describe("burnBatch", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(sft.burnBatch(holder1.address, [1, 2], [1, 1]))
        .to.be.revertedWithCustomError(sft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sft.unpause();

      // addMinter: success
      await sft.addMinter(minter.address);

      // registerToken: success
      await sft.registerToken(1, "", 3);
      await sft.registerToken(2, "", 3);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 4);

      const holdingStartedAt11 = await utils.now();

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 2, 4);

      const holdingStartedAt12 = await utils.now();

      {
        const [balance11, balance12] = await sft.balanceOfBatch(
          [holder1.address, holder1.address],
          [1, 2]
        );
        expect(balance11).to.equal(4);
        expect(balance12).to.equal(4);
      }
      expect(await sft["totalSupply()"]()).to.equal(8);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sft["totalSupply(uint256)"](2)).to.equal(4);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(1);
      expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(
          now - holdingStartedAt12
        );
      }

      // burnBatch: success
      await expect(
        sft.connect(holder1).burnBatch(holder1.address, [1, 2], [1, 2])
      )
        .to.emit(sft, "TransferBatch")
        .withArgs(
          holder1.address,
          holder1.address,
          ethers.ZeroAddress,
          [1, 2],
          [1, 2]
        );

      {
        const now = await utils.now();

        {
          const [balance11, balance12] = await sft.balanceOfBatch(
            [holder1.address, holder1.address],
            [1, 2]
          );
          expect(balance11).to.equal(3);
          expect(balance12).to.equal(2);
        }
        expect(await sft["totalSupply()"]()).to.equal(5);
        expect(await sft["totalSupply(uint256)"](1)).to.equal(3);
        expect(await sft["totalSupply(uint256)"](2)).to.equal(2);
        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
      }

      // burnBatch: success
      await expect(
        sft.connect(holder1).burnBatch(holder1.address, [1, 2], [1, 2])
      )
        .to.emit(sft, "TransferBatch")
        .withArgs(
          holder1.address,
          holder1.address,
          ethers.ZeroAddress,
          [1, 2],
          [1, 2]
        );

      {
        const [balance11, balance12] = await sft.balanceOfBatch(
          [holder1.address, holder1.address],
          [1, 2]
        );
        expect(balance11).to.equal(2);
        expect(balance12).to.equal(0);
      }
      expect(await sft["totalSupply()"]()).to.equal(2);
      expect(await sft["totalSupply(uint256)"](1)).to.equal(2);
      expect(await sft["totalSupply(uint256)"](2)).to.equal(0);
      expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sft.holdingPeriod(holder1, 2)).to.equal(0);
      }
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
      await sft.registerToken(1, "", 1);

      // airdrop: success
      await sft.connect(minter).airdrop(holder1.address, 1, 1);

      {
        const [receiver, amount] = await sft.royaltyInfo(1, salePrice);
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
});
