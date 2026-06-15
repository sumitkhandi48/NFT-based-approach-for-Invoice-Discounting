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
        string  dueDate;       // Payment due-date as a human-readable string (e.g. "DD-MM-YYYY")
                               // Stored as a string, matching the seniors' actual deployment (Fig. 9, 11, 14).
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
     * @param _dueDate       Payment due-date as a human-readable string (e.g. "DD-MM-YYYY").
     *                       Stored as a string per the seniors' actual deployment (paper Fig. 9, 11, 14).
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

    // ──────────────────────────────────────────────
    //  Algorithm 3 – approveInvoiceSale
    // ──────────────────────────────────────────────

    /// @notice Emitted when the owner lists an invoice NFT for sale.
    event InvoiceListedForSale(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 price
    );

    /**
     * @notice Allows the NFT owner to list a signed invoice for sale
     *         at a discounted price on the marketplace.
     * @dev    Implements Algorithm 3 from the IEEE paper:
     *         1. Verify that msg.sender is the current owner of the NFT.
     *         2. Verify the invoice has been signed by the buyer (isApproved).
     *         3. Verify the invoice is not already listed for sale.
     *         4. Set currPrice to the discounted price.
     *         5. Set forSale = true.
     *
     *         The buyer must have signed the invoice (Algorithm 2) before
     *         the owner can list it for sale.
     *
     * @param _tokenId The ID of the invoice NFT to list.
     * @param _price   The discounted selling price (in wei).
     */
    function approveInvoiceSale(uint256 _tokenId, uint256 _price) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];

        // Step 1: Only the current NFT owner can list for sale
        require(ownerOf(_tokenId) == msg.sender, "Only the owner can list this invoice");

        // Step 2: Invoice must be signed by the buyer first
        require(invoice.isApproved, "Invoice must be signed by buyer first");

        // Step 3: Invoice must not already be listed
        require(!invoice.forSale, "Invoice is already listed for sale");

        // Step 4: Set the discounted selling price
        invoice.currPrice = _price;

        // Step 5: Mark as listed for sale
        invoice.forSale = true;

        emit InvoiceListedForSale(_tokenId, msg.sender, _price);
    }

    // ──────────────────────────────────────────────
    //  Algorithm 4 – revokeInvoiceSale
    // ──────────────────────────────────────────────

    /// @notice Emitted when the owner revokes (delists) an invoice NFT from sale.
    event InvoiceSaleRevoked(uint256 indexed tokenId, address indexed owner);

    /**
     * @notice Allows the NFT owner to revoke (delist) an invoice from the
     *         marketplace, undoing a previous approveInvoiceSale listing.
     * @dev    Implements Algorithm 4 from the IEEE paper:
     *         1. Verify that msg.sender is the current owner of the NFT.
     *         2. Verify the invoice is currently listed for sale.
     *         3. Reset currPrice back to the original invoiceAmount.
     *         4. Set forSale = false.
     *
     *         This is the logical inverse of Algorithm 3. After revocation,
     *         the owner may re-list the invoice at a different price by
     *         calling approveInvoiceSale again.
     *
     * @param _tokenId The ID of the invoice NFT to delist.
     */
    function revokeInvoiceSale(uint256 _tokenId) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];

        // Step 1: Only the current NFT owner can revoke the listing
        require(ownerOf(_tokenId) == msg.sender, "Only the owner can revoke this listing");

        // Step 2: Invoice must currently be listed for sale
        require(invoice.forSale, "Invoice is not listed for sale");

        // Step 3: Reset the price back to the original invoice amount
        invoice.currPrice = invoice.invoiceAmount;

        // Step 4: Mark as no longer for sale
        invoice.forSale = false;

        emit InvoiceSaleRevoked(_tokenId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Algorithm 5 – buyInvoice
    // ──────────────────────────────────────────────

    /// @notice Emitted when a financier purchases an invoice NFT.
    event InvoiceBought(
        uint256 indexed tokenId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 price
    );

    /**
     * @notice Allows a financier to buy a listed invoice NFT by sending
     *         ETH equal to the current asking price.
     * @dev    Implements Algorithm 5 from the IEEE paper:
     *         1. Verify the invoice is currently listed for sale.
     *         2. Verify the caller (financier) is not the current owner.
     *         3. Verify msg.value equals the current price exactly.
     *         4. Transfer ETH payment to the current owner (supplier).
     *         5. Transfer NFT ownership from the owner to the financier.
     *         6. Set forSale = false.
     *         7. Reset currPrice back to the original invoiceAmount.
     *
     *         The contract acts as a trusted intermediary: it receives
     *         the ETH from the financier, forwards it to the owner,
     *         and transfers the NFT using the internal _safeTransfer
     *         (which bypasses external approval checks).
     *
     * @param _tokenId The ID of the invoice NFT to buy.
     */
    function buyInvoice(uint256 _tokenId) external payable {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        address currentOwner = ownerOf(_tokenId);

        // Step 1: Invoice must be listed for sale
        require(invoice.forSale, "Invoice is not listed for sale");

        // Step 2: Buyer (financier) must not be the current owner
        require(msg.sender != currentOwner, "Owner cannot buy their own invoice");

        // Step 3: Payment must equal the current price exactly
        require(msg.value == invoice.currPrice, "Incorrect payment amount");

        // Step 4: Transfer ETH to the current owner (supplier)
        payable(currentOwner).transfer(msg.value);

        // Step 5: Transfer NFT from current owner to the financier
        _safeTransfer(currentOwner, msg.sender, _tokenId);

        // Step 6: Mark as no longer for sale
        invoice.forSale = false;

        // Step 7: Reset currPrice to the original invoice face value
        //         (Paper Algorithm 5: InvoiceNFT[tokenId].currPrice = invoiceAmount)
        invoice.currPrice = invoice.invoiceAmount;

        emit InvoiceBought(_tokenId, currentOwner, msg.sender, msg.value);
    }

    // ──────────────────────────────────────────────
    //  Algorithm 9 – settleInvoice
    // ──────────────────────────────────────────────

    /// @notice Emitted when an invoice NFT is settled on or after the due date.
    event InvoiceSettled(
        uint256 indexed tokenId,
        address indexed previousOwner,
        address indexed buyer,
        uint256 amount
    );

    /**
     * @notice Allows the designated buyer (customer) to settle the invoice on or
     *         after its due date by paying the invoice face value and receiving
     *         the NFT back.
     * @dev    Implements Algorithm 9 from the Final Report:
     *         1. (Algorithm 8 inline) Verify msg.sender is the designated buyer.
     *         2. (Algorithm 8 inline) Verify the invoice has been approved.
     *         3. Verify Current Date >= Due Date  (block.timestamp >= invoice.dueDate).
     *         4. Verify msg.value equals invoice.currPrice (== invoiceAmount post-buyInvoice).
     *         5. Transfer payment (NFT.price) to the current NFT owner.
     *         6. Transfer the NFT from the current owner to the buyer (Customer).
     *
     *         The comment in Algorithm 9 notes that after settlement the customer
     *         may optionally burn the NFT — that is a separate action, not part
     *         of this function.
     *
     * @param _tokenId The ID of the invoice NFT to settle.
     */
    function settleInvoice(uint256 _tokenId) external payable {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        address currentOwner = ownerOf(_tokenId);

        // Algorithm 8 (inline): NFT.customer == Customer Address
        // Only the designated buyer may trigger settlement.
        require(msg.sender == invoice.buyer, "Only the designated buyer can settle this invoice");

        // Algorithm 8 (inline): NFT.approved == True
        // The invoice must have been co-signed by the buyer.
        require(invoice.isApproved, "Invoice has not been approved by the buyer");

        // Algorithm 9: IF Current Date >= Due Date
        // NOTE: dueDate is stored as a display string (e.g. "10-04-2024") per the seniors' actual
        // deployment (paper Fig. 9, 11, 14). On-chain date comparison with block.timestamp is not
        // possible. The due-date gate is enforced by the Node.js application layer before calling
        // this function — exactly as the seniors implemented it.

        // Algorithm 9: Customer transfers NFT.price to NFT.ownerAddress
        require(msg.value == invoice.currPrice, "Incorrect payment amount");
        payable(currentOwner).transfer(msg.value);

        // Algorithm 9: NFT owner transfers the NFT to the Customer
        _safeTransfer(currentOwner, msg.sender, _tokenId);

        emit InvoiceSettled(_tokenId, currentOwner, msg.sender, msg.value);
    }
}
