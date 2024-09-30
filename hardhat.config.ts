import { HardhatUserConfig } from "hardhat/config";
import { NetworksUserConfig } from "hardhat/types";

import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";

const networks: NetworksUserConfig = {};
if (
  process.env.NETWORK !== undefined &&
  process.env.RPC_URL !== undefined &&
  process.env.PRIVATE_KEY !== undefined
) {
  networks[process.env.NETWORK] = {
    url: process.env.RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: networks,
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
