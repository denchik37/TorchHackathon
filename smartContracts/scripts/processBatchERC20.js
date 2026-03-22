const { ethers } = require("hardhat");

module.exports = async (contractAddress, bucket) => {
  console.log("⚙️ processBatch (ERC20 market)");
  console.log(`   Market: ${contractAddress} | bucket: ${bucket}`);

  const [signer] = await ethers.getSigners();
  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    contractAddress,
    signer,
  );

  const tx = await market.processBatch(bucket);
  const receipt = await tx.wait();
  console.log("✅ Batch processed | tx:", tx.hash);
  console.log("   gas:", receipt.gasUsed.toString());
  return tx.hash;
};
