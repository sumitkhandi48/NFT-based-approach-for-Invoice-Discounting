import { contract } from "../config/contract.js";

export async function getInvoiceMetadata(tokenId) {
    const data = await contract.InvoiceNFT_Map(tokenId);
    const tokenURI = await contract.tokenURI(tokenId);
    const owner = await contract.ownerOf(tokenId);

    return {
        tokenId: tokenId.toString(),
        creator: data.creator,
        buyer: data.buyer,
        currPrice: data.currPrice.toString(),
        invoiceAmount: data.invoiceAmount.toString(),
        dueDate: data.dueDate,
        isApproved: data.isApproved,
        forSale: data.forSale,
        tokenURI,
        owner,
    };
}

export function validateDueDate(dueDateString) {
    const [day, month, year] = dueDateString.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today >= dueDate;
}