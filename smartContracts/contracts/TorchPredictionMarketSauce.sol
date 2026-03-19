// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TorchPredictionMarketSauce
 * @notice Prediction market that resolves against token price buckets (via oracle-set prices),
 *         while staking and paying out in an ERC-20 token (SAUCE in your use-case).
 *
 *         The bucket/bet math is identical to `TorchPredictionMarket.sol`, except:
 *         - bets use `stakeToken` (ERC-20) instead of `msg.value` (native token)
 *         - payouts and fee withdrawal use ERC-20 transfers instead of native ETH/HBAR transfers
 */
contract TorchPredictionMarketSauce is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==============================================================
    // |                    Constants                               |
    // ==============================================================
    uint256 public immutable startTimestamp;

    uint256 public constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint256 public constant FEE_BPS = 50; // 0.5%
    uint256 public constant BPS_DENOM = 10000; // 100%

    // Days constraints for placing bets (same as TorchPredictionMarket.sol)
    uint256 public constant MAX_DAYS_AHEAD = 30;
    uint256 public constant MIN_DAYS_AHEAD = 1;

    uint256 public constant BATCH_SIZE = 50;

    // ==============================================================
    // |                    Token configuration                      |
    // ==============================================================
    IERC20 public immutable stakeToken;
    uint8 public immutable stakeTokenDecimals;

    // Stake bounds are computed from token decimals:
    // - min stake = 0.01 token
    // - max stake = 100 token
    uint256 public minStake;
    uint256 public maxStake;

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
        uint256 stake; // net stake after fee
        uint256 qualityBps;
        uint256 weight;
        bool finalized;
        bool claimed;
        uint256 actualPrice;
        bool won;
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
        uint256 totalStaked; // sum of net stakes (after fees)
        uint256 totalWeight; // sum of bet weights
        uint256 totalWinningWeight; // sum of weights for winning bets
        uint256 nextProcessIndex;
        bool aggregationComplete;
    }

    // ==============================================================
    // |                    Mappings                               |
    // ==============================================================
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => BucketInfo) public buckets;
    mapping(uint256 => uint256) public pricesAtTimestamp; // targetTimestamp => price (BPS-style units)

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
    // |                    Modifiers                              |
    // ==============================================================
    modifier validBetAmount(uint256 amount) {
        require(amount >= minStake, "Bet too small");
        require(amount <= maxStake, "Bet too large");
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
    constructor(address stakeToken_) {
        require(stakeToken_ != address(0), "stakeToken == 0");
        stakeToken = IERC20(stakeToken_);
        stakeTokenDecimals = IERC20Metadata(stakeToken_).decimals();

        require(stakeTokenDecimals > 0, "decimals == 0");

        // Compute:
        // minStake = 0.01 token
        // maxStake = 100 token
        uint256 tenPow = 10 ** uint256(stakeTokenDecimals);
        uint256 computedMin = tenPow / 100;
        uint256 computedMax = tenPow * 100;
        // If decimals are small, computedMin may round down to 0.
        minStake = computedMin == 0 ? 1 : computedMin;
        maxStake = computedMax;

        startTimestamp = block.timestamp;
        transferOwnership(msg.sender);
    }

    // ==============================================================
    // |                    Core Functions                         |
    // ==============================================================

    /**
     * @notice Place a bet by staking `stakeToken`
     * @param targetTimestamp Prediction resolution timestamp
     * @param priceMin Minimum price in BPS-units
     * @param priceMax Maximum price in BPS-units
     * @param stakeAmount Amount of `stakeToken` to stake (gross, before fee)
     * @return betId The ID of the placed bet
     */
    function placeBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external nonReentrant whenNotPaused validTimeRange(targetTimestamp) validBetAmount(stakeAmount) returns (uint256) {
        require(priceMin < priceMax, "Invalid price range");
        require(priceMin > 0 && priceMax > 0, "Prices must be positive");

        // Pull tokens first to ensure we fail before mutating state.
        stakeToken.safeTransferFrom(msg.sender, address(this), stakeAmount);

        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;

        totalFeesCollected += fee;
        emit FeeCollected(fee);

        uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(targetTimestamp)) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

        return _createBet(msg.sender, targetTimestamp, priceMin, priceMax, stakeNet, qualityBps, weight);
    }

    /**
     * @notice Place multiple bets in one transaction
     */
    function placeBatchBets(
        uint256[] calldata targetTimestamps,
        uint256[] calldata priceMins,
        uint256[] calldata priceMaxs,
        uint256[] calldata stakeAmounts
    ) external whenNotPaused nonReentrant returns (uint256[] memory betIds) {
        require(
            targetTimestamps.length == priceMins.length &&
                priceMins.length == priceMaxs.length &&
                priceMaxs.length == stakeAmounts.length,
            "Array lengths must match"
        );
        require(targetTimestamps.length > 0, "Must place at least one bet");

        betIds = new uint256[](targetTimestamps.length);

        uint256 totalStake = 0;
        for (uint256 i = 0; i < targetTimestamps.length; i++) {
            uint256 ts = targetTimestamps[i];
            require(ts > block.timestamp, "Cannot bet on past timestamps");
            require(ts >= block.timestamp + (MIN_DAYS_AHEAD * SECONDS_PER_DAY), "Invalid time range");
            require(ts <= block.timestamp + (MAX_DAYS_AHEAD * SECONDS_PER_DAY), "Invalid time range");

            uint256 stakeAmount = stakeAmounts[i];
            require(stakeAmount >= minStake && stakeAmount <= maxStake, "Bet amount out of bounds");
            totalStake += stakeAmount;
        }

        // One transferFrom for gas efficiency.
        stakeToken.safeTransferFrom(msg.sender, address(this), totalStake);

        for (uint256 i = 0; i < targetTimestamps.length; i++) {
            uint256 ts = targetTimestamps[i];
            uint256 priceMin = priceMins[i];
            uint256 priceMax = priceMaxs[i];
            uint256 stakeAmount = stakeAmounts[i];

            require(priceMin < priceMax, "Invalid price range");
            require(priceMin > 0 && priceMax > 0, "Prices must be positive");

            uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
            uint256 stakeNet = stakeAmount - fee;

            totalFeesCollected += fee;
            emit FeeCollected(fee);

            uint256 qualityBps = (getSharpnessMultiplier(priceMin, priceMax) * getTimeMultiplier(ts)) / BPS_DENOM;
            uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;

            betIds[i] = _createBet(msg.sender, ts, priceMin, priceMax, stakeNet, qualityBps, weight);
        }

        return betIds;
    }

    /**
     * @notice Process next batch of bets for a bucket (anyone can call)
     */
    function processBatch(uint256 bucket) external nonReentrant returns (uint256 processedCount, uint256 winningWeight) {
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

                uint256 payout = 0;
                if (bet.won) {
                    batchWinningWeight += bet.weight;
                }

                processed++;

                // Keep event signature parity; actual payout is computed later in claimBet.
                emit BetFinalized(betId, price, bet.won, payout);
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
     */
    function claimBet(uint256 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        require(bet.bettor == msg.sender, "Not bet owner");
        require(bet.finalized, "Bet not finalized");
        require(!bet.claimed, "Already claimed");

        uint256 bucket = bucketIndex(bet.targetTimestamp);
        BucketInfo storage bucketInfo = buckets[bucket];
        require(bucketInfo.aggregationComplete, "Aggregation not complete");

        bet.claimed = true;

        if (bet.won) {
            uint256 payout = bucketInfo.totalWinningWeight > 0
                ? (bet.weight * bucketInfo.totalStaked) / bucketInfo.totalWinningWeight
                : 0;

            stakeToken.safeTransfer(msg.sender, payout);
            emit BetClaimed(betId, msg.sender, payout);
        } else {
            emit BetClaimed(betId, msg.sender, 0);
        }
    }

    // ==============================================================
    // |                    Oracle Functions                         |
    // ==============================================================

    function setPricesForTimestamps(uint256[] calldata timestamps, uint256[] calldata prices) external onlyOwner {
        require(timestamps.length == prices.length, "Lengths must match");
        for (uint256 i = 0; i < timestamps.length; i++) {
            require(prices[i] > 0, "Price must be positive");
            pricesAtTimestamp[timestamps[i]] = prices[i];
            uint256 bucket = bucketIndex(timestamps[i]);
            emit BucketPriceSet(bucket, prices[i]);
        }
    }

    function setPriceForTimestamp(uint256 timestamp, uint256 price) external onlyOwner {
        require(price > 0, "Price must be positive");
        pricesAtTimestamp[timestamp] = price;
        uint256 bucket = bucketIndex(timestamp);
        emit BucketPriceSet(bucket, price);
    }

    // ==============================================================
    // |                    Admin Functions                         |
    // ==============================================================

    function withdrawFees() external onlyOwner {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        stakeToken.safeTransfer(owner(), amount);
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 balance = stakeToken.balanceOf(address(this));
        stakeToken.safeTransfer(owner(), balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==============================================================
    // |                    Helper Functions                       |
    // ==============================================================

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

        buckets[bucket].betIds.push(betId);
        buckets[bucket].totalStaked += stakeNet;
        buckets[bucket].totalWeight += weight;

        emit BetPlaced(betId, bettor, bucket, stakeNet, priceMin, priceMax, targetTimestamp);
        return betId;
    }

    function bucketIndex(uint256 targetTs) public view returns (uint256) {
        require(targetTs >= startTimestamp, "Must be >= start");
        return (targetTs - startTimestamp) / SECONDS_PER_DAY;
    }

    function getSharpnessMultiplier(uint256 priceMin, uint256 priceMax) public pure returns (uint256) {
        uint256 range = priceMax - priceMin;
        uint256 averagePrice = (priceMin + priceMax) / 2;
        uint256 widthBps = averagePrice > 0 ? (range * BPS_DENOM) / averagePrice : 0;

        if (widthBps > 4000) return 1000; // 0.1x
        if (widthBps >= 2000) return 3000; // 0.3x
        if (widthBps >= 1000) return 5000; // 0.5x
        if (widthBps >= 500) return 10000; // 1x
        if (widthBps >= 200) return 15000; // 1.5x
        return 20000; // 2x
    }

    function getTimeMultiplier(uint256 targetTimestamp) public view returns (uint256) {
        uint256 delta = targetTimestamp - block.timestamp;

        if (delta >= 4 * SECONDS_PER_DAY) return 20000; // 2x
        if (delta >= 2 * SECONDS_PER_DAY) return 15000; // 1.5x
        if (delta >= 1 * SECONDS_PER_DAY) return 10000; // 1x
        if (delta >= 8 * 60 * 60) return 5000; // 0.5x
        if (delta >= 2 * 60 * 60) return 3000; // 0.3x
        if (delta >= 1 * 60 * 60) return 1000; // 0.1x
        return 1000; // < 1h => 0.1x
    }

    // ==============================================================
    // |                    View Functions                          |
    // ==============================================================

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function simulatePlaceBet(
        uint256 targetTimestamp,
        uint256 priceMin,
        uint256 priceMax,
        uint256 stakeAmount
    ) external view returns (BetSimulation memory) {
        if (targetTimestamp <= block.timestamp) {
            return BetSimulation({
                fee: 0,
                stakeNet: 0,
                sharpnessBps: 0,
                timeBps: 0,
                qualityBps: 0,
                weight: 0,
                bucket: 0,
                isValid: false,
                errorMessage: "Must be future timestamp"
            });
        }

        if (priceMin >= priceMax) {
            return BetSimulation({
                fee: 0,
                stakeNet: 0,
                sharpnessBps: 0,
                timeBps: 0,
                qualityBps: 0,
                weight: 0,
                bucket: 0,
                isValid: false,
                errorMessage: "Invalid price range"
            });
        }

        if (stakeAmount < minStake || stakeAmount > maxStake) {
            return BetSimulation({
                fee: 0,
                stakeNet: 0,
                sharpnessBps: 0,
                timeBps: 0,
                qualityBps: 0,
                weight: 0,
                bucket: 0,
                isValid: false,
                errorMessage: "Invalid stake amount"
            });
        }

        uint256 fee = (stakeAmount * FEE_BPS) / BPS_DENOM;
        uint256 stakeNet = stakeAmount - fee;
        uint256 sharpnessBps = getSharpnessMultiplier(priceMin, priceMax);
        uint256 timeBps = getTimeMultiplier(targetTimestamp);
        uint256 qualityBps = (sharpnessBps * timeBps) / BPS_DENOM;
        uint256 weight = (stakeNet * qualityBps) / BPS_DENOM;
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

    function getBucketStats(uint256 bucket) external view returns (uint256 totalStaked, uint256 totalWeight, uint256 price) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (bucketInfo.totalStaked, bucketInfo.totalWeight, pricesAtTimestamp[bucket]);
    }

    function getBucketInfo(uint256 bucket) external view returns (uint256 totalBets, uint256 totalWinningWeight, uint256 nextProcessIndex, bool aggregationComplete) {
        BucketInfo storage bucketInfo = buckets[bucket];
        return (
            bucketInfo.betIds.length,
            bucketInfo.totalWinningWeight,
            bucketInfo.nextProcessIndex,
            bucketInfo.aggregationComplete
        );
    }

    function getBatchInfo(uint256 bucket)
        external
        view
        returns (uint256 nextBatchStart, uint256 nextBatchEnd, uint256 remainingBets, bool canProcess)
    {
        BucketInfo storage bucketInfo = buckets[bucket];
        uint256 startIndex = bucketInfo.nextProcessIndex;
        uint256 endIndex = startIndex + BATCH_SIZE;
        if (endIndex > bucketInfo.betIds.length) endIndex = bucketInfo.betIds.length;

        uint256 remaining = bucketInfo.betIds.length - startIndex;
        bool canProcessBatch = !bucketInfo.aggregationComplete && remaining > 0;
        return (startIndex, endIndex, remaining, canProcessBatch);
    }

    function arePricesSetForBucket(uint256 bucket) external view returns (bool) {
        BucketInfo storage bucketInfo = buckets[bucket];
        for (uint256 i = 0; i < bucketInfo.betIds.length; i++) {
            uint256 betId = bucketInfo.betIds[i];
            Bet storage bet = bets[betId];
            if (pricesAtTimestamp[bet.targetTimestamp] == 0) return false;
        }
        return true;
    }

    function getPriceAtTimestamp(uint256 timestamp) external view returns (uint256) {
        return pricesAtTimestamp[timestamp];
    }

    function getStats() external view returns (uint256 totalBets, uint256 totalFees, uint256 contractTokenBalance) {
        // totalBets is nextBetId in this contract style
        return (nextBetId, totalFeesCollected, stakeToken.balanceOf(address(this)));
    }
}

