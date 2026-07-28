// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title InvoiceNFT
 * @notice ERC-721 contract for tokenising trade invoices as NFTs.
 *
 *  RESEARCH FEATURES
 *  ─────────────────
 *  Feature 1 – On-Chain Credit Scoring
 *    · Configurable constants replace all magic numbers.
 *    · History-based adjustment rewards long-term reliability.
 *    · CreditScoreUpdated emits oldScore + newScore for auditability.
 *
 *  Feature 2 – Dynamic Discount Engine
 *    · Risk score = weighted sum of credit, default ratio, settlement gap, urgency.
 *    · Discount = linear formula: MIN + (MAX - MIN) * riskScore / 100.
 *    · RecommendationGenerated emits finalDiscount for research comparison.
 *
 *  Original workflow Algorithms 1–5, 9 are UNCHANGED in signature and behaviour.
 */
contract InvoiceNFT is ERC721URIStorage {

    // ══════════════════════════════════════════════
    //  CONFIGURABLE CONSTANTS  (no magic numbers)
    // ══════════════════════════════════════════════

    // ── Credit score bounds & initial value ───────
    uint8  public constant INITIAL_SCORE      = 75;
    uint8  public constant SCORE_MAX          = 100;

    // ── Per-event rewards / penalties ────────────
    int8   public constant SIGN_REWARD        =  2;   // buyer co-signs invoice
    int8   public constant ONTIME_REWARD      =  5;   // buyer settles on/before due date
    int8   public constant LATE_PENALTY       = -5;   // buyer settles after due date
    int8   public constant DEFAULT_PENALTY    = -15;  // invoice defaults
    int8   public constant SUPPLIER_REWARD    =  3;   // supplier receives funding
    int8   public constant FINANCIER_REWARD   =  2;   // financier provides funding
    int8   public constant REPAYMENT_REWARD   =  3;   // financier receives repayment

    // ── History-based adjustment ──────────────────
    // Applied after settle/default when totalCompleted >= HISTORY_THRESHOLD
    int8   public constant HISTORY_BONUS      =  2;   // successRatio >= GOOD_RATIO
    int8   public constant HISTORY_PENALTY    = -3;   // defaultRatio  >= BAD_RATIO
    uint8  public constant HISTORY_THRESHOLD  =  3;   // min completed invoices
    uint8  public constant GOOD_RATIO         = 80;   // % on-time for bonus
    uint8  public constant BAD_RATIO          = 30;   // % defaults for extra penalty

    // ── Risk score weights (sum = 100) ────────────
    uint8  public constant CREDIT_WEIGHT      = 60;
    uint8  public constant DEFAULT_WEIGHT     = 25;
    uint8  public constant SETTLEMENT_WEIGHT  = 15;

    // ── Due-date urgency bonuses ──────────────────
    uint8  public constant URGENCY_PAST_DUE   = 15;
    uint8  public constant URGENCY_NEAR_7D    = 10;
    uint8  public constant URGENCY_NEAR_30D   =  5;

    // ── Discount bounds ───────────────────────────
    uint8  public constant MIN_DISCOUNT       =  2;   // % at zero risk
    uint8  public constant MAX_DISCOUNT       = 20;   // % at maximum risk

    // ══════════════════════════════════════════════
    //  DATA STRUCTURES
    // ══════════════════════════════════════════════

    /// @notice On-chain metadata for every invoice NFT (layout UNCHANGED).
    struct InvoiceMetadata {
        address creator;
        address buyer;
        uint256 currPrice;
        uint256 invoiceAmount;
        string  dueDate;
        bool    isApproved;
        bool    forSale;
    }

    /**
     * @notice Credit profile per participant.
     *
     *  Storage packing (slot 0 = 32 bytes):
     *    score(1) + totalInvoices(4) + successfulSettlements(4)
     *    + lateSettlements(4) + defaults(4) + lastUpdated(8)
     *    + totalSettlementHours(4) = 29 bytes  ✓ fits in slot 0
     *  slot 1: totalFundingReceived (32 bytes)
     *  slot 2: totalFundingProvided (32 bytes)
     */
    struct CreditProfile {
        // ── Original fields (UNCHANGED) ───────────────────────────────────────
        uint8   score;
        uint32  totalInvoices;
        uint32  successfulSettlements;
        uint32  lateSettlements;
        uint32  defaults;
        uint64  lastUpdated;
        uint32  totalSettlementHours;  // cumulative hours mint→settle; enables avg calc
        uint256 totalFundingReceived;
        uint256 totalFundingProvided;
        // ── BBCS counters (added for dynamic scoring — do not remove old fields) ──
        uint32  approvedInvoices;       // incremented on signInvoice
        uint32  fundedInvoices;         // incremented on buyInvoice  (for invoice creator)
        uint32  settledInvoices;        // incremented on settleInvoice (for invoice creator)
        uint32  activeInvestments;      // incremented on buyInvoice, decremented on settle/default
        uint32  completedInvestments;   // incremented on settleInvoice / markDefault
        uint256 totalCapitalInvested;   // wei deployed as financier
        uint256 totalInvestedInCompleted; // subset of above: only closed positions
        uint256 totalCapitalRecovered;  // wei received back on settled invoices
    }

    /// @notice Stores both the system recommendation and the supplier's final choice.
    struct DiscountRecommendation {
        uint8  riskScore;
        uint8  recommendedDiscount;
        uint8  finalDiscount;
        bool   supplierOverrode;
    }

    // ══════════════════════════════════════════════
    //  STATE VARIABLES
    // ══════════════════════════════════════════════

    // ── Original (UNCHANGED) ──────────────────────
    mapping(uint256 => InvoiceMetadata)       public InvoiceNFT_Map;
    mapping(string  => bool)                  public cidUsed;
    uint256 private _nextTokenId;

    // ── Credit scoring ────────────────────────────
    mapping(address => CreditProfile)         public creditProfiles;
    mapping(address => bool)                  private _profileInitialized;

    // ── Discount engine ───────────────────────────
    mapping(uint256 => DiscountRecommendation) public discountRecommendations;

    // ── Due date timestamps (set once, immutable after) ───
    mapping(uint256 => uint256)               public invoiceDueDateTimestamp;

    // ── Per-invoice lifecycle metadata ───────────
    mapping(uint256 => uint64)                public invoiceMintedAt;    // set in mintInvoice
    mapping(uint256 => bool)                  public invoiceSettledFlag; // set in settleInvoice
    mapping(uint256 => bool)                  public invoiceDefaulted;   // set in markDefault
    mapping(uint256 => uint256)               public invoiceInvestmentAmount; // wei paid on buyInvoice

    address private immutable _contractOwner;

    // ══════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════

    constructor() ERC721("InvoiceNFT", "INVN") {
        _contractOwner = msg.sender;
    }

    // ══════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════

    // ── Original events (UNCHANGED) ───────────────
    event InvoiceMinted(uint256 indexed tokenId, address indexed creator, address indexed buyer, uint256 invoiceAmount, string dueDate);
    event InvoiceSigned(uint256 indexed tokenId, address indexed buyer);
    event InvoiceListedForSale(uint256 indexed tokenId, address indexed owner, uint256 price);
    event InvoiceSaleRevoked(uint256 indexed tokenId, address indexed owner);
    event InvoiceBought(uint256 indexed tokenId, address indexed previousOwner, address indexed newOwner, uint256 price);
    event InvoiceSettled(uint256 indexed tokenId, address indexed previousOwner, address indexed buyer, uint256 amount);

    /// @notice IMPROVED: includes oldScore for audit trail.
    event CreditScoreUpdated(
        address indexed participant,
        uint8   oldScore,
        uint8   newScore,
        string  reason
    );

    /// @notice IMPROVED: includes finalDiscount for research comparison.
    event RecommendationGenerated(
        uint256 indexed tokenId,
        uint8   riskScore,
        uint8   recommendedDiscount,
        uint8   finalDiscount
    );

    /// @notice Emitted when markDefault() is executed.
    event InvoiceDefaultedEvent(uint256 indexed tokenId, address indexed buyer);

    // ══════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ══════════════════════════════════════════════

    /// @dev Lazy initialisation — no-op if already initialised.
    function _initCreditProfile(address participant) private {
        if (_profileInitialized[participant]) return;
        creditProfiles[participant] = CreditProfile({
            score:                    INITIAL_SCORE,
            totalInvoices:            0,
            successfulSettlements:    0,
            lateSettlements:          0,
            defaults:                 0,
            lastUpdated:              uint64(block.timestamp),
            totalSettlementHours:     0,
            totalFundingReceived:     0,
            totalFundingProvided:     0,
            // new BBCS counters
            approvedInvoices:         0,
            fundedInvoices:           0,
            settledInvoices:          0,
            activeInvestments:        0,
            completedInvestments:     0,
            totalCapitalInvested:     0,
            totalInvestedInCompleted: 0,
            totalCapitalRecovered:    0
        });
        _profileInitialized[participant] = true;
    }

    /**
     * @dev Applies a signed delta, clamps to [0, SCORE_MAX], emits event.
     *      Emits oldScore + newScore for research auditability.
     */
    function _updateCreditScore(address participant, int16 delta, string memory reason) private {
        _initCreditProfile(participant);
        CreditProfile storage p = creditProfiles[participant];
        uint8 oldScore = p.score;
        int16 updated  = int16(uint16(p.score)) + delta;
        if (updated > int16(uint16(SCORE_MAX))) updated = int16(uint16(SCORE_MAX));
        if (updated < 0) updated = 0;
        p.score       = uint8(uint16(updated));
        p.lastUpdated = uint64(block.timestamp);
        emit CreditScoreUpdated(participant, oldScore, p.score, reason);
    }

    /**
     * @dev History-based adjustment applied after settle or default.
     *      Only activates when totalCompleted >= HISTORY_THRESHOLD.
     *
     *      IEEE formula:
     *        successRatio = successfulSettlements * 100 / totalCompleted
     *        defaultRatio = defaults * 100 / totalCompleted
     *        if successRatio >= GOOD_RATIO  → +HISTORY_BONUS
     *        if defaultRatio >= BAD_RATIO   → +HISTORY_PENALTY (negative)
     */
    function _applyHistoryAdjustment(address participant) private {
        CreditProfile storage p = creditProfiles[participant];
        uint32 completed = p.successfulSettlements + p.defaults;
        if (completed < uint32(HISTORY_THRESHOLD)) return;
        uint256 successRatio = (uint256(p.successfulSettlements) * 100) / completed;
        uint256 defaultRatio = (uint256(p.defaults)              * 100) / completed;
        if (successRatio >= uint256(GOOD_RATIO))
            _updateCreditScore(participant, int16(int8(HISTORY_BONUS)),   "History: reliable payer");
        if (defaultRatio >= uint256(BAD_RATIO))
            _updateCreditScore(participant, int16(int8(HISTORY_PENALTY)), "History: high default rate");
    }

    /**
     * @dev Shared listing logic — eliminates duplication between
     *      approveInvoiceSale and approveInvoiceSaleWithRecommendation.
     */
    function _listInvoice(uint256 tokenId, uint256 price) private {
        InvoiceNFT_Map[tokenId].currPrice = price;
        InvoiceNFT_Map[tokenId].forSale   = true;
        emit InvoiceListedForSale(tokenId, msg.sender, price);
    }

    // ══════════════════════════════════════════════
    //  VIEW FUNCTIONS – CREDIT SCORE
    // ══════════════════════════════════════════════

    function getCreditScore(address participant) external view returns (uint8) {
        return _profileInitialized[participant] ? creditProfiles[participant].score : INITIAL_SCORE;
    }

    function getCreditProfile(address participant) external view returns (CreditProfile memory) {
        if (!_profileInitialized[participant]) {
            return CreditProfile({
                score: INITIAL_SCORE, totalInvoices: 0, successfulSettlements: 0,
                lateSettlements: 0, defaults: 0, lastUpdated: 0,
                totalSettlementHours: 0, totalFundingReceived: 0, totalFundingProvided: 0,
                approvedInvoices: 0, fundedInvoices: 0, settledInvoices: 0,
                activeInvestments: 0, completedInvestments: 0,
                totalCapitalInvested: 0, totalInvestedInCompleted: 0, totalCapitalRecovered: 0
            });
        }
        return creditProfiles[participant];
    }

    // ══════════════════════════════════════════════
    //  VIEW FUNCTIONS – BBCS  (dynamic score, never stored)
    // ══════════════════════════════════════════════

    /**
     * @notice Dynamically computes the Buyer Blockchain Behavioral Credit Score (BBCS).
     *
     *  Formula (score is NEVER stored — always calculated on-the-fly):
     *    settlementScore (45%) = successfulSettlements / (successfulSettlements + lateSettlements) * 100
     *    defaultScore    (35%) = 100 - (defaults / totalCompleted * 100)
     *    experienceScore (20%) = min(totalCompleted, 20) / 20 * 100
     *    BBCS = 0.45*S + 0.35*D + 0.20*E  (rounded, clamped 0–100)
     *
     *  If the buyer has no completed financing history, returns INITIAL_SCORE (75).
     */
    function getBuyerBBCS(address buyer) public view returns (uint8) {
        if (!_profileInitialized[buyer]) return INITIAL_SCORE;
        CreditProfile storage p = creditProfiles[buyer];
        uint32 completed = p.successfulSettlements + p.lateSettlements + p.defaults;
        if (completed == 0) return INITIAL_SCORE;

        // Settlement Score: on-time ratio
        uint256 totalSettled = p.successfulSettlements + p.lateSettlements;
        uint256 sScore = (totalSettled > 0)
            ? (uint256(p.successfulSettlements) * 100) / totalSettled
            : 50;

        // Default Score: penalty for defaults
        uint256 dScore = 100 - ((uint256(p.defaults) * 100) / completed);

        // Experience Score: capped at 20 completed invoices
        uint256 eScore = (completed >= 20) ? 100 : (uint256(completed) * 100) / 20;

        uint256 weighted = sScore * 45 + dScore * 35 + eScore * 20;
        uint256 bbcs = (weighted + 50) / 100;  // round half-up
        return uint8(bbcs > 100 ? 100 : bbcs);
    }

    /**
     * @notice Debug/research function — exposes sub-components of BBCS.
     *         NOT intended for UI display; use for validation and paper experiments.
     */
    function getBuyerBBCSBreakdown(address buyer)
        external view
        returns (
            uint256 settlementScore,
            uint256 defaultScore,
            uint256 experienceScore,
            uint8   finalBBCS
        )
    {
        if (!_profileInitialized[buyer]) return (50, 100, 0, INITIAL_SCORE);
        CreditProfile storage p = creditProfiles[buyer];
        uint32 completed = p.successfulSettlements + p.lateSettlements + p.defaults;
        if (completed == 0) return (50, 100, 0, INITIAL_SCORE);

        uint256 totalSettled = p.successfulSettlements + p.lateSettlements;
        settlementScore = (totalSettled > 0)
            ? (uint256(p.successfulSettlements) * 100) / totalSettled
            : 50;
        defaultScore    = 100 - ((uint256(p.defaults) * 100) / completed);
        experienceScore = (completed >= 20) ? 100 : (uint256(completed) * 100) / 20;

        uint256 weighted = settlementScore * 45 + defaultScore * 35 + experienceScore * 20;
        uint256 bbcs = (weighted + 50) / 100;
        finalBBCS = uint8(bbcs > 100 ? 100 : bbcs);
    }

    // ══════════════════════════════════════════════
    //  VIEW FUNCTIONS – DISCOUNT ENGINE
    // ══════════════════════════════════════════════

    /**
     * @notice Computes risk score using a three-component weighted formula.
     *
     *  IEEE formula:
     *    S  = creditScore  (0–100)
     *    DR = defaultRatio (0–100, from history)
     *    SR = settlementGapRatio (% late or defaulted, 0–100)
     *
     *    baseRisk  = (100-S)*CREDIT_WEIGHT/100 + DR*DEFAULT_WEIGHT/100 + SR*SETTLEMENT_WEIGHT/100
     *    riskScore = clamp(baseRisk + urgencyBonus, 0, 100)
     *
     *  Weights: CREDIT=60, DEFAULT=25, SETTLEMENT=15  (sum = 100)
     */
    function calculateRiskScore(address buyer, uint256 tokenId)
        public view returns (uint8 riskScore)
    {
        uint256 score       = _profileInitialized[buyer] ? uint256(creditProfiles[buyer].score) : uint256(INITIAL_SCORE);
        uint256 defRatio    = 0;
        uint256 settleGap   = 0;

        if (_profileInitialized[buyer]) {
            CreditProfile storage p = creditProfiles[buyer];
            uint32 completed = p.successfulSettlements + p.defaults;
            if (completed > 0) {
                defRatio  = (uint256(p.defaults)         * 100) / completed;
                uint256 onTime = uint256(p.successfulSettlements) > uint256(p.lateSettlements)
                    ? uint256(p.successfulSettlements) - uint256(p.lateSettlements) : 0;
                settleGap = ((uint256(completed) - onTime) * 100) / uint256(completed);
            }
        }

        uint256 risk = ((100 - score)  * uint256(CREDIT_WEIGHT)     / 100)
                     + (defRatio       * uint256(DEFAULT_WEIGHT)     / 100)
                     + (settleGap      * uint256(SETTLEMENT_WEIGHT)  / 100);

        uint256 dueTs = invoiceDueDateTimestamp[tokenId];
        if (dueTs > 0) {
            if (block.timestamp >= dueTs) {
                risk += uint256(URGENCY_PAST_DUE);
            } else {
                uint256 daysLeft = (dueTs - block.timestamp) / 1 days;
                if      (daysLeft < 7)  risk += uint256(URGENCY_NEAR_7D);
                else if (daysLeft < 30) risk += uint256(URGENCY_NEAR_30D);
            }
        }

        if (risk > uint256(SCORE_MAX)) risk = uint256(SCORE_MAX);
        riskScore = uint8(risk);
    }

    /**
     * @notice Returns (riskScore, recommendedDiscount%) for a token.
     *
     *  IEEE discount formula (linear, bounded):
     *    discount = MIN_DISCOUNT + (MAX_DISCOUNT - MIN_DISCOUNT) * riskScore / 100
     *    Range: MIN_DISCOUNT (2%) at riskScore=0  →  MAX_DISCOUNT (20%) at riskScore=100
     */
    function recommendDiscount(uint256 tokenId)
        external view returns (uint8 riskScore, uint8 recommendedDiscount)
    {
        riskScore = calculateRiskScore(InvoiceNFT_Map[tokenId].buyer, tokenId);
        recommendedDiscount = uint8(
            uint256(MIN_DISCOUNT) + (uint256(MAX_DISCOUNT - MIN_DISCOUNT) * uint256(riskScore)) / 100
        );
    }

    /**
     * @notice Returns research metrics for a participant.
     *         Supports generating IEEE experimental results without off-chain DB.
     *
     * @return score               Current credit score
     * @return settlementRatio     successfulSettlements * 100 / totalCompleted
     * @return defaultRatio        defaults * 100 / totalCompleted
     * @return avgSettlementHours  totalSettlementHours / successfulSettlements
     * @return totalFundingRcvd    Cumulative wei received as supplier
     * @return totalFundingPrvd    Cumulative wei deployed as financier
     */
    function getResearchMetrics(address participant)
        external view
        returns (
            uint8  score,
            uint256 settlementRatio,
            uint256 defaultRatio,
            uint256 avgSettlementHours,
            uint256 totalFundingRcvd,
            uint256 totalFundingPrvd
        )
    {
        if (!_profileInitialized[participant]) {
            return (INITIAL_SCORE, 0, 0, 0, 0, 0);
        }
        CreditProfile storage p = creditProfiles[participant];
        score            = p.score;
        totalFundingRcvd = p.totalFundingReceived;
        totalFundingPrvd = p.totalFundingProvided;
        uint32 completed = p.successfulSettlements + p.defaults;
        if (completed > 0) {
            settlementRatio = (uint256(p.successfulSettlements) * 100) / completed;
            defaultRatio    = (uint256(p.defaults)              * 100) / completed;
        }
        if (p.successfulSettlements > 0) {
            avgSettlementHours = uint256(p.totalSettlementHours) / uint256(p.successfulSettlements);
        }
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 1 – mintInvoice  (UNCHANGED signature)
    // ══════════════════════════════════════════════

    function mintInvoice(
        string memory _cid,
        address _buyer,
        uint256 _invoiceAmount,
        string  memory _dueDate
    ) external returns (uint256 tokenId) {
        require(!cidUsed[_cid],          "Invoice with this CID already exists");
        require(msg.sender != _buyer,    "Supplier and buyer cannot be the same");

        tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, _cid);

        InvoiceNFT_Map[tokenId] = InvoiceMetadata({
            creator:       msg.sender,
            buyer:         _buyer,
            currPrice:     _invoiceAmount,
            invoiceAmount: _invoiceAmount,
            dueDate:       _dueDate,
            isApproved:    false,
            forSale:       false
        });

        cidUsed[_cid]          = true;
        invoiceMintedAt[tokenId] = uint64(block.timestamp);

        _initCreditProfile(msg.sender);
        _initCreditProfile(_buyer);
        creditProfiles[msg.sender].totalInvoices++;

        emit InvoiceMinted(tokenId, msg.sender, _buyer, _invoiceAmount, _dueDate);
    }

    // ══════════════════════════════════════════════
    //  setInvoiceDueTimestamp  (IMMUTABLE after first set)
    // ══════════════════════════════════════════════

    /**
     * @notice Supplier sets the Unix due-date timestamp once after minting.
     *         SECURITY: immutable after first assignment — cannot be overwritten.
     */
    function setInvoiceDueTimestamp(uint256 tokenId, uint256 timestamp) external {
        require(InvoiceNFT_Map[tokenId].creator == msg.sender, "Only invoice creator can set due timestamp");
        require(invoiceDueDateTimestamp[tokenId] == 0,         "Due timestamp already set and is immutable");
        require(timestamp > block.timestamp,                   "Due date must be in the future");
        invoiceDueDateTimestamp[tokenId] = timestamp;
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 2 – signInvoice  (UNCHANGED signature)
    // ══════════════════════════════════════════════

    function signInvoice(uint256 _tokenId) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        require(msg.sender == invoice.buyer, "Only the buyer can sign this invoice");
        require(!invoice.isApproved,         "Invoice is already signed");

        invoice.isApproved = true;
        _updateCreditScore(msg.sender, int16(int8(SIGN_REWARD)), "Invoice signed");
        // BBCS: track approvals from the invoice creator's perspective
        creditProfiles[invoice.creator].approvedInvoices++;
        emit InvoiceSigned(_tokenId, msg.sender);
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 3 – approveInvoiceSale  (UNCHANGED signature)
    // ══════════════════════════════════════════════

    function approveInvoiceSale(uint256 _tokenId, uint256 _price) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        require(ownerOf(_tokenId) == msg.sender, "Only the owner can list this invoice");
        require(invoice.isApproved,              "Invoice must be signed by buyer first");
        require(!invoice.forSale,                "Invoice is already listed for sale");
        _listInvoice(_tokenId, _price);
    }

    // ══════════════════════════════════════════════
    //  approveInvoiceSaleWithRecommendation  (REFACTORED – no duplicate requires)
    // ══════════════════════════════════════════════

    /**
     * @notice Extended listing that stores discount recommendation data.
     *         Uses _listInvoice() to eliminate duplicated listing logic.
     */
    function approveInvoiceSaleWithRecommendation(
        uint256 _tokenId,
        uint256 _price,
        bool    _useRecommended
    ) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        require(ownerOf(_tokenId) == msg.sender, "Only the owner can list this invoice");
        require(invoice.isApproved,              "Invoice must be signed by buyer first");
        require(!invoice.forSale,                "Invoice is already listed for sale");

        uint8 riskScore     = calculateRiskScore(invoice.buyer, _tokenId);
        uint8 recDiscount   = uint8(uint256(MIN_DISCOUNT) + (uint256(MAX_DISCOUNT - MIN_DISCOUNT) * uint256(riskScore)) / 100);
        uint8 finalDiscount = (invoice.invoiceAmount > 0 && _price < invoice.invoiceAmount)
            ? uint8(((invoice.invoiceAmount - _price) * 100) / invoice.invoiceAmount)
            : 0;

        discountRecommendations[_tokenId] = DiscountRecommendation({
            riskScore:           riskScore,
            recommendedDiscount: recDiscount,
            finalDiscount:       finalDiscount,
            supplierOverrode:    !_useRecommended
        });

        emit RecommendationGenerated(_tokenId, riskScore, recDiscount, finalDiscount);
        _listInvoice(_tokenId, _price);
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 4 – revokeInvoiceSale  (UNCHANGED)
    // ══════════════════════════════════════════════

    function revokeInvoiceSale(uint256 _tokenId) external {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        require(ownerOf(_tokenId) == msg.sender, "Only the owner can revoke this listing");
        require(invoice.forSale,                 "Invoice is not listed for sale");
        invoice.currPrice = invoice.invoiceAmount;
        invoice.forSale   = false;
        emit InvoiceSaleRevoked(_tokenId, msg.sender);
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 5 – buyInvoice  (UNCHANGED signature)
    // ══════════════════════════════════════════════

    function buyInvoice(uint256 _tokenId) external payable {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        address currentOwner = ownerOf(_tokenId);

        require(invoice.forSale,                   "Invoice is not listed for sale");
        require(msg.sender != currentOwner,         "Owner cannot buy their own invoice");
        require(msg.value == invoice.currPrice,     "Incorrect payment amount");

        payable(currentOwner).transfer(msg.value);
        _safeTransfer(currentOwner, msg.sender, _tokenId, "");

        invoice.forSale   = false;
        invoice.currPrice = invoice.invoiceAmount;

        // Credit scoring — _updateCreditScore handles _initCreditProfile internally
        _updateCreditScore(currentOwner, int16(int8(SUPPLIER_REWARD)),  "Funding received");
        _updateCreditScore(msg.sender,   int16(int8(FINANCIER_REWARD)), "Funding provided");
        creditProfiles[currentOwner].totalFundingReceived += msg.value;
        creditProfiles[msg.sender].totalFundingProvided   += msg.value;
        // BBCS: track invoice funding for supplier + financier investment metrics
        creditProfiles[invoice.creator].fundedInvoices++;
        creditProfiles[msg.sender].activeInvestments++;
        creditProfiles[msg.sender].totalCapitalInvested    += msg.value;
        invoiceInvestmentAmount[_tokenId]                   = msg.value;
        emit InvoiceBought(_tokenId, currentOwner, msg.sender, msg.value);
    }

    // ══════════════════════════════════════════════
    //  ALGORITHM 9 – settleInvoice  (UNCHANGED signature)
    // ══════════════════════════════════════════════

    function settleInvoice(uint256 _tokenId) external payable {
        InvoiceMetadata storage invoice = InvoiceNFT_Map[_tokenId];
        address currentOwner = ownerOf(_tokenId);

        require(msg.sender == invoice.buyer, "Only the designated buyer can settle this invoice");
        require(invoice.isApproved,          "Invoice has not been approved by the buyer");
        require(msg.value == invoice.currPrice, "Incorrect payment amount");

        payable(currentOwner).transfer(msg.value);
        _safeTransfer(currentOwner, msg.sender, _tokenId, "");

        invoiceSettledFlag[_tokenId] = true;   // guard for markDefault

        // Settlement duration tracking (hours from mint to settlement)
        _initCreditProfile(msg.sender);
        uint64 mintedAt = invoiceMintedAt[_tokenId];
        if (mintedAt > 0 && block.timestamp > mintedAt) {
            uint32 hours_ = uint32((block.timestamp - mintedAt) / 3600);
            creditProfiles[msg.sender].totalSettlementHours += hours_;
        }

        // Early vs. late scoring
        uint256 dueTs = invoiceDueDateTimestamp[_tokenId];
        if (dueTs > 0) {
            if (block.timestamp <= dueTs) {
                _updateCreditScore(msg.sender, int16(int8(ONTIME_REWARD)), "Early settlement");
            } else {
                creditProfiles[msg.sender].lateSettlements++;
                _updateCreditScore(msg.sender, int16(int8(LATE_PENALTY)), "Late settlement");
            }
        } else {
            _updateCreditScore(msg.sender, int16(int8(ONTIME_REWARD)), "Invoice settled");
        }

        creditProfiles[msg.sender].successfulSettlements++;
        _applyHistoryAdjustment(msg.sender);     // history-based bonus/penalty

        _updateCreditScore(currentOwner, int16(int8(REPAYMENT_REWARD)), "Repayment received");

        // BBCS: track settlement for supplier + close out financier position
        creditProfiles[invoice.creator].settledInvoices++;
        if (currentOwner != invoice.creator) {
            creditProfiles[currentOwner].activeInvestments--;
            creditProfiles[currentOwner].completedInvestments++;
            creditProfiles[currentOwner].totalInvestedInCompleted += invoiceInvestmentAmount[_tokenId];
            creditProfiles[currentOwner].totalCapitalRecovered    += msg.value;
        }

        emit InvoiceSettled(_tokenId, currentOwner, msg.sender, msg.value);
    }

    // ══════════════════════════════════════════════
    //  markDefault  (SECURITY HARDENED)
    // ══════════════════════════════════════════════

    /**
     * @notice Marks a buyer as having defaulted on an invoice.
     *
     *  Security guards:
     *   1. Only contract owner can call (access control).
     *   2. Cannot execute if invoice is already settled (state check).
     *   3. Cannot execute twice on the same token (idempotency guard).
     *   4. Due date must have passed (temporal check — requires timestamp set).
     */
    function markDefault(uint256 tokenId) external {
        require(msg.sender == _contractOwner,      "Only contract owner can mark defaults");
        require(!invoiceSettledFlag[tokenId],       "Invoice already settled - cannot default");
        require(!invoiceDefaulted[tokenId],         "Default already recorded for this invoice");
        require(invoiceDueDateTimestamp[tokenId] > 0 &&
                block.timestamp > invoiceDueDateTimestamp[tokenId],
                "Due date has not yet passed");

        invoiceDefaulted[tokenId] = true;

        address buyer = InvoiceNFT_Map[tokenId].buyer;
        _initCreditProfile(buyer);
        creditProfiles[buyer].defaults++;
        _updateCreditScore(buyer, int16(int8(DEFAULT_PENALTY)), "Invoice default");
        _applyHistoryAdjustment(buyer);
        // BBCS: close out the financier's active investment on default
        address financier = ownerOf(tokenId);
        if (financier != InvoiceNFT_Map[tokenId].creator) {
            creditProfiles[financier].activeInvestments--;
            creditProfiles[financier].completedInvestments++;
            creditProfiles[financier].totalInvestedInCompleted += invoiceInvestmentAmount[tokenId];
            // totalCapitalRecovered stays unchanged (no repayment on default)
        }
        emit InvoiceDefaultedEvent(tokenId, buyer);
    }
}
