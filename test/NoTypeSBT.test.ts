import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { NoTypeSBT, NoTypeSBT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const SBT_CONTRACT_NAME = "NoTypeSBT" as const;

describe(SBT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let sbtFactory: NoTypeSBT__factory;
  let sbt: NoTypeSBT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sbtFactory = await ethers.getContractFactory(SBT_CONTRACT_NAME);
    sbt = await sbtFactory.deploy();
    await sbt.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sbt.owner()).to.equal(runner.address);
      expect(await sbt.paused()).to.be.true;
      expect(await sbt.minTokenType()).to.equal(0);
      expect(await sbt.maxTokenType()).to.equal(0);
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await sbt.supportsInterface("0x00000000")).to.be.false;
      expect(await sbt.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await sbt.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await sbt.supportsInterface("0x780e9d63")).to.be.true; // ERC721Enumerable
      expect(await sbt.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
      expect(await sbt.supportsInterface("0x49064906")).to.be.true; // ERC4906
    });
  });

  describe("pause, unpause", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(sbt.pause()).to.be.revertedWithCustomError(
        sbt,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(sbt.connect(minter).unpause())
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(sbt.unpause())
        .to.emit(sbt, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(sbt.unpause()).to.be.revertedWithCustomError(
        sbt,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(sbt.connect(minter).pause())
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(sbt.pause()).to.emit(sbt, "Paused").withArgs(runner.address);
    });
  });

  describe("freezeTokenTypeRange", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbt.connect(minter).freezeTokenTypeRange())
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenTypeRangeFrozen", async () => {
      await expect(sbt.freezeTokenTypeRange()).to.be.revertedWithCustomError(
        sbt,
        "TokenTypeRangeFrozen"
      );
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const TOKEN_URI_V1 = "https://sbt-metadata.world/v1/0x0" as const;
    const TOKEN_URI_V2 = "https://sbt-metadata.world/v2/0x0" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbt.connect(minter).setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sbt.connect(minter).freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: ERC721NonexistentToken", async () => {
      await expect(sbt.setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);

      await expect(sbt.freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt
        .connect(minter)
        .airdropWithTokenURI(holder1.address, TOKEN_URI_V1);

      expect(await sbt.tokenURI(0)).to.equal(TOKEN_URI_V1);

      // setTokenURI: success
      await expect(sbt.setTokenURI(0, TOKEN_URI_V2))
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(0);

      expect(await sbt.tokenURI(0)).to.equal(TOKEN_URI_V2);

      // freezeTokenURI: success
      await expect(sbt.freezeTokenURI(0))
        .to.emit(sbt, "PermanentURI")
        .withArgs(TOKEN_URI_V2, 0);

      expect(await sbt.tokenURI(0)).to.equal(TOKEN_URI_V2);

      // setTokenURI: failure: TokenURIFrozen
      await expect(sbt.setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(sbt, "TokenURIFrozen")
        .withArgs(0);

      // freezeTokenURI: failure: TokenURIFrozen
      await expect(sbt.freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbt, "TokenURIFrozen")
        .withArgs(0);
    });
  });

  describe("airdropWithTokenURI", () => {
    const TOKEN_URI = "https://sbt-metadata.world/0x0" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        sbt.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbt, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: failure: EnforcedPause
      await expect(
        sbt.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      ).to.be.revertedWithCustomError(sbt, "EnforcedPause");
    });

    it("success", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      expect(await sbt.balanceOf(holder1.address)).to.equal(0);
      await expect(sbt.ownerOf(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbt.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(sbt, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await sbt.totalSupply()).to.equal(0);
      await expect(sbt.tokenByIndex(0))
        .to.be.revertedWithCustomError(sbt, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(sbt.tokenURI(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbt.tokenType(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await sbt.typeSupply(0)).to.equal(0);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(0);
      await expect(sbt.holdingPeriod(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropWithTokenURI: success
      await expect(
        sbt.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.emit(sbt, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(0);

      const holdingStartedAt = await utils.now();

      expect(await sbt.balanceOf(holder1.address)).to.equal(1);
      expect(await sbt.ownerOf(0)).to.equal(holder1.address);
      expect(await sbt.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await sbt.totalSupply()).to.equal(1);
      expect(await sbt.tokenByIndex(0)).to.equal(0);
      expect(await sbt.tokenURI(0)).to.equal(TOKEN_URI);
      expect(await sbt.tokenType(0)).to.equal(0);
      expect(await sbt.typeSupply(0)).to.equal(1);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(1);
      expect(await sbt.holdingPeriod(0)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbt.holdingPeriod(0)).to.equal(now - holdingStartedAt);
      }
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI);

      // airdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        sbt.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbt, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("bulkAirdropWithTokenURI", () => {
    const TOKEN_URI_0 = "https://sbt-metadata.world/0x0" as const;
    const TOKEN_URI_1 = "https://sbt-metadata.world/0x1" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        sbt
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(sbt, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbt.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: EnforcedPause
      await expect(
        sbt
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      ).to.be.revertedWithCustomError(sbt, "EnforcedPause");
    });

    it("failure: ArgumentLengthMismatch", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: ArgumentLengthMismatch
      await expect(
        sbt.connect(minter).bulkAirdropWithTokenURI([holder1.address], [])
      ).to.be.revertedWithCustomError(sbt, "ArgumentLengthMismatch");
    });

    it("success", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      expect(await sbt.balanceOf(holder1.address)).to.equal(0);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(0);

      expect(await sbt.balanceOf(holder2.address)).to.equal(0);
      expect(await sbt.typeBalanceOf(holder2.address, 0)).to.equal(0);

      // bulkAirdropWithTokenURI: success
      await expect(
        sbt
          .connect(minter)
          .bulkAirdropWithTokenURI(
            [holder1.address, holder2.address],
            [TOKEN_URI_0, TOKEN_URI_1]
          )
      )
        .to.emit(sbt, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(0)
        .to.emit(sbt, "Transfer")
        .withArgs(ethers.ZeroAddress, holder2.address, 1)
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(1);

      expect(await sbt.balanceOf(holder1.address)).to.equal(1);
      expect(await sbt.ownerOf(0)).to.equal(holder1.address);
      expect(await sbt.tokenURI(0)).to.equal(TOKEN_URI_0);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(1);

      expect(await sbt.balanceOf(holder2.address)).to.equal(1);
      expect(await sbt.ownerOf(1)).to.equal(holder2.address);
      expect(await sbt.tokenURI(1)).to.equal(TOKEN_URI_1);
      expect(await sbt.typeBalanceOf(holder2.address, 0)).to.equal(1);
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // bulkAirdropWithTokenURI: success
      await sbt
        .connect(minter)
        .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0]);

      // bulkAirdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        sbt
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(sbt, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("safeTransferFrom", () => {
    it("failure: Soulbound", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, "");

      // safeTransferFrom: failure: Soulbound
      await expect(
        sbt
          .connect(holder1)
          ["safeTransferFrom(address,address,uint256)"](
            holder1.address,
            holder2.address,
            0
          )
      ).to.be.revertedWithCustomError(sbt, "Soulbound");
    });
  });

  describe("burn", () => {
    it("failure: ERC721NonexistentToken", async () => {
      await expect(sbt.burn(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, "");

      // burn: failure: ERC721InsufficientApproval
      await expect(sbt.burn(0))
        .to.be.revertedWithCustomError(sbt, "ERC721InsufficientApproval")
        .withArgs(runner.address, 0);
    });

    it("success", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, "");

      expect(await sbt.balanceOf(holder1.address)).to.equal(1);
      expect(await sbt.ownerOf(0)).to.equal(holder1.address);
      expect(await sbt.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await sbt.totalSupply()).to.equal(1);
      expect(await sbt.tokenByIndex(0)).to.equal(0);
      expect(await sbt.tokenURI(0)).to.equal("");
      expect(await sbt.tokenType(0)).to.equal(0);
      expect(await sbt.typeSupply(0)).to.equal(1);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(1);
      expect(await sbt.holdingPeriod(0)).to.equal(0);

      // burn: success
      await expect(sbt.connect(holder1).burn(0))
        .to.emit(sbt, "Transfer")
        .withArgs(holder1.address, ethers.ZeroAddress, 0)
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(0);

      expect(await sbt.balanceOf(holder1.address)).to.equal(0);
      await expect(sbt.ownerOf(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbt.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(sbt, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await sbt.totalSupply()).to.equal(0);
      await expect(sbt.tokenByIndex(0))
        .to.be.revertedWithCustomError(sbt, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(sbt.tokenURI(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbt.tokenType(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await sbt.typeSupply(0)).to.equal(0);
      expect(await sbt.typeBalanceOf(holder1.address, 0)).to.equal(0);
      await expect(sbt.holdingPeriod(0))
        .to.be.revertedWithCustomError(sbt, "ERC721NonexistentToken")
        .withArgs(0);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    it("all", async () => {
      expect(await sbt.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(sbt.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(sbt.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(sbt.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(sbt, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(sbt.removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbt, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(sbt.addMinter(minter.address))
        .to.emit(sbt, "MinterAdded")
        .withArgs(minter.address);

      expect(await sbt.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(sbt.addMinter(minter.address))
        .to.be.revertedWithCustomError(sbt, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(sbt.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(sbt.removeMinter(minter.address))
        .to.emit(sbt, "MinterRemoved")
        .withArgs(minter.address);

      expect(await sbt.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await sbt.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(sbt.addMinter(minter.address)).to.be.revertedWithCustomError(
        sbt,
        "MintersFrozen"
      );

      // removeMinters: failure: MintersFrozen
      await expect(
        sbt.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(sbt, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(sbt.freezeMinters()).to.be.revertedWithCustomError(
        sbt,
        "MintersFrozen"
      );
    });
  });

  describe("refreshMetadata", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbt.connect(minter).refreshMetadata())
        .to.be.revertedWithCustomError(sbt, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success: single", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, "");

      // refreshMetadata: success: single
      await expect(sbt.refreshMetadata())
        .to.emit(sbt, "MetadataUpdate")
        .withArgs(0);
    });

    it("success: plural", async () => {
      // unpause: success
      await sbt.unpause();

      // addMinter: success
      await sbt.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbt.connect(minter).airdropWithTokenURI(holder1.address, "");
      await sbt.connect(minter).airdropWithTokenURI(holder2.address, "");

      // refreshMetadata: success: plural
      await expect(sbt.refreshMetadata())
        .to.emit(sbt, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});
