import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  paths: {
    tests: {
      mocha: "./test",
    },
  },
  networks: {
    ganache: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
  },
});