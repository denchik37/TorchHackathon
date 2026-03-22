const { network } = require("hardhat");

/**
 * Hedera JSON-RPC often returns very high gas estimates; fee = estimate * gasPrice can exceed
 * balance and fail with INSUFFICIENT_TX_FEE. Cap gas on live Hedera networks only.
 */
function deployOpts(gasLimit) {
  if (network.name === "hardhat" || network.name === "localhost") {
    return {};
  }
  return { gasLimit };
}

module.exports = { deployOpts };
