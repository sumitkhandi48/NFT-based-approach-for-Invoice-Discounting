const NETWORK = process.env.NETWORK || "ganache";

const NETWORKS = {
    ganache: {
        name: "Ganache",
        rpcUrl: process.env.GANACHE_RPC_URL,
        contractAddress: process.env.GANACHE_CONTRACT_ADDRESS,
        chainId: 1337,
        deployBlock: 0,  // scan from genesis; updated each redeploy
    },

    sepolia: {
        name: "Sepolia",
        rpcUrl: process.env.SEPOLIA_RPC_URL,
        contractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS,
        chainId: 11155111,
        deployBlock: 11261642,
    },
};

const ACTIVE_NETWORK = NETWORKS[NETWORK];

export { NETWORK, NETWORKS, ACTIVE_NETWORK };