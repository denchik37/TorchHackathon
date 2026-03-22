require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomiclabs/hardhat-ethers");
// Import dotenv module to access variables stored in the .env file
require("dotenv").config();

// Define Hardhat tasks here, which can be accessed in our test file (test/rpc.js) by using hre.run('taskName')
task("show-balance", async () => {
  const showBalance = require("./scripts/showBalance");
  return showBalance();
});

task("deploy-contract", async () => {
  const deployContract = require("./scripts/deployContract");
  return deployContract();
});

task("deploy-test-torch", async () => {
  const deployTestTorchPredictionMarket = require("./scripts/deployTestTorchPredictionMarket");
  return deployTestTorchPredictionMarket();
});

task("deploy-torch", async () => {
  const deployTorchPredictionMarket = require("./scripts/deployTorchPredictionMarket");
  return deployTorchPredictionMarket();
});

task("interact-test-torch", "Interact with deployed TestTorchPredictionMarket contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const interactWithTestTorch = require("./scripts/interactWithTestTorch");
    return interactWithTestTorch(taskArgs.contractAddress);
  });

task("contract-view-call", "Make a view call to a deployed contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const contractViewCall = require("./scripts/contractViewCall");
    return contractViewCall(taskArgs.contractAddress);
  });

task("contract-call", "Make a call to a deployed contract")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("msg", "The message to set in the contract")
  .setAction(async (taskArgs) => {
    const contractCall = require("./scripts/contractCall");
    return contractCall(taskArgs.contractAddress, taskArgs.msg);
  });

task("place-bet", "Place a bet using placeBetWithoutValue")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("targetTimestamp", "Target timestamp for the prediction")
  .addParam("priceMin", "Minimum price in BPS")
  .addParam("priceMax", "Maximum price in BPS")
  .addParam("stakeAmount", "Stake amount in wei")
  .setAction(async (taskArgs) => {
    const placeBetWithoutValue = require("./scripts/placeBetWithoutValue");
    return placeBetWithoutValue(
      taskArgs.contractAddress,
      taskArgs.targetTimestamp,
      taskArgs.priceMin,
      taskArgs.priceMax,
      taskArgs.stakeAmount,
    );
  });

task("test-place-bet", "Test placeBet with default parameters")
  .addParam("contractAddress", "The address of the deployed contract")
  .setAction(async (taskArgs) => {
    const testPlaceBet = require("./scripts/testPlaceBet");
    return testPlaceBet(taskArgs.contractAddress);
  });

task("set-bucket-price", "Set price for a bucket (owner only)")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("bucket", "The bucket index")
  .addParam("price", "The price to set")
  .setAction(async (taskArgs) => {
    const setBucketPrice = require("./scripts/setBucketPrice");
    return setBucketPrice(taskArgs.contractAddress, taskArgs.bucket, taskArgs.price);
  });

task("finalize-bet", "Finalize a bet with actual price (owner only)")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("betId", "The ID of the bet to finalize")
  .addParam("actualPrice", "The actual price at target timestamp")
  .setAction(async (taskArgs) => {
    const finalizeBet = require("./scripts/finalizeBet");
    return finalizeBet(taskArgs.contractAddress, taskArgs.betId, taskArgs.actualPrice);
  });

task("claim-bet", "Claim winnings for a finalized bet")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("betId", "The ID of the bet to claim")
  .setAction(async (taskArgs) => {
    const claimBet = require("./scripts/claimBet");
    return claimBet(taskArgs.contractAddress, taskArgs.betId);
  });

task("place-10-bets", "Place 10 bets with delays")
  .setAction(async () => {
    const place10BetsWithDelay = require("./scripts/place10BetsWithDelay");
    return place10BetsWithDelay();
  });

task("test-mainnet-flow", "Test full flow on mainnet")
  .setAction(async () => {
    const testMainnetFlow = require("./scripts/testMainnetFlow");
    return testMainnetFlow();
  });

task("transfer-ownership", "Transfer contract ownership to a new address")
  .addParam("contractAddress", "The address of the deployed contract")
  .addParam("newOwner", "The address to transfer ownership to")
  .setAction(async (taskArgs) => {
    const transferOwnership = require("./scripts/transferOwnership");
    return transferOwnership(taskArgs.contractAddress, taskArgs.newOwner);
  });

task("verify-contract", "Prepare contract for HashScan verification")
  .addParam("contractAddress", "The address of the deployed contract")
  .addOptionalParam("contractName", "The name of the contract", "TorchPredictionMarket")
  .setAction(async (taskArgs) => {
    const verifyContract = require("./scripts/verifyContract");
    return verifyContract(taskArgs.contractAddress, taskArgs.contractName);
  });

task("verify-contract-api", "Verify contract using Sourcify API")
  .addParam("contractAddress", "The address of the deployed contract")
  .addOptionalParam("contractName", "The name of the contract", "TorchPredictionMarket")
  .setAction(async (taskArgs) => {
    const verifyContractAPI = require("./scripts/verifyContractAPI");
    return verifyContractAPI(taskArgs.contractAddress, taskArgs.contractName);
  });

task("open-verify", "Open HashScan verification page")
  .setAction(async () => {
    require("./scripts/openHashScanVerification");
  });

task("deploy-simple-torch", "Deploy SimpleTorchMarket contract")
  .setAction(async () => {
    const deploySimpleTorch = require("./scripts/deploySimpleTorch");
    return deploySimpleTorch();
  });

task("test-simple-torch", "Test SimpleTorchMarket deposit and withdraw")
  .addOptionalParam("address", "Contract address", "0x73f83d91F666567Dbe365543F01Cd90a3F5962Fb")
  .setAction(async (taskArgs) => {
    const testSimpleTorchFlow = require("./scripts/testSimpleTorchFlow");
    return testSimpleTorchFlow(taskArgs.address);
  });

// --- TorchPredictionMarketERC20 + MockERC20 (Hedera / same CLI as classic torch) ---

task("deploy-mock-erc20", "Deploy MockERC20 test token").setAction(async () => {
  return require("./scripts/deployMockERC20")();
});

task("deploy-torch-erc20", "Deploy TorchPredictionMarketERC20 (set COLLATERAL_TOKEN_ADDRESS or pass token)")
  .addOptionalParam("token", "Collateral ERC20 address")
  .setAction(async (taskArgs) => {
    return require("./scripts/deployTorchPredictionMarketERC20")(taskArgs.token);
  });

task("deploy-torch-erc20-stack", "Deploy MockERC20 + TorchPredictionMarketERC20 and mint MCOL to deployer").setAction(
  async () => {
    return require("./scripts/deployTorchErc20Stack")();
  },
);

task("mint-mock-erc20", "Mint MockERC20 to an address (ether string)")
  .addParam("token", "MockERC20 address")
  .addParam("to", "Recipient")
  .addParam("amount", "Amount in ether, e.g. 1000")
  .setAction(async (taskArgs) => {
    return require("./scripts/mintMockERC20")(
      taskArgs.token,
      taskArgs.to,
      taskArgs.amount,
    );
  });

task("place-bet-erc20", "Approve (if needed) and placeBet on TorchPredictionMarketERC20")
  .addParam("contractAddress", "Market address")
  .addParam("targetTimestamp", "Target unix timestamp")
  .addParam("priceMin", "Min price BPS")
  .addParam("priceMax", "Max price BPS")
  .addParam("stakeAmount", "Gross stake: wei string or ether e.g. 0.1")
  .setAction(async (taskArgs) => {
    return require("./scripts/placeBetERC20")(
      taskArgs.contractAddress,
      taskArgs.targetTimestamp,
      taskArgs.priceMin,
      taskArgs.priceMax,
      taskArgs.stakeAmount,
    );
  });

task("claim-bet-erc20", "Claim bet on TorchPredictionMarketERC20 (ERC20 payout)")
  .addParam("contractAddress", "Market address")
  .addParam("betId", "Bet id")
  .setAction(async (taskArgs) => {
    return require("./scripts/claimBetERC20")(
      taskArgs.contractAddress,
      taskArgs.betId,
    );
  });

task("set-price-erc20", "Oracle: setPriceForTimestamp on ERC20 market")
  .addParam("contractAddress", "Market address")
  .addParam("timestamp", "Target timestamp")
  .addParam("price", "Resolution price")
  .setAction(async (taskArgs) => {
    return require("./scripts/setPriceForTimestampERC20")(
      taskArgs.contractAddress,
      taskArgs.timestamp,
      taskArgs.price,
    );
  });

task("process-batch-erc20", "Run processBatch(bucket) on ERC20 market")
  .addParam("contractAddress", "Market address")
  .addParam("bucket", "Bucket index")
  .setAction(async (taskArgs) => {
    return require("./scripts/processBatchERC20")(
      taskArgs.contractAddress,
      taskArgs.bucket,
    );
  });

task("withdraw-fees-erc20", "Withdraw fee balance to owner (ERC20)")
  .addParam("contractAddress", "Market address")
  .setAction(async (taskArgs) => {
    return require("./scripts/withdrawFeesERC20")(taskArgs.contractAddress);
  });

task("transfer-ownership-erc20", "transferOwnership on TorchPredictionMarketERC20")
  .addParam("contractAddress", "Market address")
  .addParam("newOwner", "New owner address")
  .setAction(async (taskArgs) => {
    return require("./scripts/transferOwnershipERC20")(
      taskArgs.contractAddress,
      taskArgs.newOwner,
    );
  });

task("place-10-bets-erc20", "Place 10 delayed bets (needs TORCH_ERC20_MARKET_ADDRESS + MockERC20)").setAction(
  async () => {
    return require("./scripts/place10BetsWithDelayERC20")();
  },
);

task("test-erc20-flow", "Full ERC20 market flow (needs TORCH_ERC20_MARKET_ADDRESS; MockERC20 mints)").setAction(
  async () => {
    return require("./scripts/testErc20MainnetFlow")();
  },
);

task(
  "deploy-torch-erc20-stack-and-test",
  "Deploy MockERC20 + market and run full flow in one process (good for hardhat network)",
).setAction(async () => {
  const { marketAddress } = await require("./scripts/deployTorchErc20Stack")();
  return require("./scripts/testErc20MainnetFlow")(marketAddress);
});

task("local-erc20-place-one-bet", "Deploy MCOL + ERC20 market + one placeBet").setAction(
  async (_, hre) => {
    await hre.run("run", { script: "scripts/localErc20PlaceOneBet.js" });
  },
);

task(
  "place-erc20-strategy-three-buckets",
  "Place 3-bucket test bets (single / single / batch). Needs TORCH_ERC20_MARKET_ADDRESS. Use --network mainnet or testnet",
).setAction(async (_, hre) => {
  await hre.run("run", { script: "scripts/placeErc20ThreeBucketStrategyBets.js" });
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: {
    timeout: 3600000,
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  // This specifies network configurations used when running Hardhat tasks
  defaultNetwork: "testnet",
  networks: {
    hardhat: {},
    // `npx hardhat node` then use --network localhost for multi-step local sessions
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    local: {
      // Your Hedera Local Node address pulled from the .env file
      url: process.env.LOCAL_NODE_ENDPOINT,
      // Your local node operator private key pulled from the .env file
      accounts: [process.env.LOCAL_NODE_OPERATOR_PRIVATE_KEY],
    },
    testnet: {
      // HashIO testnet endpoint from the TESTNET_ENDPOINT variable in the .env file
      url: process.env.TESTNET_ENDPOINT,
      // Your ECDSA account private key pulled from the .env file
      accounts: [process.env.TESTNET_OPERATOR_PRIVATE_KEY],
    },

    /**
     * Uncomment the following to add a mainnet network configuration
     */
    mainnet: {
      // HashIO mainnet endpoint from the MAINNET_ENDPOINT variable in the .env file
      url: process.env.MAINNET_ENDPOINT,
      // Your ECDSA account private key pulled from the .env file
      accounts: [process.env.MAINNET_OPERATOR_PRIVATE_KEY],
    },

    /**
     * Uncomment the following to add a previewnet network configuration
     */
    //   previewnet: {
    //     // HashIO previewnet endpoint from the PREVIEWNET_ENDPOINT variable in the .env file
    //     url: process.env.PREVIEWNET_ENDPOINT,
    //     // Your ECDSA account private key pulled from the .env file
    //     accounts: [process.env.PREVIEWNET_OPERATOR_PRIVATE_KEY],
    //   },
  },
};
