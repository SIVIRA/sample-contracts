import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SampleNoTypeNFT, SampleNoTypeNFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const NFT_CONTRACT_NAME = "SampleNoTypeNFT" as const;

describe(NFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60 as const;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let nftFactory: SampleNoTypeNFT__factory;
  let nft: SampleNoTypeNFT;

  before(async () => {
    [runner, minter, holder1, holder2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    nftFactory = await ethers.getContractFactory(NFT_CONTRACT_NAME);
    nft = await nftFactory.deploy();
    await nft.waitForDeployment();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await nft.owner()).to.equal(runner.address);
      expect(await nft.paused()).to.be.true;
      expect(await nft.minTokenType()).to.equal(0);
      expect(await nft.maxTokenType()).to.equal(0);
    });
  });

  describe("supportsInterface", () => {
    it("success", async () => {
      expect(await nft.supportsInterface("0x00000000")).to.be.false;
      expect(await nft.supportsInterface("0x01ffc9a7")).to.be.true; // ERC165
      expect(await nft.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await nft.supportsInterface("0x780e9d63")).to.be.true; // ERC721Enumerable
      expect(await nft.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
      expect(await nft.supportsInterface("0x2a55205a")).to.be.true; // ERC2981
      expect(await nft.supportsInterface("0x49064906")).to.be.true; // ERC4906
      expect(await nft.supportsInterface("0xad092b5c")).to.be.true; // ERC4907
    });
  });

  describe("pause, unpause", () => {
    it("all", async () => {
      // pause: failure: EnforcedPause
      await expect(nft.pause()).to.be.revertedWithCustomError(
        nft,
        "EnforcedPause"
      );

      // unpause: failure: OwnableUnauthorizedAccount
      await expect(nft.connect(minter).unpause())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // unpause: success
      await expect(nft.unpause())
        .to.emit(nft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: ExpectedPause
      await expect(nft.unpause()).to.be.revertedWithCustomError(
        nft,
        "ExpectedPause"
      );

      // pause: failure: OwnableUnauthorizedAccount
      await expect(nft.connect(minter).pause())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // pause: success
      await expect(nft.pause()).to.emit(nft, "Paused").withArgs(runner.address);
    });
  });

  describe("freezeTokenTypeRange", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(nft.connect(minter).freezeTokenTypeRange())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: TokenTypeRangeFrozen", async () => {
      await expect(nft.freezeTokenTypeRange()).to.be.revertedWithCustomError(
        nft,
        "TokenTypeRangeFrozen"
      );
    });
  });

  describe("setTokenURI, freezeTokenURI", () => {
    const TOKEN_URI_V1 = "https://nft-metadata.world/v1/0x0" as const;
    const TOKEN_URI_V2 = "https://nft-metadata.world/v2/0x0" as const;

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(nft.connect(minter).setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(nft.connect(minter).freezeTokenURI(0))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("failure: ERC721NonexistentToken", async () => {
      await expect(nft.setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);

      await expect(nft.freezeTokenURI(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("success -> failure: TokenURIFrozen", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft
        .connect(minter)
        .airdropWithTokenURI(holder1.address, TOKEN_URI_V1);

      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI_V1);

      // setTokenURI: success
      await expect(nft.setTokenURI(0, TOKEN_URI_V2))
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI_V2);

      // freezeTokenURI: success
      await expect(nft.freezeTokenURI(0))
        .to.emit(nft, "PermanentURI")
        .withArgs(TOKEN_URI_V2, 0);

      // setTokenURI: failure: TokenURIFrozen
      await expect(nft.setTokenURI(0, TOKEN_URI_V1))
        .to.be.revertedWithCustomError(nft, "TokenURIFrozen")
        .withArgs(0);

      // freezeTokenURI: failure: TokenURIFrozen
      await expect(nft.freezeTokenURI(0))
        .to.be.revertedWithCustomError(nft, "TokenURIFrozen")
        .withArgs(0);
    });
  });

  describe("airdrop", () => {
    it("failure: UnsupportedFunction", async () => {
      await expect(
        nft.connect(minter).airdrop(holder1.address)
      ).to.be.revertedWithCustomError(nft, "UnsupportedFunction");
    });
  });

  describe("airdropByType", () => {
    it("failure: UnsupportedFunction", async () => {
      await expect(
        nft.connect(minter).airdropByType(holder1.address, 0)
      ).to.be.revertedWithCustomError(nft, "UnsupportedFunction");
    });
  });

  describe("airdropWithTokenURI", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        nft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(nft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: failure: EnforcedPause
      await expect(
        nft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      ).to.be.revertedWithCustomError(nft, "EnforcedPause");
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      expect(await nft.balanceOf(holder1.address)).to.equal(0);
      await expect(nft.ownerOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await nft.totalSupply()).to.equal(0);
      await expect(nft.tokenByIndex(0))
        .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(nft.tokenURI(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.tokenType(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await nft.typeSupply(0)).to.equal(0);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      await expect(nft.firstOwnerOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.holdingPeriod(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.royaltyInfo(0, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userExpires(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropWithTokenURI: success
      await expect(
        nft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      const holdingStartedAt = await utils.now();

      expect(await nft.balanceOf(holder1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(holder1.address);
      expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
      expect(await nft.totalSupply()).to.equal(1);
      expect(await nft.tokenByIndex(0)).to.equal(0);
      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
      expect(await nft.tokenType(0)).to.equal(0);
      expect(await nft.typeSupply(0)).to.equal(1);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);
      expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
      expect(await nft.holdingPeriod(0)).to.equal(0);
      {
        const [receiver, amount] = await nft.royaltyInfo(
          0,
          ethers.parseEther("1")
        );
        expect(receiver).to.equal(runner.address);
        expect(amount).to.equal(0);
      }
      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(0);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await nft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
      }
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI);

      // airdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        nft.connect(minter).airdropWithTokenURI(holder1.address, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(nft, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("bulkAirdropWithTokenURI", () => {
    const TOKEN_URI_0 = "https://nft-metadata.world/0x0" as const;
    const TOKEN_URI_1 = "https://nft-metadata.world/0x1" as const;

    it("failure: InvalidMinter", async () => {
      await expect(
        nft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(nft, "InvalidMinter")
        .withArgs(minter.address);
    });

    it("failure: EnforcedPause", async () => {
      // addMinter: success
      await nft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: EnforcedPause
      await expect(
        nft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      ).to.be.revertedWithCustomError(nft, "EnforcedPause");
    });

    it("failure: ArgumentLengthMismatch", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: failure: ArgumentLengthMismatch
      await expect(
        nft.connect(minter).bulkAirdropWithTokenURI([holder1.address], [])
      ).to.be.revertedWithCustomError(nft, "ArgumentLengthMismatch");
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      expect(await nft.balanceOf(holder1.address)).to.equal(0);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);

      expect(await nft.balanceOf(holder2.address)).to.equal(0);
      expect(await nft.typeBalanceOf(holder2.address, 0)).to.equal(0);

      // bulkAirdropWithTokenURI: success
      await expect(
        nft
          .connect(minter)
          .bulkAirdropWithTokenURI(
            [holder1.address, holder2.address],
            [TOKEN_URI_0, TOKEN_URI_1]
          )
      )
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder1.address, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0)
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, holder2.address, 1)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(1);

      expect(await nft.balanceOf(holder1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(holder1.address);
      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI_0);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);

      expect(await nft.balanceOf(holder2.address)).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(holder2.address);
      expect(await nft.tokenURI(1)).to.equal(TOKEN_URI_1);
      expect(await nft.typeBalanceOf(holder2.address, 0)).to.equal(1);
    });

    it("success -> failure: AlreadyAirdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // bulkAirdropWithTokenURI: success
      await nft
        .connect(minter)
        .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0]);

      // bulkAirdropWithTokenURI: failure: AlreadyAirdropped
      await expect(
        nft
          .connect(minter)
          .bulkAirdropWithTokenURI([holder1.address], [TOKEN_URI_0])
      )
        .to.be.revertedWithCustomError(nft, "AlreadyAirdropped")
        .withArgs(holder1.address);
    });
  });

  describe("safeTransferFrom", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("success: from holder1 to holder2", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      const holdingStartedAt = await utils.now();
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2;

      // setTokenURI: success
      await nft.setTokenURI(0, TOKEN_URI);

      // setUser: success
      await nft.connect(holder1).setUser(0, holder2.address, userExpiredAt);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await nft.balanceOf(holder1.address)).to.equal(1);
        expect(await nft.balanceOf(holder2.address)).to.equal(0);
        expect(await nft.ownerOf(0)).to.equal(holder1.address);
        expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        await expect(nft.tokenOfOwnerByIndex(holder2.address, 0))
          .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
          .withArgs(holder2.address, 0);
        expect(await nft.totalSupply()).to.equal(1);
        expect(await nft.tokenByIndex(0)).to.equal(0);
        expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
        expect(await nft.tokenType(0)).to.equal(0);
        expect(await nft.typeSupply(0)).to.equal(1);
        expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);
        expect(await nft.typeBalanceOf(holder2.address, 0)).to.equal(0);
        expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
        expect(await nft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
        {
          const [receiver, amount] = await nft.royaltyInfo(
            0,
            ethers.parseEther("1")
          );
          expect(receiver).to.equal(runner.address);
          expect(amount).to.equal(0);
        }
        expect(await nft.userOf(0)).to.equal(holder2.address);
        expect(await nft.userExpires(0)).to.equal(userExpiredAt);
      }

      // safeTransferFrom: success
      await expect(
        nft
          .connect(holder1)
          ["safeTransferFrom(address,address,uint256)"](
            holder1.address,
            holder2.address,
            0
          )
      )
        .to.emit(nft, "Transfer")
        .withArgs(holder1.address, holder2.address, 0)
        .to.emit(nft, "UpdateUser")
        .withArgs(0, ethers.ZeroAddress, 0);

      expect(await nft.balanceOf(holder1.address)).to.equal(0);
      expect(await nft.balanceOf(holder2.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(holder2.address);
      await expect(nft.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await nft.tokenOfOwnerByIndex(holder2.address, 0)).to.equal(0);
      expect(await nft.totalSupply()).to.equal(1);
      expect(await nft.tokenByIndex(0)).to.equal(0);
      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
      expect(await nft.tokenType(0)).to.equal(0);
      expect(await nft.typeSupply(0)).to.equal(1);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      expect(await nft.typeBalanceOf(holder2.address, 0)).to.equal(1);
      expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
      expect(await nft.holdingPeriod(0)).to.equal(0);
      {
        const [receiver, amount] = await nft.royaltyInfo(
          0,
          ethers.parseEther("1")
        );
        expect(receiver).to.equal(runner.address);
        expect(amount).to.equal(0);
      }
      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(0);
    });

    it("success: from holder1 to holder1", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      const holdingStartedAt = await utils.now();
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2;

      // setTokenURI: success
      await nft.setTokenURI(0, TOKEN_URI);

      // setUser: success
      await nft.connect(holder1).setUser(0, holder2.address, userExpiredAt);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await nft.balanceOf(holder1.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(holder1.address);
        expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        expect(await nft.totalSupply()).to.equal(1);
        expect(await nft.tokenByIndex(0)).to.equal(0);
        expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
        expect(await nft.tokenType(0)).to.equal(0);
        expect(await nft.typeSupply(0)).to.equal(1);
        expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);
        expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
        expect(await nft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
        {
          const [receiver, amount] = await nft.royaltyInfo(
            0,
            ethers.parseEther("1")
          );
          expect(receiver).to.equal(runner.address);
          expect(amount).to.equal(0);
        }
        expect(await nft.userOf(0)).to.equal(holder2.address);
        expect(await nft.userExpires(0)).to.equal(userExpiredAt);
      }

      // safeTransferFrom: success
      await expect(
        nft
          .connect(holder1)
          ["safeTransferFrom(address,address,uint256)"](
            holder1.address,
            holder1.address,
            0
          )
      )
        .to.emit(nft, "Transfer")
        .withArgs(holder1.address, holder1.address, 0);

      {
        const now = await utils.now();

        expect(await nft.balanceOf(holder1.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(holder1.address);
        expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        expect(await nft.totalSupply()).to.equal(1);
        expect(await nft.tokenByIndex(0)).to.equal(0);
        expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
        expect(await nft.tokenType(0)).to.equal(0);
        expect(await nft.typeSupply(0)).to.equal(1);
        expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);
        expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
        expect(await nft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
        {
          const [receiver, amount] = await nft.royaltyInfo(
            0,
            ethers.parseEther("1")
          );
          expect(receiver).to.equal(runner.address);
          expect(amount).to.equal(0);
        }
        expect(await nft.userOf(0)).to.equal(holder2.address);
        expect(await nft.userExpires(0)).to.equal(userExpiredAt);
      }
    });
  });

  describe("burn", () => {
    const TOKEN_URI = "https://nft-metadata.world/0x0" as const;

    it("failure: ERC721NonexistentToken", async () => {
      await expect(nft.burn(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      // burn: failure: ERC721InsufficientApproval
      await expect(nft.burn(0))
        .to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval")
        .withArgs(runner.address, 0);
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      const holdingStartedAt = await utils.now();
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2;

      // setTokenURI: success
      await nft.setTokenURI(0, TOKEN_URI);

      // setUser: success
      await nft.connect(holder1).setUser(0, holder2.address, userExpiredAt);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await nft.balanceOf(holder1.address)).to.equal(1);
        expect(await nft.ownerOf(0)).to.equal(holder1.address);
        expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        expect(await nft.totalSupply()).to.equal(1);
        expect(await nft.tokenByIndex(0)).to.equal(0);
        expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);
        expect(await nft.tokenType(0)).to.equal(0);
        expect(await nft.typeSupply(0)).to.equal(1);
        expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);
        expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
        expect(await nft.holdingPeriod(0)).to.equal(now - holdingStartedAt);
        {
          const [receiver, amount] = await nft.royaltyInfo(
            0,
            ethers.parseEther("1")
          );
          expect(receiver).to.equal(runner.address);
          expect(amount).to.equal(0);
        }
        expect(await nft.userOf(0)).to.equal(holder2.address);
        expect(await nft.userExpires(0)).to.equal(userExpiredAt);
      }

      // burn: success
      await expect(nft.connect(holder1).burn(0))
        .to.emit(nft, "Transfer")
        .withArgs(holder1.address, ethers.ZeroAddress, 0)
        .to.emit(nft, "UpdateUser")
        .withArgs(0, ethers.ZeroAddress, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      expect(await nft.balanceOf(holder1.address)).to.equal(0);
      await expect(nft.ownerOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.tokenOfOwnerByIndex(holder1.address, 0))
        .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
        .withArgs(holder1.address, 0);
      expect(await nft.totalSupply()).to.equal(0);
      await expect(nft.tokenByIndex(0))
        .to.be.revertedWithCustomError(nft, "ERC721OutOfBoundsIndex")
        .withArgs(ethers.ZeroAddress, 0);
      await expect(nft.tokenURI(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.tokenType(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      expect(await nft.typeSupply(0)).to.equal(0);
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
      await expect(nft.holdingPeriod(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.royaltyInfo(0, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userExpires(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const feeNumerator = BigInt(300);
    const feeDenominator = BigInt(10000);
    const salePrice = ethers.parseEther("1");

    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(
        nft.connect(minter).setDefaultRoyalty(minter.address, feeNumerator)
      )
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      await expect(nft.connect(minter).freezeRoyalty())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success -> failure: RoyaltyFrozen", async () => {
      // setDefaultRoyalty: success
      await nft.setDefaultRoyalty(minter.address, feeNumerator);

      await expect(nft.royaltyInfo(0, salePrice))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);

      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      {
        const [receiver, amount] = await nft.royaltyInfo(0, salePrice);
        expect(receiver).to.equal(minter.address);
        expect(amount).to.equal((salePrice * feeNumerator) / feeDenominator);
      }

      // freezeRoyalty: success
      await nft.freezeRoyalty();

      // setDefaultRoyalty: failure: RoyaltyFrozen
      await expect(
        nft.setDefaultRoyalty(minter.address, feeNumerator)
      ).to.be.revertedWithCustomError(nft, "RoyaltyFrozen");

      // freezeRoyalty: failure: RoyaltyFrozen
      await expect(nft.freezeRoyalty()).to.be.revertedWithCustomError(
        nft,
        "RoyaltyFrozen"
      );
    });
  });

  describe("setUser", () => {
    it("failure: ERC721NonexistentToken", async () => {
      await expect(
        nft.setUser(0, holder2.address, (await utils.now()) + DUMMY_PERIOD)
      )
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
    });

    it("failure: ERC721InsufficientApproval", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      // setUser: failure: ERC721InsufficientApproval
      await expect(
        nft.setUser(0, holder2.address, (await utils.now()) + DUMMY_PERIOD)
      )
        .to.be.revertedWithCustomError(nft, "ERC721InsufficientApproval")
        .withArgs(runner.address, 0);
    });

    it("success: by owner", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      await expect(nft.userOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userExpires(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(0);

      const userExpiredAt = (await utils.now()) + DUMMY_PERIOD;

      // setUser: success: by owner
      await expect(
        nft.connect(holder1).setUser(0, holder2.address, userExpiredAt)
      )
        .to.emit(nft, "UpdateUser")
        .withArgs(0, holder2.address, userExpiredAt);

      expect(await nft.userOf(0)).to.equal(holder2.address);
      expect(await nft.userExpires(0)).to.equal(userExpiredAt);

      // time passed
      await helpers.time.increase(DUMMY_PERIOD);

      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(userExpiredAt);
    });

    it("success: by approved account", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      await expect(nft.userOf(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);
      await expect(nft.userExpires(0))
        .to.be.revertedWithCustomError(nft, "ERC721NonexistentToken")
        .withArgs(0);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      // approve: success
      await nft.connect(holder1).approve(holder2.address, 0);

      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(0);

      const userExpiredAt = (await utils.now()) + DUMMY_PERIOD;

      // setUser: success: by approved account
      await expect(
        nft.connect(holder2).setUser(0, holder2.address, userExpiredAt)
      )
        .to.emit(nft, "UpdateUser")
        .withArgs(0, holder2.address, userExpiredAt);

      expect(await nft.userOf(0)).to.equal(holder2.address);
      expect(await nft.userExpires(0)).to.equal(userExpiredAt);

      // time passed
      await helpers.time.increase(DUMMY_PERIOD);

      expect(await nft.userOf(0)).to.equal(ethers.ZeroAddress);
      expect(await nft.userExpires(0)).to.equal(userExpiredAt);
    });
  });

  describe("addMinter, removeMinter, freezeMinters", () => {
    it("all", async () => {
      expect(await nft.isMinter(minter.address)).to.be.false;

      // freezeMinters: failure: OwnableUnauthorizedAccount
      await expect(nft.connect(minter).freezeMinters())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: OwnableUnauthorizedAccount
      await expect(nft.connect(minter).addMinter(minter.address))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // addMinter: failure: InvalidMinter
      await expect(nft.addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(nft, "InvalidMinter")
        .withArgs(ethers.ZeroAddress);

      // removeMinter: failure: InvalidMinter
      await expect(nft.removeMinter(minter.address))
        .to.be.revertedWithCustomError(nft, "InvalidMinter")
        .withArgs(minter.address);

      // addMinter: success
      await expect(nft.addMinter(minter.address))
        .to.emit(nft, "MinterAdded")
        .withArgs(minter.address);

      expect(await nft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: MinterAlreadyAdded
      await expect(nft.addMinter(minter.address))
        .to.be.revertedWithCustomError(nft, "MinterAlreadyAdded")
        .withArgs(minter.address);

      // removeMinter: failure: OwnableUnauthorizedAccount
      await expect(nft.connect(minter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);

      // removeMinter: success
      await expect(nft.removeMinter(minter.address))
        .to.emit(nft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await nft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await nft.freezeMinters();

      // addMinters: failure: MintersFrozen
      await expect(nft.addMinter(minter.address)).to.be.revertedWithCustomError(
        nft,
        "MintersFrozen"
      );

      // removeMinters: failure: MintersFrozen
      await expect(
        nft.removeMinter(minter.address)
      ).to.be.revertedWithCustomError(nft, "MintersFrozen");

      // freezeMinters: failure: MintersFrozen
      await expect(nft.freezeMinters()).to.be.revertedWithCustomError(
        nft,
        "MintersFrozen"
      );
    });
  });

  describe("refreshMetadata", () => {
    it("failure: OwnableUnauthorizedAccount", async () => {
      await expect(nft.connect(minter).refreshMetadata())
        .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount")
        .withArgs(minter.address);
    });

    it("success: single", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");

      // refreshMetadata: success: single
      await expect(nft.refreshMetadata())
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);
    });

    it("success: plural", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdropWithTokenURI: success
      await nft.connect(minter).airdropWithTokenURI(holder1.address, "");
      await nft.connect(minter).airdropWithTokenURI(holder2.address, "");

      // refreshMetadata: success: plural
      await expect(nft.refreshMetadata())
        .to.emit(nft, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});
