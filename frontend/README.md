# Torch Frontend

A modern Next.js frontend for the Torch cryptocurrency prediction market platform, built with Tailwind CSS, Radix UI, and Hedera wallet tooling (`@buidlerlabs/hashgraph-react-wallets` + WalletConnect).

## End User Features

Torch provides a comprehensive prediction market interface with the following capabilities:

| Feature | Description |
|---------|-------------|
| 🎯 **Place a bet** | Predict HBAR price ranges with custom time horizons |
| 📊 **View signals** | Real-time price forecasting and market visualization |
| 📈 **View activity** | Track bet history, status, and performance |
| 🏆 **Claim rewards** | Collect winnings from successful predictions |
| ⚙️ **Admin panel** | Batch processing and bet resolution (Clerk authentication) |

## Technical Features

- 💰 **Wallet Integration** - HashPack (primary), WalletConnect, and other Hedera wallets
- 📊 **Interactive KDE Charts** - Kernel Density Estimation visualization with confidence hover states
- 🎯 **Price Range Selection** - Interactive histogram for bet distribution visualization
- 📱 **Responsive Design** - Mobile-first design with Tailwind CSS
- ⚡ **Modern Stack** - Next.js 14, TypeScript, and modern React patterns
- 🎭 **Accessible UI** - Built with Radix UI primitives for accessibility
- 💲 **Real-time HBAR Prices** - CoinGecko API integration with 30-second updates
- 🔔 **Toast Notifications** - Real-time feedback for user actions

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI + shadcn/ui
- **Wallet Integration**: @buidlerlabs/hashgraph-react-wallets (HashPack + WalletConnect)
- **Charts**: Recharts for data visualization
- **Authentication**: Clerk (admin panel)
- **Data**: Apollo Client + GraphQL
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file in the root directory:

   ```env
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Main page component
├── components/            # React components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   ├── header.tsx        # Main header with navigation
│   ├── prediction-card.tsx # Main prediction interface
│   ├── kde-chart.tsx     # Interactive KDE visualization
│   ├── price-range-selector.tsx # Price range selection
│   ├── bet-history.tsx   # Bet history table
│   ├── hbar-price-display.tsx # HBAR price component
│   └── wallet-selector.tsx # Wallet connection component
├── lib/                  # Utility functions and configurations
│   ├── utils.ts          # Common utility functions
│   ├── apolloClient.ts   # GraphQL client configuration
│   ├── coingecko.ts      # HBAR price API integration
│   └── types.ts          # TypeScript type definitions
└── types/                # TypeScript type definitions
```

## Key Components

### PredictionCard

The main interface component that contains:

- Bet placement interface
- Interactive price range selector
- KDE forecast visualization
- Bet history table

### KDEChart

Interactive Kernel Density Estimation chart that:

- Shows price forecasts over time
- Displays confidence percentages on hover
- Uses Recharts for smooth animations

### PriceRangeSelector

Interactive histogram component that:

- Visualizes bet distribution
- Allows range selection with visual feedback
- Shows current price indicator

### Header

Navigation header with:

- Torch branding
- Wallet connection status
- HBAR balance display
- Account address with copy functionality
- Website link

## Wallet Integration

The app uses Hedera-specific wallet integration:

- **Primary Wallet**: HashPack (recommended)
- **Additional Support**: WalletConnect, other Hedera-compatible wallets
- **Network**: Hedera Mainnet (production ready)
- **Features**: Balance display, transaction signing, bet placement, reward claiming

## Styling

The app uses a custom design system built on Tailwind CSS:

- **Colors**: Custom torch color palette (purple, green, red, orange, blue)
- **Design**: Dark theme with consistent design tokens and spacing
- **Components**: Reusable UI components with Tailwind classes

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

Torch is part of the **Origins and Ascension hackathons**. This project is licensed under the MIT License.

## Planned Features

- 🎨 **Theme support** - Dark/light mode toggle (component exists but not implemented in UI)
- 📱 **Mobile optimization** - Enhanced mobile experience
- 🤖 **AI agent integration** - Automated prediction strategies
- 📊 **Advanced analytics** - Detailed performance metrics
- 🔔 **Push notifications** - Real-time bet status updates
