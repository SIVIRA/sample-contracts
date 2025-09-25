import type { HardhatUserConfig } from "hardhat/config";
import type { NetworksUserConfig } from "hardhat/types";

import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import hardhatIgnitionViemPlugin from "@nomicfoundation/hardhat-ignition-viem";

const networks: NetworksUserConfig = {
  hardhatMainnet: {
    url: "http://127.0.0.1:8546/",
    type: "http",
    chainType: "l1",
    chainId: 31337,
  },
  hardhatOp: {
    url: "http://127.0.0.1:8545/",
    type: "http",
    chainType: "op",
    chainId: 31338,
  },
};
if (
  process.env.NETWORK !== undefined &&
  process.env.RPC_URL !== undefined &&
  process.env.PRIVATE_KEY !== undefined &&
  process.env.TYPE !== undefined &&
  process.env.CHAIN_TYPE !== undefined
) {
  networks[process.env.NETWORK] = {
    type: process.env.TYPE,
    chainType: process.env.CHAIN_TYPE,
    url: process.env.RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
  };
}

const config: HardhatUserConfig = {
  plugins: [
    // hardhatToolboxMochaEthers,
    hardhatNetworkHelpers,
    hardhatViem,
    hardhatViemAssertions,
    hardhatIgnitionViemPlugin,
  ],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
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
