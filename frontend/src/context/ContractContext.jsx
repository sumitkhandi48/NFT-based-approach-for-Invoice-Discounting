import { createContext, useContext } from "react";
import { ethers } from "ethers";
import InvoiceNFTArtifact from "../InvoiceNFT.json";

const CONTRACT_ADDRESS = "0xe3c505901332ac488B29fC8dAe2427B5A9cd4f9a";
const ABI = InvoiceNFTArtifact.abi;
const GANACHE_RPC_URL = "http://127.0.0.1:8545";

const ContractContext = createContext(null);

export function ContractProvider({ children }) {
    function getReadOnlyContract() {
        const readProvider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
        return new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
    }

    function getReadOnlyProvider() {
        return new ethers.JsonRpcProvider(GANACHE_RPC_URL);
    }

    function getSignerContract(signer) {
        return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    }

    return (
        <ContractContext.Provider
            value={{ getReadOnlyContract, getReadOnlyProvider, getSignerContract, CONTRACT_ADDRESS, ABI }}
        >
            {children}
        </ContractContext.Provider>
    );
}

export function useContract() {
    return useContext(ContractContext);
}