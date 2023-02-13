import { HardhatUserConfig, task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";

const privkey = process.env.PRIVATE_KEY;
const accounts = privkey !== undefined ? [privkey] : [];

task("accounts").setAction(async (_, hre: HardhatRuntimeEnvironment) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    polygon: {
      url: "https://polygon-mainnet.unwallet.world",
      accounts: accounts,
    },
    mumbai: {
      url: "https://polygon-testnet.unwallet.world",
      accounts: accounts,
    },
  },
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
