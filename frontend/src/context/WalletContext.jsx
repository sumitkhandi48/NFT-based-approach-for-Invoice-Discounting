import { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null);
    const [network, setNetwork] = useState(null);
    const [provider, setProvider] = useState(null);

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
            value={{ account, network, provider, connectWallet, disconnectWallet }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    return useContext(WalletContext);
}