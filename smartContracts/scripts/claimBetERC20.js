const { ethers } = require("hardhat");

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
];

/**
 * Claim a bet on TorchPredictionMarketERC20 (winners get ERC20; losers mark claimed with 0 payout).
 */
module.exports = async (contractAddress, betId) => {
  console.log("💰 claimBet (ERC20)");
  console.log(`📍 Market: ${contractAddress}`);
  console.log(`🆔 Bet ID: ${betId}`);

  const [signer] = await ethers.getSigners();
  const market = await ethers.getContractAt(
    "TorchPredictionMarketERC20",
    contractAddress,
    signer,
  );

  const bet = await market.getBet(betId);
  console.log(`👤 Bettor: ${bet.bettor}`);
  console.log(`📈 Range: ${bet.priceMin} – ${bet.priceMax}`);
  console.log(`💰 Stake (net): ${ethers.utils.formatEther(bet.stake)} tokens`);
  console.log(`🏁 Finalized: ${bet.finalized} | won: ${bet.won} | claimed: ${bet.claimed}`);

  if (!bet.finalized) {
    console.log("❌ Bet not finalized (set oracle price + processBatch first)");
    return;
  }
  if (bet.claimed) {
    console.log("❌ Already claimed");
    return;
  }
  if (bet.bettor.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("❌ Signer is not the bettor");
    return;
  }

  const tokenAddr = await market.collateralToken();
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  const balBefore = await token.balanceOf(signer.address);

  const tx = await market.claimBet(betId);
  console.log("⏳ Tx:", tx.hash);
  const receipt = await tx.wait();
  const balAfter = await token.balanceOf(signer.address);
  const delta = balAfter.sub(balBefore);

  console.log("✅ Claim confirmed | gas:", receipt.gasUsed.toString());
  console.log(`   Token payout (delta): ${ethers.utils.formatEther(delta)}`);
  return tx.hash;
};
