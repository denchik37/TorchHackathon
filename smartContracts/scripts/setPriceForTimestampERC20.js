const { ethers } = require("hardhat");

/**
 * Oracle: set resolution price for a target timestamp (same as classic Torch V2).
 */
module.exports = async (contractAddress, timestamp, price) => {
  console.log("📈 setPriceForTimestamp (ERC20 market)");
  console.log(`   Market: ${contractAddress}`);
  console.log(`   timestamp: ${timestamp} | price: ${price}`);

  const [signer] = await ethers.getSigners();
  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    contractAddress,
    signer,
  );

  const tx = await market.setPriceForTimestamp(timestamp, price);
  await tx.wait();
  console.log("✅ Price set | tx:", tx.hash);
  return tx.hash;
};
