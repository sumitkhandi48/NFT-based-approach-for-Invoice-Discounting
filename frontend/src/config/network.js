const NETWORK = import.meta.env.VITE_NETWORK;

const NETWORKS = {
    ganache: {
        name: "Ganache",
        rpcUrl: import.meta.env.VITE_GANACHE_RPC_URL,
        contractAddress: import.meta.env.VITE_GANACHE_CONTRACT_ADDRESS,
        chainId: 1337,
    },

    sepolia: {
        name: "Sepolia",
        rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL,
        contractAddress: import.meta.env.VITE_SEPOLIA_CONTRACT_ADDRESS,
        chainId: 11155111,
    },
};

export default NETWORKS[NETWORK];