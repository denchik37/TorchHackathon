# 🔥 Torch Subgraph
> Subgraph for indexing the TorchPredictionMarket smart contract events on **Hedera**

This repository defines the GraphQL schema, event mappings, and configurations for indexing the `BetPlaced`, `BetFinalized`, `BetClainmed`, `FeeCollected`, `AggregationCompleted`, `BucketPriceSet`, and `BatchProcessed` events emitted by the Torch smart contracts.

---

## 📁 Directory Structure

```
torch-subgraph/
├── abis/              # ABI definitions for the indexed smart contracts
├── config/            # Configuration files
├── graph-node/        # Dockerized Graph Node setup for local development
├── src/               # Event handlers and mapping logic
├── package.json/      # Project dependencies and scripts
├── schema.graphql/    # GraphQL schema definition (Entities)
├── subgraph.yaml/     # Subgraph manifest: sources, mappings, schema
└── README.md          
```

---

## 🛠 Installation & Local Development

### 🧱 Prerequisites

Make sure you have:

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Docker + Docker Compose](https://docs.docker.com/compose/)

---
### 🚀 Setup Steps

#### Clone the monorepo
```bash
git clone https://github.com/denchik37/TorchOriginsHackathon
cd TorchOriginsHackathon/torch-subgraph
```

#### Install dependencies
```bash
npm install
```

#### Start local Graph Node
```bash
cd graph-node
docker-compose up
```
#### Open a new terminal
```bash
cd ..
npm run graph-node
```
#### Generate AssemblyScript types
```bash
graph codegen
```
#### Create the subgraph
```bash
npm run create-local
```
#### Deploy the subgrah
```bash
npm run deploy-local
```

---
## 🕸 Subgraph Overview

This subgraph indexes events related to prediction market lifecycle:

| Event                  | Description                                           |
|------------------------|-------------------------------------------------------|
| `BetPlaced`            | Triggered when a user places a prediction bet         |
| `BetFinalized`         | Triggered when price is resolved and bets evaluated   |
| `BetClaimed`           | Triggered when a user claims their winnings           |
| `FeeCollected`         | Triggered when a fees is collected from a bet         |
| `AggregationComplted`  | Triggered when a bucket is resolved                   |
| `BucketPriceSet`       | Triggered when a bucket winnings price is set         |
| `BatchProcessed`       | Triggered when a bucket is processed                  |


## 🔧 Schema (`schema.graphql`)

```graphql
# ---------------- USER ----------------
type User @entity(immutable: true) {
  id: ID!
  bets: [Bet!]! @derivedFrom(field: "user")
}

type UserStats @entity(immutable: false) {
  id: ID!
  totalBets: Int!
  totalWon: Int!
  totalStaked: BigInt!
  totalPayout: BigInt!
}

# ---------------- BUCKET ----------------
type Bucket @entity(immutable: false) {
  id: ID!                    
  totalBets: Int!
  aggregationComplete: Boolean!
  totalWinningWeight: BigInt!
  nextProcessIndex: Int!
  price: BigInt
  bets: [Bet!]! @derivedFrom(field: "bucketRef")
  betIds: [String!]!
}


# ---------------- BET ----------------
type Bet @entity(immutable: false) {
  id: ID!
  user: User!
  bucket: Int!
  bucketRef: Bucket!
  stake: BigInt!
  priceMin: BigInt!
  priceMax: BigInt!
  targetTimestamp: BigInt!
  qualityBps: BigInt
  weight: BigInt
  finalized: Boolean
  claimed: Boolean
  actualPrice: BigInt
  won: Boolean
  payout: BigInt
  blockNumber: BigInt!
  timestamp: BigInt!
  transactionHash: Bytes!
}

# ---------------- FEE ----------------
type Fee @entity(immutable: true) {
  id: ID!
  amount: BigInt!
  blockNumber: BigInt!
  timestamp: BigInt!
  transactionHash: Bytes!
}
```
---

## Frontend Integration
- The frontend (hosted on Vercel) queries this subgraph (via `NEXT_PUBLIC_SUBGRAPH_URL`) to render bet and lifecycle data.
- In production, configure `NEXT_PUBLIC_SUBGRAPH_URL` to your hosted GraphQL endpoint (e.g. Graph Node running on your VPS/Hetzner).

## 📚 Learn More
- 💡 [Subgraph Example](https://docs.hedera.com/hedera/tutorials/smart-contracts/deploy-a-subgraph-using-the-graph-and-json-rpc)
