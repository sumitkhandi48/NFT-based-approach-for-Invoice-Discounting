import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    ganache: {
      type: "http",
      url: "http://127.0.0.1:7545",
      chainId: 1337,
    },
  },
});
