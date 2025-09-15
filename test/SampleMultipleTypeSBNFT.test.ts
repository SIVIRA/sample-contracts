import { expect } from "chai";

import { network } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";
import {NetworkHelpers} from "@nomicfoundation/hardhat-network-helpers/types";

import {
  SampleMultipleTypeSBNFT,
  SampleMultipleTypeSBNFT__factory,
} from "../typechain-types";

import * as utils from "./utils";

const SBNFT_CONTRACT_NAME = "SampleMultipleTypeSBNFT" as const;
const SBNFT_MAX_TOKEN_TYPE = 3 as const; // must be greater than or equal to 2

describe(SBNFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;
  let ethers: HardhatEthers;
  let helpers: NetworkHelpers;

  let sbnftFactory: SampleMultipleTypeSBNFT__factory;
  let sbnft: SampleMultipleTypeSBNFT;

  before(async () => {
    let { ethers: eth, networkHelpers } = await network.connect();
    ethers = eth;
    helpers = networkHelpers;
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sbnftFactory = await ethers.getContractFactory(SBNFT_CONTRACT_NAME);
    sbnft = await sbnftFactory.deploy(SBNFT_MAX_TOKEN_TYPE);
    await sbnft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sbnft.owner()).to.equal(runner.address);
      expect(await sbnft.paused()).to.be.true;
      expect(await sbnft.minTokenType()).to.equal(1);
      expect(await sbnft.maxTokenType()).to.equal(SBNFT_MAX_TOKEN_TYPE);
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await sbnft.supportsInterface("0x00000000")).to.be.false;
      expect(await sbnft.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await sbnft.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await sbnft.supportsInterface("0x780e9d63")).to.be.true; // ERC721Enumerable
      expect(await sbnft.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
      expect(await sbnft.supportsInterface("0x49064906")).to.be.true; // ERC4906
    });
  });

  describe("pause, unpause", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(sbnft.pause()).to.be.revertedWithCustomError(
        sbnft,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(sbnft.connect(minter).unpause())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(sbnft.unpause())
        .to.emit(sbnft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(sbnft.unpause()).to.be.revertedWithCustomError(
        sbnft,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(sbnft.connect(minter).pause())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(sbnft.pause())
        .to.emit(sbnft, "Paused")
        .withArgs(runner.address);
    });
  });

  describe("setMaxTokenType, freezeTokenTypeRange", async () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        sbnft.connect(minter).setMaxTokenType(SBNFT_MAX_TOKEN_TYPE + 1)
      )
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sbnft.connect(minter).freezeTokenTypeRange())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: InvalidMaxTokenType", async () => {
      await expect(sbnft.setMaxTokenType(SBNFT_MAX_TOKEN_TYPE - 1))
        .to.be.revertedWithCustomError(sbnft, "InvalidMaxTokenType")
        .withArgs(SBNFT_MAX_TOKEN_TYPE - 1);
    });

    it("success -> failure: TokenTypeRangeFrozen", async () => {
      // setMaxTokenType: success
      await sbnft.setMaxTokenType(SBNFT_MAX_TOKEN_TYPE + 1);

      expect(await sbnft.minTokenType()).to.equal(1);
      expect(await sbnft.maxTokenType()).to.equal(SBNFT_MAX_TOKEN_TYPE + 1);

      // freezeTokenTypeRange: success
      await sbnft.freezeTokenTypeRange();

      // setMaxTokenType: failure: TokenTypeRangeFrozen
      await expect(
        sbnft.setMaxTokenType(SBNFT_MAX_TOKEN_TYPE + 2)
      ).to.be.revertedWithCustomError(sbnft, "TokenTypeRangeFrozen");

      // freezeTokenTypeRange: failure: TokenTypeRangeFrozen
      await expect(sbnft.freezeTokenTypeRange()).to.be.revertedWithCustomError(
        sbnft,
        "TokenTypeRangeFrozen"
      );
    });
  });

  describe("setBaseTokenURI", () => {
    const BASE_TOKEN_URI = "https://sbnft-metadata.world/" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbnft.connect(minter).setBaseTokenURI(BASE_TOKEN_URI))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success: single", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      expect(await sbnft.tokenURI(0)).to.equal("");

      // setBaseTokenURI: success: single
      await expect(sbnft.setBaseTokenURI(BASE_TOKEN_URI))
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      expect(await sbnft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "1/0");
    });

    it("success: plural", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);
      await sbnft.connect(minter).airdropByType(holder2.address, 1);

      expect(await sbnft.tokenURI(0)).to.equal("");
      expect(await sbnft.tokenURI(1)).to.equal("");

      // setBaseTokenURI: success: plural
      await expect(sbnft.setBaseTokenURI(BASE_TOKEN_URI))
        .to.emit(sbnft, "BatchMetadataUpdate")
        .withArgs(0, 1);

      expect(await sbnft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "1/0");
      expect(await sbnft.tokenURI(1)).to.equal(BASE_TOKEN_URI + "1/1");
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const BASE_TOKEN_URI = "https://sbnft-metadata.world/" as const;
    const TOKEN_URI = "https://sbnft-metadata.world/0x0" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbnft.connect(minter).setTokenURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sbnft.connect(minter).freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: ERC721NonexistentToken", async () => {
      await expect(sbnft.setTokenURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);

      await expect(sbnft.freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      expect(await sbnft.tokenURI(0)).to.equal("");

      // setBaseTokenURI: success
      await sbnft.setBaseTokenURI(BASE_TOKEN_URI);

      expect(await sbnft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "1/0");

      // setTokenURI: success
      await expect(sbnft.setTokenURI(0, TOKEN_URI))
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI);

      // freezeTokenURI: success
      await expect(sbnft.freezeTokenURI(0))
        .to.emit(sbnft, "PermanentURI")
        .withArgs(TOKEN_URI, 0);

      // setTokenURI: failure: TokenURIFrozen
      await expect(sbnft.setTokenURI(0, TOKEN_URI))
        .to.be.revertedWithCustomError(sbnft, "TokenURIFrozen")
        .withArgs(0);

      // freezeTokenURI: failure: TokenURIFrozen
      await expect(sbnft.freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "TokenURIFrozen")
        .withArgs(0);
    });
  });

  describe("airdrop", () => {
    it("failure: UnsupportedFunction", async () => {
      await expect(
        sbnft.connect(minter).airdrop(holder1.address)
      ).to.be.revertedWithCustomError(sbnft, "UnsupportedFunction");
    });
  });

  describe("airdropByType", () => {
    it("failure: InvalidMinter", async () => {
      await expect(sbnft.connect(minter).airdropByType(holder1.address, 1))
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: failure: EnforcedPause
      await expect(
        sbnft.connect(minter).airdropByType(holder1.address, 1)
      ).to.be.revertedWithCustomError(sbnft, "EnforcedPause");
    });

    it("failure: InvalidTokenType", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: failure: InvalidTokenType
      await expect(sbnft.connect(minter).airdropByType(holder1.address, 0))
        .to.be.revertedWithCustomError(sbnft, "InvalidTokenType")
        .withArgs(0);
      await expect(
        sbnft
          .connect(minter)
          .airdropByType(holder1.address, SBNFT_MAX_TOKEN_TYPE + 1)
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidTokenType")
        .withArgs(SBNFT_MAX_TOKEN_TYPE + 1);
    });

    it("success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(0);
      await expect(sbnft.ownerOf(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbnft.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(sbnft, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await sbnft.totalSupply()).to.equal(0);
      await expect(sbnft.tokenByIndex(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(sbnft.tokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbnft.tokenType(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await sbnft.typeSupply(1)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(0);
      await expect(sbnft.holdingPeriod(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropByType: success
      await expect(sbnft.connect(minter).airdropByType(holder1.address, 1))
        .to.emit(sbnft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      const holdingStartedAt = await utils.now(ethers);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(1);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await sbnft.totalSupply()).to.equal(1);
      expect(await sbnft.tokenByIndex(0)).to.equal(0);
      expect(await sbnft.tokenURI(0)).to.equal("");
      expect(await sbnft.tokenType(0)).to.equal(1);
      expect(await sbnft.typeSupply(1)).to.equal(1);
      expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(1);
      expect(await sbnft.holdingPeriod(0)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbnft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
      }
    });

    it("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      // airdropByType: failure: AlreadyAirdropped
      await expect(sbnft.connect(minter).airdropByType(holder1.address, 1))
        .to.be.revertedWithCustomError(sbnft, "AlreadyAirdropped")
        .withArgs(1, holder1.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 2);

      expect(await sbnft.balanceOf(holder1)).to.equal(2);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.ownerOf(1)).to.equal(holder1.address);
      expect(await sbnft.typeBalanceOf(holder1, 1)).to.equal(1);
      expect(await sbnft.typeBalanceOf(holder1, 2)).to.equal(1);
    });
  });

  describe("airdropWithTokenURI", () => {
    it("failure: UnsupportedFunction", async () => {
      await expect(
        sbnft.connect(minter).airdropWithTokenURI(holder1.address, "")
      ).to.be.revertedWithCustomError(sbnft, "UnsupportedFunction");
    });
  });

  describe("bulkAirdropByType", () => {
    it("failure: InvalidMinter", async () => {
      await expect(
        sbnft.connect(minter).bulkAirdropByType([holder1.address], 1)
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropByType: failure: EnforcedPause
      await expect(
        sbnft.connect(minter).bulkAirdropByType([holder1.address], 1)
      ).to.be.revertedWithCustomError(sbnft, "EnforcedPause");
    });

    it("failure: InvalidTokenType", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropByType: failure: InvalidTokenType
      await expect(
        sbnft.connect(minter).bulkAirdropByType([holder1.address], 0)
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidTokenType")
        .withArgs(0);
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropByType([holder1.address], SBNFT_MAX_TOKEN_TYPE + 1)
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidTokenType")
        .withArgs(SBNFT_MAX_TOKEN_TYPE + 1);
    });

    it("success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(0);

      expect(await sbnft.balanceOf(holder2.address)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder2.address, 1)).to.equal(0);

      // bulkAirdropByType: success
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropByType([holder1.address, holder2.address], 1)
      )
        .to.emit(sbnft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0)
        .to.emit(sbnft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder2.address, 1)
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(1);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(1);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(1);

      expect(await sbnft.balanceOf(holder2.address)).to.equal(1);
      expect(await sbnft.ownerOf(1)).to.equal(holder2.address);
      expect(await sbnft.typeBalanceOf(holder2.address, 1)).to.equal(1);
    });

    it("success -> failure: AlreadyAirdropped -> success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropByType: success
      await sbnft.connect(minter).bulkAirdropByType([holder1.address], 1);

      // bulkAirdropByType: failure: AlreadyAirdropped
      await expect(
        sbnft.connect(minter).bulkAirdropByType([holder1.address], 1)
      )
        .to.be.revertedWithCustomError(sbnft, "AlreadyAirdropped")
        .withArgs(1, holder1.address);

      // bulkAirdropByType: success
      await sbnft.connect(minter).bulkAirdropByType([holder1.address], 2);

      expect(await sbnft.balanceOf(holder1)).to.equal(2);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.ownerOf(1)).to.equal(holder1.address);
      expect(await sbnft.typeBalanceOf(holder1, 1)).to.equal(1);
      expect(await sbnft.typeBalanceOf(holder1, 2)).to.equal(1);
    });
  });

  describe("safeTransferFrom", () => {
    it("failure: Soulbound", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      // safeTransferFrom: failure: Soulbound
      await expect(
        sbnft
          .connect(holder1)
          ["safeTransferFrom(address,address,uint256)"](
            holder1.address,
            holder2.address,
            0
          )
      ).to.be.revertedWithCustomError(sbnft, "Soulbound");
    });
  });

  describe("burn", () => {
    const TOKEN_URI = "https://sbnft-metadata.world/0x0" as const;

    it("failure: ERC721NonexistentToken", async () => {
      await expect(sbnft.burn(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      // burn: failure: ERC721InsufficientApproval
      await expect(sbnft.burn(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721InsufficientApproval")
        .withArgs(runner.address, 0);
    });

    it("success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      const holdingStartedAt = await utils.now(ethers);

      // setTokenURI: success
      await sbnft.setTokenURI(0, TOKEN_URI);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbnft.balanceOf(holder1.address)).to.equal(1);
        expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
        expect(await sbnft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        expect(await sbnft.totalSupply()).to.equal(1);
        expect(await sbnft.tokenByIndex(0)).to.equal(0);
        expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI);
        expect(await sbnft.tokenType(0)).to.equal(1);
        expect(await sbnft.typeSupply(1)).to.equal(1);
        expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(1);
        expect(await sbnft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
      }

      // burn: success
      await expect(sbnft.connect(holder1).burn(0))
        .to.emit(sbnft, "Transfer")
        .withArgs(holder1.address, ethers.ZeroAddress, 0)
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(0);
      await expect(sbnft.ownerOf(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbnft.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(sbnft, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await sbnft.totalSupply()).to.equal(0);
      await expect(sbnft.tokenByIndex(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(sbnft.tokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(sbnft.tokenType(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await sbnft.typeSupply(1)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 1)).to.equal(0);
      await expect(sbnft.holdingPeriod(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    it("all", async () => {
      expect(await sbnft.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(sbnft.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(sbnft.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(sbnft.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(sbnft.removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(sbnft.addMinter(minter.address))
        .to.emit(sbnft, "MinterAdded")
        .withArgs(minter.address);

      expect(await sbnft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(sbnft.addMinter(minter.address))
        .to.be.revertedWithCustomError(sbnft, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(sbnft.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(sbnft.removeMinter(minter.address))
        .to.emit(sbnft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await sbnft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await sbnft.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(
        sbnft.addMinter(minter.address)
      ).to.be.revertedWithCustomError(sbnft, "MintersFrozen");

      // removeMinters: failure: MintersFrozen
      await expect(
        sbnft.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(sbnft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(sbnft.freezeMinters()).to.be.revertedWithCustomError(
        sbnft,
        "MintersFrozen"
      );
    });
  });

  describe("refreshMetadata", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbnft.connect(minter).refreshMetadata())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success: single", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);

      // refreshMetadata: success: single
      await expect(sbnft.refreshMetadata())
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);
    });

    it("success: plural", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropByType: success
      await sbnft.connect(minter).airdropByType(holder1.address, 1);
      await sbnft.connect(minter).airdropByType(holder2.address, 1);

      // refreshMetadata: success: plural
      await expect(sbnft.refreshMetadata())
        .to.emit(sbnft, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});
