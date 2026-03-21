# Torch Frontend

A modern Next.js frontend for Torch prediction markets on Hedera, built with Tailwind CSS, Radix UI, Apollo GraphQL, and Hedera wallet tooling (`@buidlerlabs/hashgraph-react-wallets` + WalletConnect).

## End User Features

Torch currently provides:

| Feature | Description |
|---|---|
| 🧭 **Market-first landing** | Home page shows market rows (HBAR + SAUCE) with live price metrics |
| 🎯 **HBAR betting flow** | Click HBAR row to open full prediction card and place bets |
| 📊 **Forecast + history tabs** | KDE forecast view and bet history integrated in prediction UI |
| 🧾 **Resolution dashboard** | `/oracle` with Overview, Unresolved, Buckets, Resolver Runs |
| 👛 **Wallet-native UX** | Connect wallet, view balance, submit contract transactions |
| ⚙️ **Admin tools** | `/admin` panel remains available for operator workflows |

## Current Market Availability

- **HBAR**: active market (fully functional prediction flow).
- **SAUCE**: listed with live price, marked **Coming soon** (not clickable for betting).

## Technical Features

- 💰 **Hedera wallet integration** (HashPack primary + WalletConnect ecosystem)
- 📉 **Interactive prediction UI** with range selection and quality multipliers
- 📊 **KDE charting** for forecast visualization
- 🔗 **Subgraph-backed views** via Apollo GraphQL queries
- ⚡ **Live market pricing**:
  - HBAR via on-chain feed hook
  - SAUCE via CoinGecko simple-price endpoint
- 🎨 **Dark glass design system** with custom global tokens and polished hover states

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + custom tokens/utilities
- **UI Components**: Radix UI + shadcn/ui
- **Data Layer**: Apollo Client + GraphQL
- **Wallet Layer**: `@buidlerlabs/hashgraph-react-wallets`
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `frontend/.env.local`:

   ```env
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
   NEXT_PUBLIC_CONTRACT_ID=0.0.xxxxx
   NEXT_PUBLIC_SUBGRAPH_URL=https://your-subgraph-endpoint
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

### Environment Notes

- `NEXT_PUBLIC_CONTRACT_ID` is required for contract write actions (placing bets).
- `NEXT_PUBLIC_SUBGRAPH_URL` powers oracle/subgraph-backed market views.

## Project Structure

```text
src/
├── app/
│   ├── page.tsx                      # Market rows landing (HBAR + SAUCE)
│   ├── oracle/page.tsx               # Resolution dashboard
│   ├── my-bets/page.tsx              # User bets page
│   ├── admin/page.tsx                # Admin page
│   ├── globals.css                   # Global styling + dark/glass utilities
│   └── layout.tsx                    # Root layout/providers
├── components/
│   ├── features/prediction/          # PredictionCard and related modules
│   ├── layout/                       # Header + page layout components
│   ├── oracle/                       # Oracle-specific UI cards/charts
│   └── ui/                           # Shared UI primitives
├── hooks/
│   └── useHbarPrice.ts               # Live HBAR pricing hook
└── lib/
    ├── apolloClient.ts
    ├── coingecko.ts
    ├── motion.ts
    └── utils.ts
```

## Key Components

### Home Market Rows (`src/app/page.tsx`)

- Displays market rows styled as glassy table-like cards.
- HBAR row is clickable and opens the active prediction flow.
- SAUCE row shows live price and 24h change, but remains non-interactive.

### PredictionCard (`src/components/features/prediction/PredictionCard/PredictionCard.tsx`)

- Main prediction experience for HBAR.
- Includes bet flow, forecast tab, and history tab.

### Oracle Dashboard (`src/app/oracle/page.tsx`)

- Includes:
  - Overview metrics
  - Unresolved bets view
  - Bucket cards
  - Resolver run inspection

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - build for production
- `npm run start` - run production build
- `npm run lint` - run ESLint

## License

Torch is part of the Origins/Ascension hackathon workstream and follows the repository license.
