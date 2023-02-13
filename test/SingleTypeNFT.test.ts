import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SingleTypeNFT, SingleTypeNFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const NFT_CONTRACT_NAME = "SingleTypeNFT";

describe(NFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60;

  let now: number;

  let owner: SignerWithAddress;
  let other1: SignerWithAddress;
  let other2: SignerWithAddress;

  let nftFactory: SingleTypeNFT__factory;
  let nft: SingleTypeNFT;

  before(async () => {
    [owner, other1, other2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    nftFactory = await ethers.getContractFactory(NFT_CONTRACT_NAME);
    nft = await nftFactory.deploy();
    await nft.deployed();
  });

  describe("initial state", () => {
    it("success", async () => {
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.paused()).to.be.true;
    });
  });

  describe("setBaseTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/";

    it("failure: caller is not the owner", async () => {
      await expect(
        nft.connect(other1).setBaseTokenURI(BASE_TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("success: single", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);

      expect(await nft.tokenURI(0)).to.equal("");

      // setBaseTokenURI: success: single
      await expect(nft.setBaseTokenURI(BASE_TOKEN_URI))
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      expect(await nft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "0/0");
    });

    it("success: plural", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);
      await nft.airdrop(other2.address);

      expect(await nft.tokenURI(0)).to.equal("");
      expect(await nft.tokenURI(1)).to.equal("");

      // setBaseTokenURI: success: plural
      await expect(nft.setBaseTokenURI(BASE_TOKEN_URI))
        .to.emit(nft, "BatchMetadataUpdate")
        .withArgs(0, 1);

      expect(await nft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "0/0");
      expect(await nft.tokenURI(1)).to.equal(BASE_TOKEN_URI + "0/1");
    });
  });

  describe("airdrop", () => {
    const SALE_PRICE = ethers.utils.parseEther("1");

    it("failure: caller is not the minter", async () => {
      await expect(nft.airdrop(other1.address)).to.be.revertedWith(
        "BaseNFT: caller is not a minter"
      );
    });

    it("failure: paused", async () => {
      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: failure: paused
      await expect(nft.airdrop(other1.address)).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      expect(await nft.balanceOf(other1.address)).to.equal(0);
      await expect(nft.ownerOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.tokenOfOwnerByIndex(other1.address, 0)
      ).to.be.revertedWith("ERC721Enumerable: owner index out of bounds");
      expect(await nft.totalSupply()).to.equal(0);
      await expect(nft.tokenByIndex(0)).to.be.revertedWith(
        "ERC721Enumerable: global index out of bounds"
      );
      await expect(nft.tokenURI(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.tokenType(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await nft.typeSupply(0)).to.equal(0);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(0);
      await expect(nft.firstOwnerOf(0)).to.be.revertedWith(
        "BaseNFT: invalid token ID"
      );
      await expect(nft.holdingPeriod(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.royaltyInfo(0, SALE_PRICE)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.rejectedWith(
        "ERC721: invalid token ID"
      );

      // airdrop: success
      await expect(nft.airdrop(other1.address))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.constants.AddressZero, other1.address, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      const holdingStarted = await utils.now();

      expect(await nft.balanceOf(other1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(other1.address);
      expect(await nft.tokenOfOwnerByIndex(other1.address, 0)).to.equal(0);
      expect(await nft.totalSupply()).to.equal(1);
      expect(await nft.tokenByIndex(0)).to.equal(0);
      expect(await nft.tokenURI(0)).to.equal("");
      expect(await nft.tokenType(0)).to.equal(0);
      expect(await nft.typeSupply(0)).to.equal(1);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(1);
      expect(await nft.firstOwnerOf(0)).to.equal(other1.address);
      expect(await nft.holdingPeriod(0)).to.equal(0);
      {
        const [receiver, amount] = await nft.royaltyInfo(0, SALE_PRICE);
        expect(receiver).to.equal(owner.address);
        expect(amount).to.equal(0);
      }
      expect(await nft.userOf(0)).to.equal(ethers.constants.AddressZero);
      expect(await nft.userExpires(0)).to.equal(0);

      // time passed
      now = await helpers.time.increase(DUMMY_PERIOD);

      expect(await nft.holdingPeriod(0)).to.equal(now - holdingStarted);
    });

    it("success -> failure: already airdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);

      // airdrop: failure: already airdropped
      await expect(nft.airdrop(other1.address)).to.be.revertedWith(
        "STNFT: already airdropped"
      );
    });
  });

  describe("bulkAirdrop", () => {
    it("failure: caller is not the minter", async () => {
      await expect(nft.bulkAirdrop([other1.address])).to.be.revertedWith(
        "BaseNFT: caller is not a minter"
      );
    });

    it("failure: paused", async () => {
      // addMinter: success
      await nft.addMinter(owner.address);

      // bulkAirdrop: failure: paused
      await expect(nft.bulkAirdrop([other1.address])).to.be.revertedWith(
        "Pausable: paused"
      );
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      expect(await nft.balanceOf(other1.address)).to.equal(0);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(0);

      expect(await nft.balanceOf(other2.address)).to.equal(0);
      expect(await nft.typeBalanceOf(other2.address, 0)).to.equal(0);

      // bulkAirdrop: success
      await expect(nft.bulkAirdrop([other1.address, other2.address]))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.constants.AddressZero, other1.address, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0)
        .to.emit(nft, "Transfer")
        .withArgs(ethers.constants.AddressZero, other2.address, 1)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(1);

      expect(await nft.balanceOf(other1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(other1.address);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(1);

      expect(await nft.balanceOf(other2.address)).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(other2.address);
      expect(await nft.typeBalanceOf(other2.address, 0)).to.equal(1);
    });

    it("success -> failure: already airdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // bulkAirdrop: success
      await nft.bulkAirdrop([other1.address]);

      // bulkAirdrop: failure: already airdropped
      await expect(nft.bulkAirdrop([other1.address])).to.be.revertedWith(
        "STNFT: already airdropped"
      );
    });
  });

  describe("burn", () => {
    const SALE_PRICE = ethers.utils.parseEther("1");

    it("failure: invalid token ID", async () => {
      await expect(nft.burn(0)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("failure: caller is not token owner nor approved", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);

      // burn: failure: caller is not token owner nor approved
      await expect(nft.burn(0)).to.be.revertedWith(
        "BaseNFT: caller is not token owner nor approved"
      );
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);

      const holdingStarted = await utils.now();
      const expires = holdingStarted + DUMMY_PERIOD * 2;

      // setUser: success
      await nft.connect(other1).setUser(0, other2.address, expires);

      // time passed
      now = await helpers.time.increase(DUMMY_PERIOD);

      expect(await nft.balanceOf(other1.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(other1.address);
      expect(await nft.tokenOfOwnerByIndex(other1.address, 0)).to.equal(0);
      expect(await nft.totalSupply()).to.equal(1);
      expect(await nft.tokenByIndex(0)).to.equal(0);
      expect(await nft.tokenURI(0)).to.equal("");
      expect(await nft.tokenType(0)).to.equal(0);
      expect(await nft.typeSupply(0)).to.equal(1);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(1);
      expect(await nft.firstOwnerOf(0)).to.equal(other1.address);
      expect(await nft.holdingPeriod(0)).to.equal(now - holdingStarted);
      {
        const [receiver, amount] = await nft.royaltyInfo(0, SALE_PRICE);
        expect(receiver).to.equal(owner.address);
        expect(amount).to.equal(0);
      }
      expect(await nft.userOf(0)).to.equal(other2.address);
      expect(await nft.userExpires(0)).to.equal(expires);

      // burn: success
      await expect(nft.connect(other1).burn(0))
        .to.emit(nft, "Transfer")
        .withArgs(other1.address, ethers.constants.AddressZero, 0)
        .to.emit(nft, "UpdateUser")
        .withArgs(0, ethers.constants.AddressZero, 0)
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      now = await utils.now();

      expect(await nft.balanceOf(other1.address)).to.equal(0);
      await expect(nft.ownerOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.tokenOfOwnerByIndex(other1.address, 0)
      ).to.be.revertedWith("ERC721Enumerable: owner index out of bounds");
      expect(await nft.totalSupply()).to.equal(0);
      await expect(nft.tokenByIndex(0)).to.be.revertedWith(
        "ERC721Enumerable: global index out of bounds"
      );
      await expect(nft.tokenURI(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.tokenType(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      expect(await nft.typeSupply(0)).to.equal(0);
      expect(await nft.typeBalanceOf(other1.address, 0)).to.equal(0);
      expect(await nft.firstOwnerOf(0)).to.equal(other1.address);
      await expect(nft.holdingPeriod(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.royaltyInfo(0, SALE_PRICE)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.rejectedWith(
        "ERC721: invalid token ID"
      );
    });
  });

  describe("refreshMetadata", () => {
    it("failure: caller is not the owner", async () => {
      await expect(nft.connect(other1).refreshMetadata()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("success: single", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);

      // refreshMetadata: success: single
      await expect(nft.refreshMetadata())
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);
    });

    it("success: plural", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(owner.address);

      // airdrop: success
      await nft.airdrop(other1.address);
      await nft.airdrop(other2.address);

      // refreshMetadata: success: plural
      await expect(nft.refreshMetadata())
        .to.emit(nft, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});