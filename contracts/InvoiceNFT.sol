// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title InvoiceNFT
 * @notice ERC-721 contract for tokenising trade invoices as NFTs.
 *         Based on the PES University IEEE paper on NFT-based Invoice Discounting.
 *
 *         Each minted token represents a single invoice whose metadata
 *         (buyer, amount, due-date, approval / sale status, etc.) is
 *         stored on-chain via the InvoiceMetadata struct.
 *
 *         A CID (IPFS content identifier) duplicate-tracking mapping
 *         prevents the same off-chain invoice document from being
 *         tokenised more than once.
 */
contract InvoiceNFT is ERC721 {
    // ──────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────

    /// @notice On-chain metadata associated with every minted invoice NFT.
    struct InvoiceMetadata {
        address creator;       // Original invoice creator (seller / supplier)
        address buyer;         // Party obligated to pay the invoice
        uint256 currPrice;     // Current trading price (in wei)
        uint256 invoiceAmount; // Face value of the invoice (in wei)
        string  dueDate;       // Payment due-date (ISO-8601 string)
        bool    isApproved;    // Whether the buyer has co-signed / approved
        bool    forSale;       // Whether the NFT is listed for discounting
    }

    // ──────────────────────────────────────────────
    //  State Variables
    // ──────────────────────────────────────────────

    /// @notice Maps a token ID to its invoice metadata.
    mapping(uint256 => InvoiceMetadata) public InvoiceNFT_Map;

    /// @notice Tracks whether an IPFS CID has already been used to mint
    ///         an invoice NFT, preventing duplicate tokenisation.
    mapping(string => bool) public cidUsed;

    /// @notice Auto-incrementing counter used to assign unique token IDs.
    uint256 private _nextTokenId;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @notice Deploys the InvoiceNFT contract with a fixed name and symbol.
     */
    constructor() ERC721("InvoiceNFT", "INVN") {
        // _nextTokenId starts at 0; first minted token will be ID 0.
    }
}
