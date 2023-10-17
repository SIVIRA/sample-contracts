import { ethers } from "hardhat";

const CONTRACT_NAME = "MultipleTypeNFT";

(async () => {
  const factory = await ethers.getContractFactory(CONTRACT_NAME);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  console.log(await contract.getAddress());
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
