const {
  BN,           // Big Number support
  ether,
} = require('@openzeppelin/test-helpers');

// mint saveTokens
async function mint (amount, userWallet) {
  // Step 1. Calculate how much DAI is needed for asset
  let exchangeRate = await cDaiInstance.exchangeRateStored.call();
  exchangeRate = (exchangeRate.toString()) / 1e18;
  let assetCost = amount * exchangeRate;
  assetCost = new BN(assetCost.toString());

  // Step 2. Calculate how much DAI is needed for insurance
  const insuranceCost = await saveDaiInstance.getCostOfInsurance.call(amount, { from: userWallet });

  // Step 3. Add costs together, add extra, and approve
  const totalDaiCost = assetCost.add(insuranceCost);
  amountToApprove = totalDaiCost.add(new BN(ether('0.1')));
  await daiInstance.approve(saveDaiAddress, amountToApprove, { from: userWallet });

  // Step 4. mint saveDAI
  return await saveDaiInstance.mint(amount, { from: userWallet });
}

module.exports = {
  mint,
};
