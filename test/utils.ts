import { ethers } from "hardhat";

export async function now(): Promise<number> {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
}
