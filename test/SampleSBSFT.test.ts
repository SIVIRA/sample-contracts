import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleSBSFT, SampleSBSFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const SBSFT_CONTRACT_NAME = "SampleSBSFT" as const;

describe(SBSFT_CONTRACT_NAME, function () {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let sbsftFactory: SampleSBSFT__factory;
  let sbsft: SampleSBSFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sbsftFactory = await ethers.getContractFactory(SBSFT_CONTRACT_NAME);
    sbsft = await sbsftFactory.deploy();
    await sbsft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sbsft.owner()).to.equal(runner.address);
      expect(await sbsft.paused()).to.be.true;
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await sbsft.supportsInterface("0x00000000")).to.be.false;
      expect(await sbsft.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await sbsft.supportsInterface("0xd9b67a26")).to.be.true; // ERC1155
    });
  });

  describe("pause, unpause", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(sbsft.pause()).to.be.revertedWithCustomError(
        sbsft,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).unpause())
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(sbsft.unpause())
        .to.emit(sbsft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(sbsft.unpause()).to.be.revertedWithCustomError(
        sbsft,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).pause())
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(sbsft.pause())
        .to.emit(sbsft, "Paused")
        .withArgs(runner.address);
    });
  });

  describe("registerToken, freezeTokenRegistration", () => {
    const TOKEN_URI = "https://sbsft-metadata.com/0x1";

    it("all", async () => {
      // registerToken: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).registerToken(1, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeTokenRegistration: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).freezeTokenRegistration())
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // registerToken: failure: InvalidHoldingAmountThreshold
      await expect(sbsft.registerToken(1, TOKEN_URI, 0))
        .to.be.revertedWithCustomError(sbsft, "InvalidHoldingAmountThreshold")
        .withArgs(0);

      expect(await sbsft.isTokenRegistered(1)).to.be.false;
      await expect(sbsft.uri(1))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
      await expect(sbsft.holdingAmountThreshold(1))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);

      // registerToken: success
      await expect(sbsft.registerToken(1, TOKEN_URI, 1))
        .to.emit(sbsft, "TokenRegistered")
        .withArgs(1, TOKEN_URI, 1);

      expect(await sbsft.isTokenRegistered(1)).to.be.true;
      expect(await sbsft.uri(1)).to.equal(TOKEN_URI);
      expect(await sbsft.holdingAmountThreshold(1)).to.equal(1);

      // registerToken: failure: TokenAlreadyRegistered
      await expect(sbsft.registerToken(1, TOKEN_URI, 1))
        .to.be.revertedWithCustomError(sbsft, "TokenAlreadyRegistered")
        .withArgs(1);

      // freezeTokenRegistration: success
      await sbsft.freezeTokenRegistration();

      // registerToken: failure: TokenRegistrationFrozen
      await expect(
        sbsft.registerToken(1, TOKEN_URI, 1)
      ).to.be.revertedWithCustomError(sbsft, "TokenRegistrationFrozen");

      // freezeTokenRegistration: failure: TokenRegistrationFrozen
      await expect(
        sbsft.freezeTokenRegistration()
      ).to.be.revertedWithCustomError(sbsft, "TokenRegistrationFrozen");
    });
  });

  describe("setSupplyCap, freezeSupplyCap", () => {
    it("all", async () => {
      // setSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).setSupplyCap(0, 0))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // freezeSupplyCap: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).freezeSupplyCap(0))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // setSupplyCap: failure: TokenUnregistered
      await expect(sbsft.setSupplyCap(0, 0))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(0);

      // freezeSupplyCap: failure: TokenUnregistered
      await expect(sbsft.freezeSupplyCap(0))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(0);

      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 1);

      expect(await sbsft.supplyCap(1)).to.equal(0);

      // setSupplyCap: success
      await sbsft.setSupplyCap(1, 4);

      expect(await sbsft.supplyCap(1)).to.equal(4);

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 2);

      // setSupplyCap: failure: InvalidSupplyCap
      await expect(sbsft.setSupplyCap(1, 1)).to.be.revertedWithCustomError(
        sbsft,
        "InvalidSupplyCap"
      );

      // setSupplyCap: success
      await sbsft.setSupplyCap(1, 3);

      expect(await sbsft.supplyCap(1)).to.equal(3);

      // freezeSupplyCap: success
      await sbsft.freezeSupplyCap(1);

      // setSupplyCap: failure: SupplyCapFrozen
      await expect(sbsft.setSupplyCap(1, 4))
        .to.be.revertedWithCustomError(sbsft, "SupplyCapFrozen")
        .withArgs(1);

      // freezeSupplyCap: failure: SupplyCapFrozen
      await expect(sbsft.freezeSupplyCap(1))
        .to.be.revertedWithCustomError(sbsft, "SupplyCapFrozen")
        .withArgs(1);
    });
  });

  describe("setURI, freezeURI", () => {
    const TOKEN_URI = "https://sbsft-metadata.com/0x1";

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbsft.connect(minter).setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sbsft.connect(minter).freezeURI(1))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenUnregistered", async () => {
      await expect(sbsft.setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);

      await expect(sbsft.freezeURI(1))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 1);

      expect(await sbsft.uri(1)).to.equal("");

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 1);

      // setURI: success
      await expect(sbsft.setURI(1, TOKEN_URI))
        .to.emit(sbsft, "URI")
        .withArgs(TOKEN_URI, 1);

      expect(await sbsft.uri(1)).to.equal(TOKEN_URI);

      // freezeURI: success
      await expect(sbsft.freezeURI(1))
        .to.emit(sbsft, "PermanentURI")
        .withArgs(TOKEN_URI, 1);

      expect(await sbsft.uri(1)).to.equal(TOKEN_URI);

      // setURI: failure: TokenURIFrozen
      await expect(sbsft.setURI(1, TOKEN_URI))
        .to.be.revertedWithCustomError(sbsft, "TokenURIFrozen")
        .withArgs(1);

      // freezeURI: failure: TokenURIFrozen
      await expect(sbsft.freezeURI(1))
        .to.be.revertedWithCustomError(sbsft, "TokenURIFrozen")
        .withArgs(1);
    });
  });

  describe("airdrop", () => {
    it("failure: InvalidMinter", async () => {
      await expect(sbsft.connect(minter).airdrop(holder1.address, 0, 1))
        .to.be.revertedWithCustomError(sbsft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbsft.addMinter(minter.address);

      // airdrop: failure: EnforcedPause
      await expect(
        sbsft.connect(minter).airdrop(holder1.address, 0, 1)
      ).to.be.revertedWithCustomError(sbsft, "EnforcedPause");
    });

    it("failure: TokenUnregistered", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // airdrop: failure: TokenUnregistered
      await expect(sbsft.connect(minter).airdrop(holder1.address, 0, 1))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(0);
    });

    it("failure: SupplyCapExceeded", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 1);

      // setSupplyCap: success
      await sbsft.setSupplyCap(1, 1);

      // airdrop: failure: SupplyCapExceeded
      await expect(sbsft.connect(minter).airdrop(holder1.address, 1, 2))
        .to.be.revertedWithCustomError(sbsft, "SupplyCapExceeded")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 3);

      expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(0);
      expect(await sbsft["totalSupply()"]()).to.equal(0);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(0);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);

      // airdrop: success
      await expect(sbsft.connect(minter).airdrop(holder1.address, 1, 1))
        .to.emit(sbsft, "TransferSingle")
        .withArgs(minter.address, ethers.ZeroAddress, holder1.address, 1, 1);

      expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sbsft["totalSupply()"]()).to.equal(1);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(1);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);
      }

      // airdrop: success
      await expect(sbsft.connect(minter).airdrop(holder1.address, 1, 2))
        .to.emit(sbsft, "TransferSingle")
        .withArgs(minter.address, ethers.ZeroAddress, holder1.address, 1, 2);

      const holdingStartedAt = await utils.now();

      expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(3);
      expect(await sbsft["totalSupply()"]()).to.equal(3);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(3);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }
    });
  });

  describe("safeTransferFrom", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(
        sbsft.safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x")
      )
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
    });

    it("failure: Soulbound", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 1);

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 1);

      // safeTransferFrom: failure: Soulbound
      await expect(
        sbsft
          .connect(holder1)
          .safeTransferFrom(holder1.address, holder2.address, 1, 1, "0x")
      ).to.be.revertedWithCustomError(sbsft, "Soulbound");
    });
  });

  describe("safeBatchTransferFrom", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(
        sbsft.safeBatchTransferFrom(
          holder1.address,
          holder2.address,
          [1, 2],
          [1, 1],
          "0x"
        )
      )
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
    });

    it("failure: Soulbound", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 1);
      await sbsft.registerToken(2, "", 1);

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 1);
      await sbsft.connect(minter).airdrop(holder1.address, 2, 1);

      // safeBatchTransferFrom: failure: Soulbound
      await expect(
        sbsft
          .connect(holder1)
          .safeBatchTransferFrom(
            holder1.address,
            holder2.address,
            [1, 2],
            [1, 1],
            "0x"
          )
      ).to.be.revertedWithCustomError(sbsft, "Soulbound");
    });
  });

  describe("burn", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(sbsft.burn(holder1.address, 1, 1))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 3);

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 4);

      const holdingStartedAt = await utils.now();

      expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(4);
      expect(await sbsft["totalSupply()"]()).to.equal(4);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(sbsft.connect(holder1).burn(holder1.address, 1, 1))
        .to.emit(sbsft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, ethers.ZeroAddress, 1, 1);

      {
        const now = await utils.now();

        expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(3);
        expect(await sbsft["totalSupply()"]()).to.equal(3);
        expect(await sbsft["totalSupply(uint256)"](1)).to.equal(3);
        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt
        );
      }

      // burn: success
      await expect(sbsft.connect(holder1).burn(holder1.address, 1, 2))
        .to.emit(sbsft, "TransferSingle")
        .withArgs(holder1.address, holder1.address, ethers.ZeroAddress, 1, 2);

      expect(await sbsft.balanceOf(holder1.address, 1)).to.equal(1);
      expect(await sbsft["totalSupply()"]()).to.equal(1);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(1);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);
      }
    });
  });

  describe("burnBatch", () => {
    it("failure: TokenUnregistered", async () => {
      await expect(sbsft.burnBatch(holder1.address, [1, 2], [1, 1]))
        .to.be.revertedWithCustomError(sbsft, "TokenUnregistered")
        .withArgs(1);
    });

    it("success", async () => {
      // unpause: success
      await sbsft.unpause();

      // addMinter: success
      await sbsft.addMinter(minter.address);

      // registerToken: success
      await sbsft.registerToken(1, "", 3);
      await sbsft.registerToken(2, "", 3);

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 1, 4);

      const holdingStartedAt11 = await utils.now();

      // airdrop: success
      await sbsft.connect(minter).airdrop(holder1.address, 2, 4);

      const holdingStartedAt12 = await utils.now();

      {
        const [balance11, balance12] = await sbsft.balanceOfBatch(
          [holder1.address, holder1.address],
          [1, 2]
        );
        expect(balance11).to.equal(4);
        expect(balance12).to.equal(4);
      }
      expect(await sbsft["totalSupply()"]()).to.equal(8);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(4);
      expect(await sbsft["totalSupply(uint256)"](2)).to.equal(4);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(1);
      expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(
          now - holdingStartedAt12
        );
      }

      // burnBatch: success
      await expect(
        sbsft.connect(holder1).burnBatch(holder1.address, [1, 2], [1, 2])
      )
        .to.emit(sbsft, "TransferBatch")
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
          const [balance11, balance12] = await sbsft.balanceOfBatch(
            [holder1.address, holder1.address],
            [1, 2]
          );
          expect(balance11).to.equal(3);
          expect(balance12).to.equal(2);
        }
        expect(await sbsft["totalSupply()"]()).to.equal(5);
        expect(await sbsft["totalSupply(uint256)"](1)).to.equal(3);
        expect(await sbsft["totalSupply(uint256)"](2)).to.equal(2);
        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(0);
      }

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(
          now - holdingStartedAt11
        );
        expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(0);
      }

      // burnBatch: success
      await expect(
        sbsft.connect(holder1).burnBatch(holder1.address, [1, 2], [1, 2])
      )
        .to.emit(sbsft, "TransferBatch")
        .withArgs(
          holder1.address,
          holder1.address,
          ethers.ZeroAddress,
          [1, 2],
          [1, 2]
        );

      {
        const [balance11, balance12] = await sbsft.balanceOfBatch(
          [holder1.address, holder1.address],
          [1, 2]
        );
        expect(balance11).to.equal(2);
        expect(balance12).to.equal(0);
      }
      expect(await sbsft["totalSupply()"]()).to.equal(2);
      expect(await sbsft["totalSupply(uint256)"](1)).to.equal(2);
      expect(await sbsft["totalSupply(uint256)"](2)).to.equal(0);
      expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);
      expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(0);

      // time passed
      {
        await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbsft.holdingPeriod(holder1, 1)).to.equal(0);
        expect(await sbsft.holdingPeriod(holder1, 2)).to.equal(0);
      }
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    it("all", async () => {
      expect(await sbsft.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(sbsft.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(sbsft, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(sbsft.removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbsft, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(sbsft.addMinter(minter.address))
        .to.emit(sbsft, "MinterAdded")
        .withArgs(minter.address);

      expect(await sbsft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(sbsft.addMinter(minter.address))
        .to.be.revertedWithCustomError(sbsft, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(sbsft.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbsft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(sbsft.removeMinter(minter.address))
        .to.emit(sbsft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await sbsft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await sbsft.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(
        sbsft.addMinter(minter.address)
      ).to.be.revertedWithCustomError(sbsft, "MintersFrozen");

      // removeMinters: failure: MintersFrozen
      await expect(
        sbsft.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(sbsft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(sbsft.freezeMinters()).to.be.revertedWithCustomError(
        sbsft,
        "MintersFrozen"
      );
    });
  });
});
