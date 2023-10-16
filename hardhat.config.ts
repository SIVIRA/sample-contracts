import { HardhatUserConfig, task } from "hardhat/config";

import "@nomicfoundation/hardhat-toolbox";

const privkey = process.env.PRIVATE_KEY;
const accounts = privkey !== undefined ? [privkey] : [];

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
