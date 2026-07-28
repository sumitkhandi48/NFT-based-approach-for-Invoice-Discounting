const fs = require('fs');
const content = fs.readFileSync('contracts/InvoiceNFT.sol', 'utf8');

// 1. Add mapping for investment amount
let newContent = content.replace(
    'mapping(uint256 => bool)                  public invoiceDefaulted;   // set in markDefault',
    'mapping(uint256 => bool)                  public invoiceDefaulted;   // set in markDefault\n    mapping(uint256 => uint256)               public invoiceInvestmentAmount;'
);

// 2. Add metrics to CreditProfile
newContent = newContent.replace(
    'uint256 totalFundingProvided;\n    }',
    'uint256 totalFundingProvided;\n        uint32  approvedInvoices;\n        uint32  fundedInvoices;\n        uint32  settledInvoices;\n        uint32  activeInvestments;\n        uint32  completedInvestments;\n        uint256 totalCapitalInvested;\n        uint256 totalInvestedInCompleted;\n        uint256 totalCapitalRecovered;\n    }'
);

// 3. Init new metrics in _initCreditProfile
newContent = newContent.replace(
    'totalFundingProvided:  0\n        });',
    'totalFundingProvided:  0,\n            approvedInvoices: 0,\n            fundedInvoices: 0,\n            settledInvoices: 0,\n            activeInvestments: 0,\n            completedInvestments: 0,\n            totalCapitalInvested: 0,\n            totalInvestedInCompleted: 0,\n            totalCapitalRecovered: 0\n        });'
);

// 4. Add getBuyerBBCS and getBuyerBBCSBreakdown
const bbcsCode = `
    function getBuyerBBCS(address buyer) public view returns (uint8) {
        if (!_profileInitialized[buyer]) return INITIAL_SCORE;
        CreditProfile storage p = creditProfiles[buyer];
        uint32 completed = p.successfulSettlements + p.lateSettlements + p.defaults;
        if (completed == 0) return INITIAL_SCORE;

        uint256 totalSettled = p.successfulSettlements + p.lateSettlements;
        uint256 settlementScore = 50;
        if (totalSettled > 0) {
            settlementScore = (uint256(p.successfulSettlements) * 100) / totalSettled;
        }

        uint256 defaultRatio = (uint256(p.defaults) * 100) / completed;
        uint256 defaultScore = 100 > defaultRatio ? 100 - defaultRatio : 0;

        uint256 expScore = 100;
        if (completed < 20) {
            expScore = (uint256(completed) * 100) / 20;
        }

        uint256 weightedSum = settlementScore * 45 + defaultScore * 35 + expScore * 20;
        uint256 roundedScore = (weightedSum + 50) / 100;
        return uint8(roundedScore > 100 ? 100 : roundedScore);
    }

    function getBuyerBBCSBreakdown(address buyer) external view returns (
        uint256 settlementScore,
        uint256 defaultScore,
        uint256 experienceScore,
        uint8 finalBBCS
    ) {
        if (!_profileInitialized[buyer]) return (50, 100, 0, INITIAL_SCORE);
        CreditProfile storage p = creditProfiles[buyer];
        uint32 completed = p.successfulSettlements + p.lateSettlements + p.defaults;
        if (completed == 0) return (50, 100, 0, INITIAL_SCORE);

        uint256 totalSettled = p.successfulSettlements + p.lateSettlements;
        settlementScore = 50;
        if (totalSettled > 0) {
            settlementScore = (uint256(p.successfulSettlements) * 100) / totalSettled;
        }

        uint256 defaultRatio = (uint256(p.defaults) * 100) / completed;
        defaultScore = 100 > defaultRatio ? 100 - defaultRatio : 0;

        experienceScore = 100;
        if (completed < 20) {
            experienceScore = (uint256(completed) * 100) / 20;
        }

        uint256 weightedSum = settlementScore * 45 + defaultScore * 35 + experienceScore * 20;
        uint256 roundedScore = (weightedSum + 50) / 100;
        finalBBCS = uint8(roundedScore > 100 ? 100 : roundedScore);
    }
`;
newContent = newContent.replace(
    '// ══════════════════════════════════════════════\n    //  VIEW FUNCTIONS – DISCOUNT ENGINE',
    bbcsCode + '\n    // ══════════════════════════════════════════════\n    //  VIEW FUNCTIONS – DISCOUNT ENGINE'
);

// 5. Update calculateRiskScore to use getBuyerBBCS
newContent = newContent.replace(
    'uint256 score       = _profileInitialized[buyer] ? uint256(creditProfiles[buyer].score) : uint256(INITIAL_SCORE);',
    'uint256 score       = uint256(getBuyerBBCS(buyer));'
);

// 6. Update getResearchMetrics to use getBuyerBBCS
newContent = newContent.replace(
    'score            = p.score;',
    'score            = getBuyerBBCS(participant);'
);

// 7. Update signInvoice
newContent = newContent.replace(
    '_updateCreditScore(msg.sender, int16(int8(SIGN_REWARD)), "Invoice signed");',
    '_updateCreditScore(msg.sender, int16(int8(SIGN_REWARD)), "Invoice signed");\n        creditProfiles[invoice.creator].approvedInvoices++;'
);

// 8. Update buyInvoice
newContent = newContent.replace(
    'creditProfiles[msg.sender].totalFundingProvided   += msg.value;',
    'creditProfiles[msg.sender].totalFundingProvided   += msg.value;\n        \n        creditProfiles[currentOwner].fundedInvoices++;\n        creditProfiles[msg.sender].activeInvestments++;\n        creditProfiles[msg.sender].totalCapitalInvested += msg.value;\n        invoiceInvestmentAmount[_tokenId] = msg.value;'
);

// 9. Update settleInvoice
newContent = newContent.replace(
    '_updateCreditScore(currentOwner, int16(int8(REPAYMENT_REWARD)), "Repayment received");',
    '_updateCreditScore(currentOwner, int16(int8(REPAYMENT_REWARD)), "Repayment received");\n        creditProfiles[invoice.creator].settledInvoices++;\n        if (currentOwner != invoice.creator) {\n            creditProfiles[currentOwner].activeInvestments--;\n            creditProfiles[currentOwner].completedInvestments++;\n            creditProfiles[currentOwner].totalInvestedInCompleted += invoiceInvestmentAmount[_tokenId];\n            creditProfiles[currentOwner].totalCapitalRecovered += msg.value;\n        }'
);

// 10. Update markDefault
newContent = newContent.replace(
    '_applyHistoryAdjustment(buyer);',
    '_applyHistoryAdjustment(buyer);\n        \n        address financier = ownerOf(tokenId);\n        if (financier != InvoiceNFT_Map[tokenId].creator) {\n            creditProfiles[financier].activeInvestments--;\n            creditProfiles[financier].completedInvestments++;\n            creditProfiles[financier].totalInvestedInCompleted += invoiceInvestmentAmount[tokenId];\n        }'
);

fs.writeFileSync('contracts/InvoiceNFT.sol', newContent);
console.log("Patched InvoiceNFT.sol");
