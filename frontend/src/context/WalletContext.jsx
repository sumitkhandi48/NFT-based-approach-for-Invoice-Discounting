import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null);
    const [network, setNetwork] = useState(null);
    const [provider, setProvider] = useState(null);
    const [roles, setRoles] = useState({ supplier: "", buyer: "", financier: "" });

    useEffect(() => {
        async function fetchRoles() {
            let supplier = import.meta.env.VITE_SUPPLIER_ADDRESS;
            let buyer = import.meta.env.VITE_BUYER_ADDRESS;
            let financier = import.meta.env.VITE_FINANCIER_ADDRESS;

            if (!supplier || !buyer || !financier) {
                try {
                    const localProvider = new ethers.JsonRpcProvider(import.meta.env.VITE_GANACHE_RPC_URL || "http://127.0.0.1:8545");
                    const accs = await localProvider.listAccounts();
                    if (accs.length >= 3) {
                        supplier = supplier || (await accs[0].getAddress());
                        buyer = buyer || (await accs[1].getAddress());
                        financier = financier || (await accs[2].getAddress());
                    }
                } catch (e) {
                    console.warn("Could not fetch fallback accounts:", e);
                }
            }

            setRoles({
                supplier: supplier?.toLowerCase() || "",
                buyer: buyer?.toLowerCase() || "",
                financier: financier?.toLowerCase() || ""
            });
        }
        fetchRoles();
    }, []);

    async function connectWallet() {
        if (!window.ethereum) {
            alert("MetaMask is not installed. Please install it to use this DApp.");
            return;
        }

        try {
            const _provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await _provider.send("eth_requestAccounts", []);
            const _network = await _provider.getNetwork();

            setProvider(_provider);
            setAccount(accounts[0]);
            setNetwork(_network.name);
        } catch (error) {
            console.error("Wallet connection failed:", error.message);
        }
    }

    function disconnectWallet() {
        setAccount(null);
        setNetwork(null);
        setProvider(null);
    }

    // Listen for account and network changes
    useEffect(() => {
        if (!window.ethereum) return;

        window.ethereum.on("accountsChanged", (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else {
                setAccount(accounts[0]);
            }
        });

        window.ethereum.on("chainChanged", () => {
            window.location.reload();
        });

        return () => {
            window.ethereum.removeAllListeners("accountsChanged");
            window.ethereum.removeAllListeners("chainChanged");
        };
    }, []);

    return (
        <WalletContext.Provider
            value={{ account, network, provider, roles, connectWallet, disconnectWallet }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    return useContext(WalletContext);
}