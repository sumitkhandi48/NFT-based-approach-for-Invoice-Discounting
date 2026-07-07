import { ethers } from "ethers";
import { contract } from "../config/contract.js";
import { pinataConfig } from "../config/pinata.js";

export async function getInvoiceMetadata(tokenId) {
    const tokenIdNumber = Number(tokenId);
    const data = await contract.InvoiceNFT_Map(tokenIdNumber);
    const tokenURI = await contract.tokenURI(tokenIdNumber);
    const owner = await contract.ownerOf(tokenIdNumber);
    const mintEvent = await getMintEvent(tokenIdNumber);

    return {
        source: "blockchain",
        tokenId: tokenIdNumber,
        creator: data.creator,
        buyer: data.buyer,
        currentOwner: owner,
        currPrice: ethers.formatEther(data.currPrice),
        invoiceAmount: ethers.formatEther(data.invoiceAmount),
        dueDate: data.dueDate,
        isApproved: data.isApproved,
        forSale: data.forSale,
        ipfsCID: tokenURI,
        ipfsUrl: tokenURI.startsWith("http") ? tokenURI : `${pinataConfig.gateway}/${tokenURI}`,
        stage: getInvoiceStage(data, owner),
        mintTxHash: mintEvent?.transactionHash ?? null,
        mintBlock: mintEvent?.blockNumber ?? null,
    };
}

async function getMintEvent(tokenId) {
    const events = await contract.queryFilter(contract.filters.InvoiceMinted(tokenId));
    return events[0] ?? null;
}

function getInvoiceStage(data, owner) {
    const ownerLower = owner.toLowerCase();
    const creatorLower = data.creator.toLowerCase();
    const buyerLower = data.buyer.toLowerCase();

    if (!data.isApproved) {
        return "MINTED";
    }

    if (data.forSale) {
        return "LISTED_FOR_SALE";
    }

    if (ownerLower === buyerLower) {
        return "SETTLED";
    }

    if (ownerLower !== creatorLower) {
        return "PURCHASED_BY_FINANCIER";
    }

    return "APPROVED";
}

async function readInvoiceFromEvent(event) {
    const tokenId = Number(event.args.tokenId);
    const invoice = await getInvoiceMetadata(tokenId);

    return {
        ...invoice,
        mintTxHash: event.transactionHash,
        mintBlock: event.blockNumber,
    };
}

export async function getBlockchainSummary() {
    const mintEvents = await contract.queryFilter(contract.filters.InvoiceMinted());
    const invoices = await Promise.all(mintEvents.map((event) => readInvoiceFromEvent(event)));

    invoices.sort((left, right) => left.tokenId - right.tokenId);

    return {
        source: "blockchain",
        totalMinted: invoices.length,
        invoices,
    };
}

export function validateDueDate(dueDateString) {
    const [day, month, year] = dueDateString.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= dueDate;
}