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
