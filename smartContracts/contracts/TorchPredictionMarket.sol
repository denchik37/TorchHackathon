// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
/**
 * @title TorchPredictionMarket
 * @dev A prediction market for TORCH token price with quality-based weighting
 * @notice This contract allows users to place bets on future TORCH token prices
 * with quality multipliers based on prediction sharpness and time horizon
 */
contract TorchPredictionMarket is Ownable {
    // ==============================================================
    // |                    Constants                               |
    // ==============================================================
    uint256 public immutable startTimestamp;
    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant FEE_BPS = 50;        // 0.5% fee in basis points
    uint256 public constant BPS_DENOM = 10000;   // denominator for basis points (100% = 10000)
    uint256 public constant MIN_STAKE = 0.01 ether;  // Minimum bet amount
    uint256 public constant MAX_STAKE = 100 ether;   // Maximum bet amount
    uint256 public constant MAX_DAYS_AHEAD = 30;     // Maximum days to bet ahead
    uint256 public constant MIN_DAYS_AHEAD = 1;      // Minimum days to bet ahead
    uint256 public constant BATCH_SIZE = 50;         // Number of bets to process per batch

    // ==============================================================
    // |                    State Variables                         |
    // ==============================================================
    uint256 public totalFeesCollected;
    uint256 public nextBetId;

    // ==============================================================
    // |                    Structs                                 |
    // ==============================================================
    struct Bet {
        address bettor;
        uint256 targetTimestamp;
        uint256 priceMin;
        uint256 priceMax;
        uint256 stake;
        uint256 qualityBps;
        uint256 weight;
        bool finalized;
        bool claimed;
        uint256 actualPrice;  // Price at target timestamp
        bool won;            // Whether bet won
    }

    struct BetSimulation {
        uint256 fee;
        uint256 stakeNet;
        uint256 sharpnessBps;
        uint256 timeBps;
        uint256 qualityBps;
        uint256 weight;
        uint256 bucket;
        bool isValid;
        string errorMessage;
    }

    struct BucketInfo {
        uint256[] betIds;
        uint256 totalStaked;
        uint256 totalWeight;
        uint256 totalWinningWeight;
        uint256 nextProcessIndex;
        bool aggregationComplete;
    }

    // ==============================================================
    // |                    Mappings                               |
    // ==============================================================
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BucketInfo) public buckets;    // bucket => BucketInfo
    mapping(uint256 => uint256) public pricesAtTimestamp; // targetTimestamp => price

    // ==============================================================
    // |                    Events                                  |
    // ==============================================================
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 bucket,
        uint256 stake,
        uint256 priceMin,
        uint256 priceMax,
        uint256 targetTimestamp
    );
    
    event BetFinalized(
        uint256 indexed betId,
        uint256 actualPrice,
        bool won,
        uint256 payout
    );
    
    event BetClaimed(
        uint256 indexed betId,
        address indexed bettor,
        uint256 payout
    );
    
    event FeeCollected(uint256 amount);
    event BucketPriceSet(uint256 indexed bucket, uint256 price);
    event BatchProcessed(uint256 indexed bucket, uint256 processedCount, uint256 winningWeight);
    event AggregationCompleted(uint256 indexed bucket, uint256 totalWinningWeight);

    // ==============================================================
    // |                    Modifiers                               |
    // ==============================================================
    modifier validBetAmount(uint256 amount) {
        require(amount >= MIN_STAKE, "Bet too small");
        require(amount <= MAX_STAKE, "Bet too large");
        _;
    }

    modifier validTimeRange(uint256 targetTimestamp) {
        uint256 minTime = block.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY);
        uint256 maxTime = block.timestamp + (MAX_DAYS_AHEAD * SECONDS_PER_DAY);
        require(targetTimestamp >= minTime, "Target too soon");
        require(targetTimestamp <= maxTime, "Target too far");
        _;
    }

    // ==============================================================
    // |                    Constructor                             |
    // ==============================================================
    constructor() {
        startTimestamp = block.timestamp;
        transferOwnership(msg.sender);
    }

    // ==============================================================
    // |                    Core Functions                          |
    // ==============================================================

    /**
     * @notice Place a bet with ETH
     * @param targetTimestamp The target timestamp for the prediction
     * @param priceMin Minimum price in BPS
     * @param priceMax Maximum price in BPS
     * @return betId The ID of the placed bet
     */
    function placeBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax
    ) external payable validTimeRange(targetTimestamp) returns (uint256) {
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");
        require(targetTimestamp > block.timestamp, "Cannot bet on past timestamps");

        // Calculate fee and net stake
        uint256 fee = (msg.value * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = msg.value - fee;
        
        // Update fee collection
        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Compute bet quality and weight
        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Create bet
        return _createBet(msg.sender, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight);
    }

    /**
     * @notice Place multiple bets in a single transaction
     * @param targetTimestamps Array of target timestamps
     * @param priceMins Array of minimum prices in BPS
     * @param priceMaxs Array of maximum prices in BPS
     * @return betIds Array of bet IDs
     */
    function placeBatchBets(
        uint256[] calldata targetTimestamps,
        uint256[] calldata priceMins,
        uint256[] calldata priceMaxs,
        uint256[] calldata stakeAmounts
    ) external payable returns (uint256[] memory betIds) {
        require(
            targetTimestamps.length == priceMins.length && 
            priceMins.length == priceMaxs.length &&
            priceMaxs.length == stakeAmounts.length,
            "Array lengths must match"
        );
        require(targetTimestamps.length > 0, "Must place at least one bet");

        betIds = new uint256[](targetTimestamps.length);
        uint256 totalStake = 0;

        // Calculate total stake needed
        for (uint256 i = 0; i < targetTimestamps.length; i++) {
            require(targetTimestamps[i] > block.timestamp, "Cannot bet on past timestamps");
            require(
                targetTimestamps[i] >= block.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY) &&
                targetTimestamps[i] <= block.timestamp + (MAX_DAYS_AHEAD * SECONDS_PER_DAY),
                "Invalid time range"
            );

            totalStake += stakeAmounts[i];
        }

        // Place each bet
        for (uint256 i = 0; i < targetTimestamps.length; i++) {
            betIds[i] = _placeSingleBet(
                msg.sender,
                targetTimestamps[i],
                priceMins[i],
                priceMaxs[i],
                stakeAmounts[i]
            );
        }

        return betIds;
    }

    /**
     * @notice Internal helper function to place a single bet
     */
    function _placeSingleBet(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) internal returns (uint256) {
        // Calculate fee and net stake for this bet
        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;
        
        // Update fee collection
        totalFeesCollected += fee;
        emit FeeCollected(fee);

        // Create bet with simplified calculations
        uint256 sharpness = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeMultiplier = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpness * timeMultiplier) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;
        
        return _createBet(
            bettor, 
            targetTimestamp, 
            priceMin, 
            priceMax, 
            stakeNet, 
            qualityBps,
            weight
        );
    }

    /**
     * @notice Process next batch of bets for a bucket (anyone can call)
     * @param bucket The bucket index to process
     * @return processedCount Number of bets processed in this batch
     * @return winningWeight Total winning weight added in this batch
     */
    function processBatch(uint256 bucket) external returns (uint256 processedCount, uint256 winningWeight) {
        BucketInfo storage bucketInfo = buckets[bucket];
        require(!bucketInfo.aggregationComplete, "Aggregation already complete");
        
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        
        if (endIndex > bucketInfo.betIds.length) {
            endIndex = bucketInfo.betIds.length;
        }
        
        if (startIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
            return (0, 0);
        }
        
        uint256 batchWinningWeight = 0;
        uint256 processed = 0;
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            
            if (!bet.finalized) {
                uint256 price = pricesAtTimestamp[bet.targetTimestamp];
                require(price > 0, "Price not set for timestamp");
                
                bet.finalized = true;
                bet.actualPrice = price;
                bet.won = (price >= bet.priceMin && price <= bet.priceMax);
                
                if (bet.won) {
                    batchWinningWeight += bet.weight;
                }
                
                processed++;
            }
        }
        
        bucketInfo.totalWinningWeight += batchWinningWeight;
        bucketInfo.nextProcessIndex = endIndex;
        
        if (endIndex >= bucketInfo.betIds.length) {
            bucketInfo.aggregationComplete = true;
            emit AggregationCompleted(bucket, bucketInfo.totalWinningWeight);
        }
        
        emit BatchProcessed(bucket, processed, batchWinningWeight);
        return (processed, batchWinningWeight);
    }

    /**
     * @notice Claim winnings for a finalized bet (only after aggregation complete)
     * @param betId The ID of the bet to claim
     */
    function claimBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.finalized, "Bet not finalized");
        require(!bet.claimed, "Already claimed");

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];
        require(bucketInfo.aggregationComplete, "Aggregation not complete");

        bet.claimed = true;

        if (bet.won) {
            // Calculate payout based on winning weight
            uint256 payout = bucketInfo.totalWinningWeight > 0 ? 
                (bet.weight * bucketInfo.totalStaked) / bucketInfo.totalWinningWeight : 0;
            
            // Transfer winnings
            (bool success, ) = payable(msg.sender).call{value: payout}("");
            require(success, "Transfer failed");
            
            emit BetClaimed(betId, msg.sender, payout);
        } else {
            emit BetClaimed(betId, msg.sender, 0);
        }
    }

    // ==============================================================
    // |                    Oracle Functions                         |
    // ==============================================================

    /**
     * @notice Set prices for multiple timestamps at once (only owner)
     * @param timestamps Array of target timestamps
     * @param prices Array of corresponding prices
     */
    function setPricesForTimestamps(uint256[] calldata timestamps, uint256[] calldata prices) external {
        require(timestamps.length == prices.length, "Lengths must match");
        for (uint256 i = 0; i < timestamps.length; i++) {
            require(prices[i] > 0, "Price must be positive");
            pricesAtTimestamp[timestamps[i]] = prices[i];
            emit BucketPriceSet(timestamps[i], prices[i]);
        }
    }

    /**
     * @notice Set price for a single timestamp (only owner)
     * @param timestamp The target timestamp
     * @param price The actual price
     */
    function setPriceForTimestamp(uint256 timestamp, uint256 price) external {
        require(price > 0, "Price must be positive");
        pricesAtTimestamp[timestamp] = price;
        emit BucketPriceSet(timestamp, price);
    }



    // ==============================================================
    // |                    Admin Functions                           |
    // ==============================================================

    /**
     * @notice Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @notice Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    // ==============================================================
    // |                    Helper Functions                          |
    // ==============================================================

    /**
     * @notice Create a bet and emit event
     */
    function _createBet(
        address bettor,
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeNet,
        uint256 qualityBps,
        uint256 weight
    ) private returns (uint256) {
        uint256 betId = nextBetId++;
        uint256 bucket = bucketIndex(targetTimestamp);
        
        bets[betId] = Bet({
            bettor: bettor,
            targetTimestamp: targetTimestamp,
            priceMin: priceMin,
            priceMax: priceMax,
            stake: stakeNet,
            qualityBps: qualityBps,
            weight: weight,
            finalized: false,
            claimed: false,
            actualPrice: 0,
            won: false
        });

        // Track bet in bucket for batch processing
        buckets[bucket].betIds.push(betId);
        buckets[bucket].totalStaked += stakeNet;
        buckets[bucket].totalWeight += weight;

        emit BetPlaced(betId, bettor, bucket, stakeNet, priceMin, priceMax, targetTimestamp);
        return betId;
    }

    /**
     * @notice Map timestamp to bucket index
     */
    function bucketIndex(uint256 targetTs) public view returns (uint256) {
        require(targetTs >= startTimestamp, "Must be >= start");
        return (targetTs - startTimestamp) / SECONDS_PER_DAY;
    }

    /**
     * @notice Compute sharpness multiplier based on price range width
     */
    function getSharpnessMultiplier(
        uint256 priceMin,
        uint256 priceMax
    ) public pure returns (uint256) {
        uint256 range = priceMax - priceMin;
        uint256 averagePrice = (priceMin + priceMax) / 2;
        uint256 widthBps = averagePrice > 0 ? (range * BPS_DENOM) / averagePrice : 0;

        if (widthBps > 4000) {
            return 1000;  // 0.1×
        } else if (widthBps >= 2000) {
            return 3000;  // 0.3×
        } else if (widthBps >= 1000) {
            return 5000;  // 0.5×
        } else if (widthBps >= 500) {
            return 10000; // 1×
        } else if (widthBps >= 200) {
            return 15000; // 1.5×
        } else {
            return 20000; // 2× for very sharp (<2%)
        }
    }

    /**
     * @notice Compute time multiplier based on lead time
     */
    function getTimeMultiplier(
        uint256 targetTimestamp
    ) public view returns (uint256) {
        uint256 delta = targetTimestamp - block.timestamp;

        if (delta >= 4 * SECONDS_PER_DAY) {
            return 20000; // >4 days → 2×
        } else if (delta >= 2 * SECONDS_PER_DAY) {
            return 15000; // 2–4 days → 1.5×
        } else if (delta >= 1 * SECONDS_PER_DAY) {
            return 10000; // 1–2 days → 1×
        } else if (delta >= 8 * 60 * 60) {
            return 5000;  // 8–24 h → 0.5×
        } else if (delta >= 2 * 60 * 60) {
            return 3000;  // 2–4 h → 0.3×
        } else if (delta >= 1 * 60 * 60) {
            return 1000;  // 1–2 h → 0.1×
        } else {
            return 1000;  // < 1 h → 0.1×
        }
    }

    // ==============================================================
    // |                    View Functions                            |
    // ==============================================================

    /**
     * @notice Get bet details
     */
    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    /**
     * @notice Simulate a bet placement
     */
    function simulatePlaceBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external view returns (BetSimulation memory) {
        // Validate inputs
        if (targetTimestamp <= block.timestamp) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Must be future timestamp"
            });
        }
        
        if (priceMin >= priceMax) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid price range"
            });
        }
        
        if (stakeAmount < MIN_STAKE || stakeAmount > MAX_STAKE) {
            return BetSimulation({
                fee: 0, stakeNet: 0, sharpnessBps: 0, timeBps: 0, qualityBps: 0, weight: 0, bucket: 0,
                isValid: false, errorMessage: "Invalid stake amount"
            });
        }

        // Calculate fee and net stake
        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;

        // Calculate multipliers
        uint256 sharpnessBps = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeBps = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;

        // Calculate weight
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        // Calculate bucket
        uint256 bucket = bucketIndex(targetTimestamp);

        return BetSimulation({
            fee: fee,
            stakeNet: stakeNet,
            sharpnessBps: sharpnessBps,
            timeBps: timeBps,
            qualityBps: qualityBps,
            weight: weight,
            bucket: bucket,
            isValid: true,
            errorMessage: ""
        });
    }

    /**
     * @notice Get bucket statistics
     */
    function getBucketStats(uint256 bucket) external view returns (uint256 totalStaked, uint256 totalWeight, uint256 price) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (bucketInfo.totalStaked, bucketInfo.totalWeight, pricesAtTimestamp[bucket]);
    }

    /**
     * @notice Get bucket aggregation status
     */
    function getBucketInfo(uint256 bucket) external view returns (
        uint256 totalBets,
        uint256 totalWinningWeight,
        uint256 nextProcessIndex,
        bool aggregationComplete
    ) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (
            bucketInfo.betIds.length,
            bucketInfo.totalWinningWeight,
            bucketInfo.nextProcessIndex,
            bucketInfo.aggregationComplete
        );
    }

    /**
     * @notice Get batch processing info for a bucket
     */
    function getBatchInfo(uint256 bucket) external view returns (
        uint256 nextBatchStart,
        uint256 nextBatchEnd,
        uint256 remainingBets,
        bool canProcess
    ) {
        BucketInfo storage bucketInfo = buckets[bucket];
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        
        if (endIndex > bucketInfo.betIds.length) {
            endIndex = bucketInfo.betIds.length;
        }
        
        uint256 remaining = bucketInfo.betIds.length - startIndex;
        bool canProcessBatch = !bucketInfo.aggregationComplete && remaining > 0;
        
        return (startIndex, endIndex, remaining, canProcessBatch);
    }

    /**
     * @notice Check if all timestamps in a bucket have prices set
     */
    function arePricesSetForBucket(uint256 bucket) external view returns (bool) {
        BucketInfo storage bucketInfo = buckets[bucket];
        for (uint256 i = 0; i < bucketInfo.betIds.length; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            if (pricesAtTimestamp[bet.targetTimestamp] == 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * @notice Get price for a specific timestamp
     */
    function getPriceAtTimestamp(uint256 timestamp) external view returns (uint256) {
        return pricesAtTimestamp[timestamp];
    }

    /**
     * @notice Get contract statistics
     */
    function getStats() external view returns (
        uint256 totalBets,
        uint256 totalFees,
        uint256 contractBalance
    ) {
        return (nextBetId, totalFeesCollected, address(this).balance);
    }
}
