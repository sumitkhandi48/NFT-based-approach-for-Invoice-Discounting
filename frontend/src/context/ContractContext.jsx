import { createContext, useContext } from "react";
import { ethers } from "ethers";
import InvoiceNFTArtifact from "../InvoiceNFT.json";
import NETWORK from "../config/network";

const CONTRACT_ADDRESS = NETWORK.contractAddress;
const ABI = InvoiceNFTArtifact.abi;
const RPC_URL =
    NETWORK.rpcUrl;

const ContractContext = createContext(null);

export function ContractProvider({ children }) {
    function getReadOnlyContract() {
        const readProvider = new ethers.JsonRpcProvider(RPC_URL);
        return new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
    }

    function getReadOnlyProvider() {
        return new ethers.JsonRpcProvider(RPC_URL);
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