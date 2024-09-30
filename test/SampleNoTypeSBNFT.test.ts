import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  SampleNoTypeSBNFT,
  SampleNoTypeSBNFT__factory,
} from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const SBNFT_CONTRACT_NAME = "SampleNoTypeSBNFT" as const;

describe(SBNFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let sbnftFactory: SampleNoTypeSBNFT__factory;
  let sbnft: SampleNoTypeSBNFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    sbnftFactory = await ethers.getContractFactory(SBNFT_CONTRACT_NAME);
    sbnft = await sbnftFactory.deploy();
    await sbnft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await sbnft.owner()).to.equal(runner.address);
      expect(await sbnft.paused()).to.be.true;
      expect(await sbnft.minTokenType()).to.equal(0);
      expect(await sbnft.maxTokenType()).to.equal(0);
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

  describe("freezeTokenTypeRange", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbnft.connect(minter).freezeTokenTypeRange())
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenTypeRangeFrozen", async () => {
      await expect(sbnft.freezeTokenTypeRange()).to.be.revertedWithCustomError(
        sbnft,
        "TokenTypeRangeFrozen"
      );
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const TOKEN_URI_V1 = "https://sbnft-metadata.world/v1/0x0" as const;
    const TOKEN_URI_V2 = "https://sbnft-metadata.world/v2/0x0" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(sbnft.connect(minter).setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(sbnft.connect(minter).freezeTokenURI(0))
        .to.be.revertedWithCustomError(sbnft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: ERC721NonexistentToken", async () => {
      await expect(sbnft.setTokenURI(0, TOKEN_URI_V1))
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

      // airdropWithTokenURI: success
      await sbnft
        .connect(minter)
        .airdropWithTokenURI(holder1.address, TOKEN_URI_V1);

      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI_V1);

      // setTokenURI: success
      await expect(sbnft.setTokenURI(0, TOKEN_URI_V2))
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI_V2);

      // freezeTokenURI: success
      await expect(sbnft.freezeTokenURI(0))
        .to.emit(sbnft, "PermanentURI")
        .withArgs(TOKEN_URI_V2, 0);

      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI_V2);

      // setTokenURI: failure: TokenURIFrozen
      await expect(sbnft.setTokenURI(0, TOKEN_URI_V1))
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
    it("failure: UnsupportedFunction", async () => {
      await expect(
        sbnft.connect(minter).airdropByType(holder1.address, 0)
      ).to.be.revertedWithCustomError(sbnft, "UnsupportedFunction");
    });
  });

  describe("airdropWithTokenURI", () => {
    const TOKEN_URI = "https://sbnft-metadata.world/0x0" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        sbnft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropWithTokenURI: failure: EnforcedPause
      await expect(
        sbnft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      ).to.be.revertedWithCustomError(sbnft, "EnforcedPause");
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
      expect(await sbnft.typeSupply(0)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      await expect(sbnft.holdingPeriod(0))
        .to.be.revertedWithCustomError(sbnft, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropWithTokenURI: success
      await expect(
        sbnft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.emit(sbnft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(sbnft, "MetadataUpdate")
        .withArgs(0);

      const holdingStartedAt = await utils.now();

      expect(await sbnft.balanceOf(holder1.address)).to.equal(1);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await sbnft.totalSupply()).to.equal(1);
      expect(await sbnft.tokenByIndex(0)).to.equal(0);
      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI);
      expect(await sbnft.tokenType(0)).to.equal(0);
      expect(await sbnft.typeSupply(0)).to.equal(1);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(1);
      expect(await sbnft.holdingPeriod(0)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await sbnft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
      }
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbnft
        .connect(minter)
        .airdropWithTokenURI(holder1.address, TOKEN_URI);

      // airdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        sbnft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbnft, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("bulkAirdropWithTokenURI", () => {
    const TOKEN_URI_0 = "https://sbnft-metadata.world/0x0" as const;
    const TOKEN_URI_1 = "https://sbnft-metadata.world/0x1" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(sbnft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: EnforcedPause
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      ).to.be.revertedWithCustomError(sbnft, "EnforcedPause");
    });

    it("failure: ArgumentLengthMismatch", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: ArgumentLengthMismatch
      await expect(
        sbnft.connect(minter).bulkAirdropWithTokenURI([holder1.address], [])
      ).to.be.revertedWithCustomError(sbnft, "ArgumentLengthMismatch");
    });

    it("success", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      expect(await sbnft.balanceOf(holder1.address)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(0);

      expect(await sbnft.balanceOf(holder2.address)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder2.address, 0)).to.equal(0);

      // bulkAirdropWithTokenURI: success
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropWithTokenURI(
            [holder1.address, holder2.address],
            [TOKEN_URI_0, TOKEN_URI_1]
          )
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
      expect(await sbnft.tokenURI(0)).to.equal(TOKEN_URI_0);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(1);

      expect(await sbnft.balanceOf(holder2.address)).to.equal(1);
      expect(await sbnft.ownerOf(1)).to.equal(holder2.address);
      expect(await sbnft.tokenURI(1)).to.equal(TOKEN_URI_1);
      expect(await sbnft.typeBalanceOf(holder2.address, 0)).to.equal(1);
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: success
      await sbnft
        .connect(minter)
        .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0]);

      // bulkAirdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        sbnft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(sbnft, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("safeTransferFrom", () => {
    it("failure: Soulbound", async () => {
      // unpause: success
      await sbnft.unpause();

      // addMinter: success
      await sbnft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await sbnft.connect(minter).airdropWithTokenURI(holder1.address, "");

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

      // airdropWithTokenURI: success
      await sbnft.connect(minter).airdropWithTokenURI(holder1.address, "");

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

      // airdropWithTokenURI: success
      await sbnft.connect(minter).airdropWithTokenURI(holder1.address, "");

      expect(await sbnft.balanceOf(holder1.address)).to.equal(1);
      expect(await sbnft.ownerOf(0)).to.equal(holder1.address);
      expect(await sbnft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await sbnft.totalSupply()).to.equal(1);
      expect(await sbnft.tokenByIndex(0)).to.equal(0);
      expect(await sbnft.tokenURI(0)).to.equal("");
      expect(await sbnft.tokenType(0)).to.equal(0);
      expect(await sbnft.typeSupply(0)).to.equal(1);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(1);
      expect(await sbnft.holdingPeriod(0)).to.equal(0);

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
      expect(await sbnft.typeSupply(0)).to.equal(0);
      expect(await sbnft.typeBalanceOf(holder1.address, 0)).to.equal(0);
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

      // airdropWithTokenURI: success
      await sbnft.connect(minter).airdropWithTokenURI(holder1.address, "");

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

      // airdropWithTokenURI: success
      await sbnft.connect(minter).airdropWithTokenURI(holder1.address, "");
      await sbnft.connect(minter).airdropWithTokenURI(holder2.address, "");

      // refreshMetadata: success: plural
      await expect(sbnft.refreshMetadata())
        .to.emit(sbnft, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});
