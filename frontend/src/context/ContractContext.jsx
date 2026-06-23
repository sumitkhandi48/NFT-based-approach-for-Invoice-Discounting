import { createContext, useContext } from "react";
import { ethers } from "ethers";
import { useWallet } from "./WalletContext.jsx";
import InvoiceNFTArtifact from "../InvoiceNFT.json";

const CONTRACT_ADDRESS = "0xe3c505901332ac488B29fC8dAe2427B5A9cd4f9a";
const ABI = InvoiceNFTArtifact.abi;

const ContractContext = createContext(null);

export function ContractProvider({ children }) {
    const { provider } = useWallet();

    function getReadOnlyContract() {
        const readProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        return new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
    }

    function getSignerContract(signer) {
        return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    }

    return (
        <ContractContext.Provider value={{ getReadOnlyContract, getSignerContract, CONTRACT_ADDRESS, ABI }}>
            {children}
        </ContractContext.Provider>
    );
}

export function useContract() {
    return useContext(ContractContext);
}