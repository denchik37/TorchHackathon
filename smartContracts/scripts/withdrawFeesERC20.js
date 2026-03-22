const { ethers } = require("hardhat");

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];

module.exports = async (contractAddress) => {
  console.log("💸 withdrawFees (ERC20 market)");

  const [signer] = await ethers.getSigners();
  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    contractAddress,
    signer,
  );

  const fees = await market.totalFeesCollected();
  const tokenAddr = await market.collateralToken();
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  const before = await token.balanceOf(signer.address);

  const tx = await market.withdrawFees();
  await tx.wait();
  const after = await token.balanceOf(signer.address);
  console.log(`✅ Withdrew ${ethers.utils.formatEther(fees)} tokens | tx: ${tx.hash}`);
  console.log(`   Owner token balance +${ethers.utils.formatEther(after.sub(before))}`);
  return tx.hash;
};
