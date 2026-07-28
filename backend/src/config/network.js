const NETWORK = process.env.NETWORK || "ganache";

const NETWORKS = {
    ganache: {
        name: "Ganache",
        rpcUrl: process.env.GANACHE_RPC_URL,
        contractAddress: process.env.GANACHE_CONTRACT_ADDRESS,
        chainId: 1337,
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