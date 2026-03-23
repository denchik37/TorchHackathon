# 🔥 Torch Prediction Market - Smart Contracts

> **A sophisticated prediction market for TORCH token built on Hedera Hashgraph using dual development frameworks**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.0+-blue.svg)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.12.6-orange.svg)](https://hardhat.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Latest-red.svg)](https://getfoundry.sh/)
[![Hedera](https://img.shields.io/badge/Hedera-Hashgraph-purple.svg)](https://hedera.com/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-4.1.0-green.svg)](https://openzeppelin.com/)

## 🚀 Overview

This repository contains the smart contracts for a **quality-weighted prediction market** where users can bet on future TORCH token prices. Built with enterprise-grade security and optimized for the Hedera network.

## 🌐 Deployments

This repo builds the Torch smart contracts. Deployed contract ids can vary between hackathon/demo runs.

### Mainnet
- Set `TORCH_CONTRACT_ID` in the consuming services (`frontend`, `torch-agent-kit-bot`, `torch-oracle-resolver`) to the deployed TorchPredictionMarket contract you want to demo.
- View on HashScan: `https://hashscan.io/mainnet/contract/<TORCH_CONTRACT_ID>`

### ERC20 Markets (Hackathon Mainnet)

> Torch is now multi-token: one prediction engine, many ecosystems, same market logic.

Torch now supports ERC20-collateralized bets on Hedera for the following tokens using `TorchPredictionMarketERC20`.

| Token | Hedera Token ID | Token EVM Address | TorchPredictionMarketERC20 (24h) |
|------|------------------|-------------------|-----------------------------------|
| SAUCE | `0.0.731861` | `0x00000000000000000000000000000000000b2c0d` | `0xCf7665963132D224f9aA977edE35FC67487AD4A6` |
| DOVU | `0.0.3716059` | `0x000000000000000000000000000000000038b9c3` | `0xF623beba5a3406c64360CE15edC4Af9A3C3714D5` |
| GIB | `0.0.7893707` | `0x00000000000000000000000000000000007872cb` | `0x03001FcE3cC923A28698AbE705F846b671623E65` |
| PACK | `0.0.127877` | `0x000000000000000000000000000000000001f355` | `0x9fD5F931F4D5f39eeb1c6D5A1810709f6d0e8f5D` |
| BONZO | `0.0.8279134` | `0x00000000000000000000000000000000007e545e` | `0x1ed9F6f98061a2ce1ffd55DB5046920c5B0016b9` |
| HSUITE | `0.0.786931` | `0x00000000000000000000000000000000000c0203` | `0x9988D47F9473797fe1d23be4bDac08100F55f0e9` |

- All ERC20 markets above use `SECONDS_PER_DAY = 24 * 60 * 60` (24h buckets).
- Each market starts with `nextBetId = 0` and is ready for new bets.

### Testnet
- Use the same `TORCH_CONTRACT_ID` approach for your testnet deployment.

---

### ✨ Key Features

- **🎯 Quality-Based Weighting**: Bets are weighted based on prediction accuracy and time horizon
- **⚡ Batch Processing**: Efficient handling of multiple bets with configurable batch sizes
- **🛡️ Enterprise Security**: OpenZeppelin patterns (ReentrancyGuard, Ownable, Pausable)
- **🔧 Dual Framework**: Development with both **Hardhat** and **Foundry**
- **🌐 Hedera Integration**: Built for Hedera's enterprise-grade blockchain
- **📊 Proven Track Record**: 100 live bets on mainnet, extensive testnet validation

## 🛠️ Tech Stack

### **Primary Framework: Hardhat**

- **Hardhat** - Ethereum development environment
- **Node.js** - JavaScript runtime
- **ethers.js** - Ethereum library
- **@openzeppelin/contracts** - Secure smart contract libraries

### **Secondary Framework: Foundry**

- **Foundry** - Rust-based Ethereum toolkit
- **Forge** - Testing and deployment
- **Cast** - Command-line interactions

### **Blockchain: Hedera**

- **Hedera Hashgraph** - Enterprise-grade DLT
- **Hedera JSON-RPC Relay** - Network interaction
- **HashScan** - Block explorer integration

## 📁 Project Structure

```
smartContracts/
├── 📄 contracts/                    # Solidity smart contracts
│   ├── TorchPredictionMarket.sol   # Main prediction market contract
│   ├── TestTorchPredictionMarket.sol # Test version with simplified logic
│   ├── MockOracle.sol              # Mock price oracle for testing
│   ├── ITorchPredictionMarket.sol  # Interface definitions
│   └── Greeter.sol                 # Example contract
├── 🛠️ scripts/                     # Hardhat deployment & interaction scripts
│   ├── deployTorchPredictionMarket.js
│   ├── placeBetWithoutValue.js
│   ├── finalizeBet.js
│   ├── claimBet.js
│   └── ... (15+ scripts)
├── 🧪 test/                        # Test files
├── ⚙️ hardhat.config.js            # Hardhat configuration
├── 📦 package.json                 # Node.js dependencies
└── 🔧 Foundry/                     # Foundry development setup
    ├── foundry.toml               # Foundry configuration
    ├── src/                       # Foundry source files
    └── script/                    # Foundry deployment scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Git

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd smartContracts
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your Hedera testnet credentials
```

### 3. Run Tests

```bash
# Hardhat tests
npx hardhat test

# Foundry tests (if Foundry is installed)
cd Foundry
forge test
```

### 4. Deploy Contracts

```bash
# Deploy to testnet
npx hardhat deploy-torch --network testnet

# Deploy test version
npx hardhat deploy-test-torch --network testnet
```

## 🎯 Core Contracts

### **TorchPredictionMarket.sol**

The main prediction market contract featuring:

- **Quality Weighting System**: Bets weighted by prediction sharpness and time horizon
- **Batch Processing**: Efficient handling of multiple bets
- **Security Patterns**: ReentrancyGuard, Ownable, Pausable
- **Event System**: Comprehensive event logging for frontend integration

### **Key Functions**

```solidity
// Place a bet on future TORCH price
function placeBet(
    uint256 targetTimestamp,
    uint256 priceMin,
    uint256 priceMax,
    uint256 stake
) external payable

// Finalize a bet with actual price (owner only)
function finalizeBet(uint256 betId, uint256 actualPrice) external

// Claim winnings for finalized bets
function claimBet(uint256 betId) external
```

## 🛠️ Development Scripts

### **Deployment Scripts**

```bash
# Deploy main contract
npx hardhat deploy-torch --network testnet

# Deploy test version
npx hardhat deploy-test-torch --network testnet

# Deploy with custom parameters
npx hardhat deploy-contract --network testnet
```

#### **Interaction Scripts**

```bash
# Place a bet
npx hardhat place-bet --contract-address 0x... --target-timestamp 1234567890 --price-min 100 --price-max 200 --stake-amount 1000000000000000000

# Finalize a bet
npx hardhat finalize-bet --contract-address 0x... --bet-id 1 --actual-price 150

# Claim winnings
npx hardhat claim-bet --contract-address 0x... --bet-id 1

# Set bucket price (owner only)
npx hardhat set-bucket-price --contract-address 0x... --bucket 1 --price 150
```

#### **Testing & Debug Scripts**

```bash
# Test contract interaction
npx hardhat interact-test-torch --contract-address 0x...

# Place 10 test bets with delays
npx hardhat place-10-bets --contract-address 0x...

# Debug betting process
npx hardhat debug-place-10-bets --contract-address 0x...

# Simple contract test
npx hardhat simple-test --contract-address 0x...
```

#### **Utility Scripts**

```bash
# Show account balance
npx hardhat show-balance

# Make contract view call
npx hardhat contract-view-call --contract-address 0x...

# Make contract call
npx hardhat contract-call --contract-address 0x... --msg "Hello World"
```

### **📁 Available Scripts**

```
scripts/
├── 🚀 Deployment
│   ├── deployTorchPredictionMarket.js
│   ├── deployTestTorchPredictionMarket.js
│   └── deployContract.js
├── 🎯 Interaction
│   ├── placeBetWithoutValue.js
│   ├── finalizeBet.js
│   ├── claimBet.js
│   └── setBucketPrice.js
├── 🧪 Testing
│   ├── testPlaceBet.js
│   ├── interactWithTestTorch.js
│   ├── simpleTest.js
│   └── debugPlace10Bets.js
├── ⚡ Batch Operations
│   ├── place10BetsWithDelay.js
│   └── debugPlace10Bets.js
└── 🔧 Utilities
    ├── showBalance.js
    ├── contractCall.js
    └── contractViewCall.js
```

### **🔥 Foundry Recommendation**

> **💡 Pro Tip**: For advanced smart contract interactions and gas optimization, we **recommend using Foundry scripts**. Foundry provides faster execution, better gas estimation, and more precise control over contract interactions.

#### **Foundry Scripts Example**

```bash
cd Foundry

# Deploy with Foundry
forge script Deploy --rpc-url $RPC_URL --broadcast

# Interact with contract
cast call <contract-address> "nextBetId()" --rpc-url $RPC_URL

# Send transaction
cast send <contract-address> "placeBet(uint256,uint256,uint256,uint256)" \
  --args 1234567890 100 200 1000000000000000000 \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

#### **Why Foundry for Interactions?**

- **⚡ Faster Execution**: Rust-based performance
- **🎯 Precise Gas Estimation**: Better gas optimization
- **🔧 Lower Level Control**: Direct ABI interactions
- **📊 Better Debugging**: Detailed transaction traces
- **🛠️ Advanced Testing**: Fuzz testing and invariant testing

## 🔧 Configuration

### **Hardhat Configuration**

```javascript
// hardhat.config.js
module.exports = {
  solidity: "0.8.19",
  networks: {
    testnet: {
      url: process.env.TESTNET_RPC_URL,
      accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
    },
  },
};
```

### **Foundry Configuration**

```toml
# Foundry/foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

[rpc_endpoints]
testnet = "${RPC_URL}"
mainnet = "${MAINNET_RPC_URL}"
```

## 🧪 Testing

### **Hardhat Tests**

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/TorchPredictionMarket.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### **Foundry Tests**

```bash
cd Foundry
forge test
forge test --gas-report
```

## 🌐 Network Integration

### **Hedera Networks**

- **Testnet**: `https://testnet.hashio.io/api`
- **Mainnet**: `https://mainnet.hashio.io/api`

### **HashScan Integration**

- **Testnet**: https://hashscan.io/testnet
- **Mainnet**: https://hashscan.io

## 🔒 Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Ownable**: Access control for admin functions
- **Pausable**: Emergency pause functionality
- **Input Validation**: Comprehensive parameter validation
- **Gas Optimization**: Efficient batch processing

## 📊 Contract Parameters

| Parameter        | Value      | Description               |
| ---------------- | ---------- | ------------------------- |
| `FEE_BPS`        | 50         | 0.5% fee in basis points  |
| `MIN_STAKE`      | 0.01 ether | Minimum bet amount        |
| `MAX_STAKE`      | 100 ether  | Maximum bet amount        |
| `MAX_DAYS_AHEAD` | 30         | Maximum days to bet ahead |
| `BATCH_SIZE`     | 50         | Bets processed per batch  |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Hedera Documentation](https://docs.hedera.com/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Foundry Documentation](https://getfoundry.sh/)
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- [HashScan Explorer](https://hashscan.io/)

---

<div align="center">
  <p>Built with ❤️ for the Hedera ecosystem</p>
  <p>🔥 <strong>Torch Prediction Market</strong> 🔥</p>
</div>
