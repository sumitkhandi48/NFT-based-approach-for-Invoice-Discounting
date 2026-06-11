// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

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
contract InvoiceNFT is ERC721URIStorage {
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

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new invoice NFT is minted.
    event InvoiceMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed buyer,
        uint256 invoiceAmount,
        string  dueDate
    );

    // ──────────────────────────────────────────────
    //  Algorithm 1 – mintInvoice
    // ──────────────────────────────────────────────

    /**
     * @notice Mints a new invoice NFT to the caller (supplier).
     * @dev    Implements Algorithm 1 from the IEEE paper:
     *         1. Verify the CID has not been used before (no duplicates).
     *         2. Verify supplier (msg.sender) ≠ buyer.
     *         3. Mint ERC-721 token to the supplier.
     *         4. Store InvoiceMetadata with isApproved = false,
     *            forSale = false, and currPrice = invoiceAmount.
     *         5. Mark the CID as used.
     *
     * @param _cid           IPFS content identifier for the invoice document.
     * @param _buyer         Address of the party obligated to pay the invoice.
     * @param _invoiceAmount Face value of the invoice (in wei).
     * @param _dueDate       Payment due-date (ISO-8601 string).
     * @return tokenId       The ID of the newly minted invoice NFT.
     */
    function mintInvoice(
        string memory _cid,
        address _buyer,
        uint256 _invoiceAmount,
        string  memory _dueDate
    ) external returns (uint256 tokenId) {
        // Step 1: Prevent duplicate CID minting
        require(!cidUsed[_cid], "Invoice with this CID already exists");

        // Step 2: Supplier (msg.sender) must not be the buyer
        require(msg.sender != _buyer, "Supplier and buyer cannot be the same");

        // Step 3: Assign token ID and mint ERC-721 to supplier
        tokenId = _nextTokenId;
        _nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, _cid);

        // Step 4: Store InvoiceMetadata on-chain
        InvoiceNFT_Map[tokenId] = InvoiceMetadata({
            creator:       msg.sender,
            buyer:         _buyer,
            currPrice:     _invoiceAmount,   // currPrice = invoiceAmount
            invoiceAmount: _invoiceAmount,
            dueDate:       _dueDate,
            isApproved:    false,             // Not yet co-signed by buyer
            forSale:       false              // Not listed for discounting
        });

        // Step 5: Mark CID as used to prevent future duplicates
        cidUsed[_cid] = true;

        emit InvoiceMinted(tokenId, msg.sender, _buyer, _invoiceAmount, _dueDate);
    }

    // ──────────────────────────────────────────────
    //  Algorithm 2 – signInvoice
    // ──────────────────────────────────────────────

    /// @notice Emitted when the buyer co-signs an invoice NFT.
    event InvoiceSigned(uint256 indexed tokenId, address indexed buyer);

    /**
     * @notice Allows the designated buyer to co-sign (approve) an invoice.
     * @dev    Implements Algorithm 2 from the IEEE paper:
     *         1. Verify that msg.sender is the buyer recorded in the invoice.
     *         2. Verify the invoice has not already been approved.
     *         3. Set isApproved = true.
     *
     *         The invoice must be signed by the buyer before the supplier
     *         can list it for sale on the marketplace (Algorithm 3).
     *
     * @param _tokenId The ID of the invoice NFT to sign.
     */
    function signInvoice(uint256 _tokenId) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];

        // Step 1: Only the designated buyer can sign
        require(msg.sender == invoice.buyer, "Only the buyer can sign this invoice");

        // Step 2: Invoice must not already be approved
        require(!invoice.isApproved, "Invoice is already signed");

        // Step 3: Set isApproved to true
        invoice.isApproved = true;

        emit InvoiceSigned(_tokenId, msg.sender);
    }
}
