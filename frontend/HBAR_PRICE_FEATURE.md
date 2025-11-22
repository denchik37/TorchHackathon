# HBAR Price Integration

This feature automatically displays and updates HBAR prices in USD using the CoinGecko API.

## Features

- **Real-time HBAR prices** from CoinGecko API
- **Automatic updates** every 30 seconds
- **24-hour price change** with visual indicators
- **Loading and error states** for better UX
- **Reusable components** for consistent display

## Components

### `useHbarPrice` Hook
- Fetches HBAR price data from CoinGecko API
- Handles loading and error states
- Auto-updates every 30 seconds
- Returns: `{ price, priceChangePercentage, isLoading, error }`

### `HbarPriceDisplay` Component
- Reusable component for displaying HBAR prices
- Supports different sizes: `sm`, `md`, `lg`
- Optional price change indicators
- Optional HBAR icon
- Loading spinner and error states

## Usage

```tsx
// Basic usage
<HbarPriceDisplay />

// Customized display
<HbarPriceDisplay 
  size="lg" 
  showChange={false} 
  showIcon={false} 
  className="my-custom-class" 
/>

// Using the hook directly
const { price, priceChangePercentage, isLoading, error } = useHbarPrice();
```

## API Integration

The feature uses the CoinGecko API endpoint:
```
https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true
```

## Files Modified

- `src/hooks/useHbarPrice.ts` - Custom hook for price fetching
- `src/components/hbar-price-display.tsx` - Reusable price display component
- `src/components/header.tsx` - Updated to show real-time HBAR price
- `src/components/prediction-card.tsx` - Updated to use real-time price
- `src/lib/coingecko.ts` - Utility functions for API integration

## Error Handling

- Network errors are caught and displayed
- API rate limiting is handled gracefully
- Fallback states for loading and error conditions
- Automatic retry on next update cycle

## Performance

- 30-second update interval (configurable)
- Efficient re-renders with React hooks
- Cleanup on component unmount
- Minimal API calls with proper caching 