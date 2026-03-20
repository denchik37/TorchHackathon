# TorchPredictionMarket Hook

This hook provides a comprehensive interface for interacting with the TorchPredictionMarket smart contract using Hashgraph React Wallet hooks.

## Installation

Make sure you have the required dependencies:

```bash
npm install ethers@^5.8.0
```

## Setup

1. Set the contract address in your environment variables:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x6e612d342DBaa17EA17c4a8Fe95553C0594E052B
```

2. Import and use the hook in your component:

```tsx
import { useTorchPredictionMarket } from '../hooks/useTorchPredictionMarket';

function MyComponent() {
  const {
    contract,
    loading,
    error,
    isConnected,
    placeBet,
    getStats,
    // ... other functions
  } = useTorchPredictionMarket();

  // Your component logic
}
```

## Features

### State Management
- **contract**: The ethers contract instance
- **loading**: Boolean indicating if a transaction is in progress
- **error**: Current error message (if any)
- **isConnected**: Boolean indicating if wallet is connected
- **accountId**: Current account ID
- **evmAddress**: Current EVM address

### View Functions (Read-only)

#### Contract Information
- `getConstants()` - Get contract constants (batch size, fees, etc.)
- `getStats()` - Get contract statistics (total bets, fees, balance)
- `getNextBetId()` - Get the next bet ID
- `isPaused()` - Check if contract is paused
- `getOwner()` - Get contract owner address
- `getTotalFeesCollected()` - Get total fees collected
- `getStartTimestamp()` - Get contract start timestamp

#### Bet Information
- `getBet(betId: string)` - Get bet details by ID
- `simulatePlaceBet(targetTimestamp, priceMin, priceMax, stakeAmount)` - Simulate placing a bet

#### Bucket Information
- `getBucketInfo(bucket: string)` - Get bucket information
- `getBucketStats(bucket: string)` - Get bucket statistics
- `getBatchInfo(bucket: string)` - Get batch processing information
- `arePricesSetForBucket(bucket: string)` - Check if prices are set for bucket

#### Price Information
- `getPriceAtTimestamp(timestamp: string)` - Get price at specific timestamp
- `getBucketIndex(targetTimestamp: string)` - Get bucket index for timestamp

#### Multipliers
- `getTimeMultiplier(targetTimestamp: string)` - Get time multiplier
- `getSharpnessMultiplier(priceMin: string, priceMax: string)` - Get sharpness multiplier

### Write Functions (Transactions)

#### Betting
- `placeBet(targetTimestamp, priceMin, priceMax, value)` - Place a single bet
- `placeBatchBets(targetTimestamps, priceMins, priceMaxs, value)` - Place multiple bets
- `claimBet(betId)` - Claim a bet

#### Admin Functions (Owner Only)
- `setPriceForTimestamp(timestamp, price)` - Set price for timestamp
- `setPricesForTimestamps(timestamps, prices)` - Set prices for multiple timestamps
- `withdrawFees()` - Withdraw collected fees
- `pause()` - Pause the contract
- `unpause()` - Unpause the contract
- `transferOwnership(newOwner)` - Transfer contract ownership
- `renounceOwnership()` - Renounce contract ownership

#### Emergency Functions
- `emergencyWithdraw()` - Emergency withdrawal
- `processBatch(bucket)` - Process a batch of bets

## Usage Examples

### Basic Usage

```tsx
import { useTorchPredictionMarket } from '../hooks/useTorchPredictionMarket';

function BettingComponent() {
  const {
    isConnected,
    loading,
    error,
    placeBet,
    simulatePlaceBet,
    getStats
  } = useTorchPredictionMarket();

  const handlePlaceBet = async () => {
    try {
      const betId = await placeBet(
        '1704067200', // target timestamp
        '1000000000000000000', // price min (1 ETH in wei)
        '2000000000000000000', // price max (2 ETH in wei)
        '0.001' // stake amount in ETH
      );
      console.log('Bet placed with ID:', betId);
    } catch (err) {
      console.error('Failed to place bet:', err);
    }
  };

  const handleSimulateBet = async () => {
    try {
      const simulation = await simulatePlaceBet(
        '1704067200',
        '1000000000000000000',
        '2000000000000000000',
        '1000000000000000000' // stake amount in wei
      );
      console.log('Simulation result:', simulation);
    } catch (err) {
      console.error('Failed to simulate bet:', err);
    }
  };

  if (!isConnected) {
    return <div>Please connect your wallet</div>;
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {loading && <div>Loading...</div>}
      
      <button onClick={handleSimulateBet}>Simulate Bet</button>
      <button onClick={handlePlaceBet}>Place Bet</button>
    </div>
  );
}
```

### Advanced Usage with Stats

```tsx
function ContractStats() {
  const { getStats, getConstants } = useTorchPredictionMarket();
  const [stats, setStats] = useState(null);
  const [constants, setConstants] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      const [statsData, constantsData] = await Promise.all([
        getStats(),
        getConstants()
      ]);
      setStats(statsData);
      setConstants(constantsData);
    };
    loadData();
  }, []);

  return (
    <div>
      {stats && (
        <div>
          <h3>Contract Stats</h3>
          <p>Total Bets: {stats.totalBets}</p>
          <p>Total Fees: {stats.totalFees}</p>
          <p>Contract Balance: {stats.contractBalance}</p>
        </div>
      )}
      
      {constants && (
        <div>
          <h3>Contract Constants</h3>
          <p>Fee BPS: {constants.feeBps}</p>
          <p>Max Stake: {constants.maxStake}</p>
          <p>Min Stake: {constants.minStake}</p>
        </div>
      )}
    </div>
  );
}
```

### Batch Operations

```tsx
function BatchBetting() {
  const { placeBatchBets } = useTorchPredictionMarket();

  const handleBatchBet = async () => {
    const targetTimestamps = ['1704067200', '1704153600', '1704240000'];
    const priceMins = ['1000000000000000000', '1100000000000000000', '1200000000000000000'];
    const priceMaxs = ['2000000000000000000', '2100000000000000000', '2200000000000000000'];
    
    try {
      const betIds = await placeBatchBets(
        targetTimestamps,
        priceMins,
        priceMaxs,
        '0.003' // total value for all bets
      );
      console.log('Batch bet IDs:', betIds);
    } catch (err) {
      console.error('Failed to place batch bets:', err);
    }
  };

  return <button onClick={handleBatchBet}>Place Batch Bets</button>;
}
```

## Error Handling

The hook provides comprehensive error handling:

```tsx
const { error, clearError } = useTorchPredictionMarket();

// Display error
{error && (
  <div className="error">
    {error}
    <button onClick={clearError}>Clear Error</button>
  </div>
)}

// Handle errors in function calls
const handlePlaceBet = async () => {
  try {
    await placeBet(/* params */);
  } catch (err) {
    // Error is automatically set in the hook state
    console.error('Transaction failed:', err);
  }
};
```

## Loading States

The hook provides loading state management:

```tsx
const { loading } = useTorchPredictionMarket();

// Disable buttons during transactions
<button disabled={loading} onClick={handlePlaceBet}>
  {loading ? 'Placing Bet...' : 'Place Bet'}
</button>
```

## TypeScript Support

The hook includes comprehensive TypeScript types:

```tsx
import { 
  Bet, 
  BetSimulation, 
  BucketInfo, 
  BucketStats, 
  ContractStats 
} from '../hooks/useTorchPredictionMarket';

// Use types in your components
const [bet, setBet] = useState<Bet | null>(null);
const [simulation, setSimulation] = useState<BetSimulation | null>(null);
```

## Environment Variables

Make sure to set the contract address in your environment:

```env
# .env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=0x6e612d342DBaa17EA17c4a8Fe95553C0594E052B
```

## Dependencies

- `@buidlerlabs/hashgraph-react-wallets` - For wallet integration
- `ethers` - For Ethereum contract interaction
- React hooks (`useState`, `useCallback`, `useEffect`)

## Notes

- All amounts for `placeBet` and `placeBatchBets` should be in ETH (the hook converts to wei)
- All amounts for `simulatePlaceBet` should be in wei
- The hook automatically handles wallet connection and contract initialization
- All write functions return promises that resolve when the transaction is confirmed
- View functions return promises that resolve immediately with the data
