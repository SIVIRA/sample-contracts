import { expect } from "chai";
import { ethers } from "hardhat";

import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SingleTypeNFT, SingleTypeNFT__factory } from "../typechain-types";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import * as utils from "./utils";

const NFT_CONTRACT_NAME = "SingleTypeNFT";

describe(NFT_CONTRACT_NAME, () => {
  const DUMMY_PERIOD = 60;

  let runner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let holder1: HardhatEthersSigner;
  let holder2: HardhatEthersSigner;

  let nftFactory: SingleTypeNFT__factory;
  let nft: SingleTypeNFT;

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
      // pause: failure: paused
      await expect(nft.pause()).to.be.revertedWith("Pausable: paused");

      // unpause: failure: caller is not the owner
      await expect(nft.connect(minter).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      // unpause: success
      await expect(nft.unpause())
        .to.emit(nft, "Unpaused")
        .withArgs(runner.address);

      // unpause: failure: not paused
      await expect(nft.unpause()).to.be.revertedWith("Pausable: not paused");

      // pause: failure: caller is not the owner
      await expect(nft.connect(minter).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      // pause: success
      await expect(nft.pause()).to.emit(nft, "Paused").withArgs(runner.address);
    });
  });

  describe("setBaseTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/";

    it("failure: caller is not the owner", async () => {
      await expect(
        nft.connect(minter).setBaseTokenURI(BASE_TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("success: single", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

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
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);
      await nft.connect(minter).airdrop(holder2.address);

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

  describe("setTokenURI, freezeTokenURI", () => {
    const BASE_TOKEN_URI = "https://nft-metadata.world/";
    const TOKEN_URI = "https://nft-metadata.world/0x0";

    it("failure: caller is not the owner", async () => {
      await expect(
        nft.connect(minter).setTokenURI(0, TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(nft.connect(minter).freezeTokenURI(0)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("failure: invalid token ID", async () => {
      await expect(nft.setTokenURI(0, TOKEN_URI)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      await expect(nft.freezeTokenURI(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });

    it("success -> failure: token URI frozen", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      // setBaseTokenURI: success
      await nft.setBaseTokenURI(BASE_TOKEN_URI);

      expect(await nft.tokenURI(0)).to.equal(BASE_TOKEN_URI + "0/0");

      // setTokenURI: success
      await expect(nft.setTokenURI(0, TOKEN_URI))
        .to.emit(nft, "MetadataUpdate")
        .withArgs(0);

      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);

      // freezeTokenURI: success
      await expect(nft.freezeTokenURI(0))
        .to.emit(nft, "PermanentURI")
        .withArgs(TOKEN_URI, 0);

      expect(await nft.tokenURI(0)).to.equal(TOKEN_URI);

      // setTokenURI: failure: token URI frozen
      await expect(nft.setTokenURI(0, TOKEN_URI)).to.be.revertedWith(
        "BaseNFT: token URI frozen"
      );

      // freezeTokenURI: failure: token URI frozen
      await expect(nft.freezeTokenURI(0)).to.be.revertedWith(
        "BaseNFT: token URI frozen"
      );
    });
  });

  describe("airdrop", () => {
    it("failure: caller is not a minter", async () => {
      await expect(
        nft.connect(minter).airdrop(holder1.address)
      ).to.be.revertedWith("BaseNFT: caller is not a minter");
    });

    it("failure: paused", async () => {
      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: failure: paused
      await expect(
        nft.connect(minter).airdrop(holder1.address)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      expect(await nft.balanceOf(holder1.address)).to.equal(0);
      await expect(nft.ownerOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.tokenOfOwnerByIndex(holder1.address, 0)
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
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      await expect(nft.firstOwnerOf(0)).to.be.revertedWith(
        "BaseNFT: invalid token ID"
      );
      await expect(nft.holdingPeriod(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.royaltyInfo(0, ethers.parseEther("1"))
      ).to.be.revertedWith("ERC721: invalid token ID");
      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // airdrop: success
      await expect(nft.connect(minter).airdrop(holder1.address))
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
      expect(await nft.tokenURI(0)).to.equal("");
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

    it("success -> failure: already airdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      // airdrop: failure: already airdropped
      await expect(
        nft.connect(minter).airdrop(holder1.address)
      ).to.be.revertedWith("STNFT: already airdropped");
    });
  });

  describe("bulkAirdrop", () => {
    it("failure: caller is not a minter", async () => {
      await expect(
        nft.connect(minter).bulkAirdrop([holder1.address])
      ).to.be.revertedWith("BaseNFT: caller is not a minter");
    });

    it("failure: paused", async () => {
      // addMinter: success
      await nft.addMinter(minter.address);

      // bulkAirdrop: failure: paused
      await expect(
        nft.connect(minter).bulkAirdrop([holder1.address])
      ).to.be.revertedWith("Pausable: paused");
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

      // bulkAirdrop: success
      await expect(
        nft.connect(minter).bulkAirdrop([holder1.address, holder2.address])
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
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(1);

      expect(await nft.balanceOf(holder2.address)).to.equal(1);
      expect(await nft.ownerOf(1)).to.equal(holder2.address);
      expect(await nft.typeBalanceOf(holder2.address, 0)).to.equal(1);
    });

    it("success -> failure: already airdropped", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // bulkAirdrop: success
      await nft.connect(minter).bulkAirdrop([holder1.address]);

      // bulkAirdrop: failure: already airdropped
      await expect(
        nft.connect(minter).bulkAirdrop([holder1.address])
      ).to.be.revertedWith("STNFT: already airdropped");
    });
  });

  describe("safeTransferFrom", () => {
    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      const holdingStartedAt = await utils.now();
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2;

      // setUser: success
      await nft.connect(holder1).setUser(0, holder2.address, userExpiredAt);

      // time passed
      {
        const now = await helpers.time.increase(DUMMY_PERIOD);

        expect(await nft.balanceOf(holder1.address)).to.equal(1);
        expect(await nft.balanceOf(holder2.address)).to.equal(0);
        expect(await nft.ownerOf(0)).to.equal(holder1.address);
        expect(await nft.tokenOfOwnerByIndex(holder1.address, 0)).to.equal(0);
        await expect(
          nft.tokenOfOwnerByIndex(holder2.address, 0)
        ).to.be.revertedWith("ERC721Enumerable: owner index out of bounds");
        expect(await nft.totalSupply()).to.equal(1);
        expect(await nft.tokenByIndex(0)).to.equal(0);
        expect(await nft.tokenURI(0)).to.equal("");
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
      await expect(
        nft.tokenOfOwnerByIndex(holder1.address, 0)
      ).to.be.revertedWith("ERC721Enumerable: owner index out of bounds");
      expect(await nft.tokenOfOwnerByIndex(holder2.address, 0)).to.equal(0);
      expect(await nft.totalSupply()).to.equal(1);
      expect(await nft.tokenByIndex(0)).to.equal(0);
      expect(await nft.tokenURI(0)).to.equal("");
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
  });

  describe("burn", () => {
    it("failure: invalid token ID", async () => {
      await expect(nft.burn(0)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("failure: caller is not token owner nor approved", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      // burn: failure: caller is not token owner nor approved
      await expect(nft.burn(0)).to.be.revertedWith(
        "BaseNFT: caller is not token owner nor approved"
      );
    });

    it("success", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      const holdingStartedAt = await utils.now();
      const userExpiredAt = holdingStartedAt + DUMMY_PERIOD * 2;

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
        expect(await nft.tokenURI(0)).to.equal("");
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
      await expect(nft.ownerOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.tokenOfOwnerByIndex(holder1.address, 0)
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
      expect(await nft.typeBalanceOf(holder1.address, 0)).to.equal(0);
      expect(await nft.firstOwnerOf(0)).to.equal(holder1.address);
      await expect(nft.holdingPeriod(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(
        nft.royaltyInfo(0, ethers.parseEther("1"))
      ).to.be.revertedWith("ERC721: invalid token ID");
      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
    });
  });

  describe("setDefaultRoyalty, freezeRoyalty", () => {
    const FEE_NUMERATOR = BigInt(300);
    const FEE_DENOMINAGOR = BigInt(10000);
    const SALE_PRICE = ethers.parseEther("1");

    it("failure: caller is not the owner", async () => {
      await expect(
        nft.connect(minter).setDefaultRoyalty(minter.address, FEE_NUMERATOR)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(nft.connect(minter).freezeRoyalty()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("success -> failure: royalty frozen", async () => {
      // setDefaultRoyalty: success
      await nft.setDefaultRoyalty(minter.address, FEE_NUMERATOR);

      await expect(nft.royaltyInfo(0, SALE_PRICE)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      {
        const [receiver, amount] = await nft.royaltyInfo(0, SALE_PRICE);
        expect(receiver).to.equal(minter.address);
        expect(amount).to.equal((SALE_PRICE * FEE_NUMERATOR) / FEE_DENOMINAGOR);
      }

      // freezeRoyalty: success
      await nft.freezeRoyalty();

      // freezeRoyalty: failure: royalty frozen
      await expect(nft.freezeRoyalty()).to.be.revertedWith(
        "BaseNFT: royalty frozen"
      );
    });
  });

  describe("setUser", () => {
    it("failure: invalid token ID", async () => {
      await expect(
        nft.setUser(0, holder2.address, (await utils.now()) + DUMMY_PERIOD)
      ).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("failure: caller is not token owner nor approved", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

      // setUser: failure: caller is not token owner nor approved
      await expect(
        nft.setUser(0, holder2.address, (await utils.now()) + DUMMY_PERIOD)
      ).to.be.revertedWith("BaseNFT: caller is not token owner nor approved");
    });

    it("success: by owner", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

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

      await expect(nft.userOf(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );
      await expect(nft.userExpires(0)).to.be.revertedWith(
        "ERC721: invalid token ID"
      );

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

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

      // freezeMinters: failure: caller is not the owner
      await expect(nft.connect(minter).freezeMinters()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      // addMinter: failure: caller is not the owner
      await expect(
        nft.connect(minter).addMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // addMinter: failure: new minter is the zero address
      await expect(nft.addMinter(ethers.ZeroAddress)).to.be.revertedWith(
        "BaseNFT: new minter is the zero address"
      );

      // removeMinter: failure: already removed
      await expect(nft.removeMinter(minter.address)).to.be.revertedWith(
        "BaseNFT: already removed"
      );

      // addMinter: success
      await expect(nft.addMinter(minter.address))
        .to.emit(nft, "MinterAdded")
        .withArgs(minter.address);

      expect(await nft.isMinter(minter.address)).to.be.true;

      // addMinter: failure: already added
      await expect(nft.addMinter(minter.address)).to.be.revertedWith(
        "BaseNFT: already added"
      );

      // removeMinter: failure: caller is not the owner
      await expect(
        nft.connect(minter).removeMinter(minter.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // removeMinter: success
      await expect(nft.removeMinter(minter.address))
        .to.emit(nft, "MinterRemoved")
        .withArgs(minter.address);

      expect(await nft.isMinter(minter.address)).to.be.false;

      // freezeMinters: success
      await nft.freezeMinters();

      // addMinters: failure: minters frozen
      await expect(nft.addMinter(minter.address)).to.be.revertedWith(
        "BaseNFT: minters frozen"
      );

      // removeMinters: failure: minters frozen
      await expect(nft.removeMinter(minter.address)).to.be.revertedWith(
        "BaseNFT: minters frozen"
      );

      // freezeMinters: failure: minters frozen
      await expect(nft.freezeMinters()).to.be.revertedWith(
        "BaseNFT: minters frozen"
      );
    });
  });

  describe("refreshMetadata", () => {
    it("failure: caller is not the owner", async () => {
      await expect(nft.connect(minter).refreshMetadata()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("success: single", async () => {
      // unpause: success
      await nft.unpause();

      // addMinter: success
      await nft.addMinter(minter.address);

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);

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

      // airdrop: success
      await nft.connect(minter).airdrop(holder1.address);
      await nft.connect(minter).airdrop(holder2.address);

      // refreshMetadata: success: plural
      await expect(nft.refreshMetadata())
        .to.emit(nft, "BatchMetadataUpdate")
        .withArgs(0, 1);
    });
  });
});
