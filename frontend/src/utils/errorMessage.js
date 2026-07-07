export function getFriendlyErrorMessage(error, fallback = "Something went wrong. Please try again.") {
    const rawMessage = normalizeMessage(
        error?.shortMessage ||
            error?.reason ||
            error?.info?.error?.message ||
            error?.error?.message ||
            error?.data?.message ||
            error?.message ||
            error ||
            fallback
    );

    if (!rawMessage) {
        return fallback;
    }

    const lowerMessage = rawMessage.toLowerCase();

    if (lowerMessage.includes("user rejected") || lowerMessage.includes("denied transaction signature")) {
        return "Transaction cancelled in the wallet.";
    }

    if (lowerMessage.includes("insufficient funds")) {
        return "Your wallet does not have enough ETH to cover gas or payment.";
    }

    if (lowerMessage.includes("nonce too low")) {
        return "Your wallet is out of sync. Refresh MetaMask and try again.";
    }

    if (lowerMessage.includes("replacement transaction underpriced") || lowerMessage.includes("fee too low")) {
        return "A pending transaction with the same nonce already exists.";
    }

    if (lowerMessage.includes("invalid address")) {
        return "One of the addresses entered is invalid.";
    }

    if (lowerMessage.includes("could not detect network") || lowerMessage.includes("network changed")) {
        return "Wallet network connection is not ready. Reconnect MetaMask and try again.";
    }

    if (lowerMessage.includes("already signed")) {
        return "This invoice has already been signed.";
    }

    if (lowerMessage.includes("not listed for sale")) {
        return "This invoice is not listed for sale.";
    }

    if (lowerMessage.includes("already listed")) {
        return "This invoice is already listed for sale.";
    }

    if (lowerMessage.includes("invoice not found")) {
        return "Invoice not found.";
    }

    const revertedReason = extractRevertReason(rawMessage);
    if (revertedReason) {
        return revertedReason;
    }

    if (lowerMessage.includes("execution reverted") || lowerMessage.includes("vm exception while processing transaction")) {
        return "The contract rejected the transaction.";
    }

    if (lowerMessage.includes("call exception")) {
        return "The contract call failed.";
    }

    return compactSentence(rawMessage) || fallback;
}

function normalizeMessage(value) {
    return String(value)
        .replace(/\s+/g, " ")
        .replace(/^error:\s*/i, "")
        .replace(/^execution reverted:?\s*/i, "")
        .replace(/^vm exception while processing transaction: revert\s*/i, "")
        .replace(/^call exception:?\s*/i, "")
        .replace(/^missing revert data \(action=.*?\)\s*/i, "")
        .replace(/^rpc error: code = unknown desc =\s*/i, "")
        .replace(/^metamask tx signature rejected\s*/i, "")
        .trim();
}

function extractRevertReason(message) {
    const reasonPatterns = [
        /execution reverted:?\s*"([^"]+)"/i,
        /execution reverted:?\s*'([^']+)'/i,
        /revert(?:ed)?(?: with reason string)?\s*"([^"]+)"/i,
        /revert(?:ed)?(?: with reason string)?\s*'([^']+)'/i,
        /revert(?:ed)?[:\s]+([A-Za-z0-9 ,._-]{3,})/i,
    ];

    for (const pattern of reasonPatterns) {
        const match = message.match(pattern);
        if (match?.[1]) {
            return compactSentence(match[1]);
        }
    }

    return null;
}

function compactSentence(message) {
    return String(message)
        .replace(/\s+/g, " ")
        .replace(/^TransactionExecutionError:\s*/i, "")
        .replace(/^Unknown error:\s*/i, "")
        .replace(/^Error: ?/i, "")
        .trim();
}