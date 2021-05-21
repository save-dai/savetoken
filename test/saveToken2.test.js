/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');

const {
  calcRelativeDiff,
  getDAI,
} = require('./utils.js');

const {
  BN,
  expectRevert,
  expectEvent,
  constants,
  ether,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');

const AaveAdapter = artifacts.require('AaveAdapter');
const CoverAdapter = artifacts.require('CoverAdapter');

const IERC20 = artifacts.require('IERC20');
const IAToken = artifacts.require('IAToken');

const IPool = artifacts.require('IBalancerPool');

// mainnet addresses
const balancerPool = '0xb9efee79155b4bd6d06dd1a4c8babde306960bab';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const aDaiAddress = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
const covADaiAddress = '0xD3866617F3DdC2953A969f831830b60F1603e14b';

// COVER AAVE TOKEN
contract('SaveDAI_Aave_Cover_Expires_31_May_2021', async (accounts) => {
  const owner = accounts[0];
  const userWallet1 = accounts[1];
  const nonUserWallet = accounts[2];
  const recipient = accounts[3];
  const relayer = accounts[4];

  const errorDelta = 10 ** -8;
  const amount = ether('150'); // 150 saveTokens

  before(async () => {
    // instantiate mock tokens
    dai = await IERC20.at(daiAddress);
    aDai = await IAToken.at(aDaiAddress);
    covADai = await IERC20.at(covADaiAddress);

    bpool = await IPool.at(balancerPool);

    // swap ETH for DAI
    await getDAI(userWallet1);
  });

  beforeEach(async () => {
    // deploys the farmer's logic contract
    saveTokenFactory = await SaveTokenFactory.new(owner);

    aaveAdapter = await AaveAdapter.new();
    coverAdapter = await CoverAdapter.new();

    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      aaveAdapter.address,
      aDaiAddress,
      coverAdapter.address,
      covADaiAddress,
      balancerPool,
      constants.ZERO_ADDRESS,
      'SaveDAI_Aave_Cover_Expires_31_May_2021',
      'SaveDAI_MAY2021',
      18,
    );
    saveDaiAaveAddress = saveToken.logs[0].args.addr;
    saveDaiAaveInstance = await SaveToken.at(saveDaiAaveAddress);

    // approve 1000 DAI
    await dai.approve(saveDaiAaveAddress, ether('1000'), { from: userWallet1 });
  });
  it('user wallet1 should have DAI balance', async () => {
    const userWalletBalance = await dai.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(100));
  });

  describe('mint', function () {
    it('should revert if paused', async () => {
      await saveDaiAaveInstance.pause({ from: owner });
      // mint saveDAI tokens
      await expectRevert(saveDaiAaveInstance.mint(amount, { from: userWallet1 }), 'Pausable: paused');
    });
    it('should mint SaveTokens', async () => {
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

      const covADaibalance = await covADai.balanceOf(saveDaiAaveAddress);
      const aDAIbalance = await aDai.balanceOf(saveDaiAaveAddress);
      const saveDaiAaveMinted = await saveDaiAaveInstance.balanceOf(userWallet1);

      // saveDAI and aDAI should match. covADai off due to rounding.
      const relDif = calcRelativeDiff(covADaibalance, saveDaiAaveMinted);
      assert.isAtMost(relDif.toNumber(), errorDelta);
      assert.equal(aDAIbalance.toString(), amount);
      assert.equal(saveDaiAaveMinted.toString(), amount);
    });
    it('should decrease userWallet DAI balance', async () => {
      // Step 1. Get initial balance
      const initialBalance = await dai.balanceOf(userWallet1);

      // Step 2. Calculate how much DAI is needed for asset
      let assetCost = amount;
      assetCost = new BN(assetCost.toString());

      // Step 3. Calculate how much DAI is needed for insurance
      const tokenBalanceIn = await bpool.getBalance(daiAddress);
      const tokenWeightIn = await bpool.getDenormalizedWeight(daiAddress);
      const tokenBalanceOut = await bpool.getBalance(covADaiAddress);
      const tokenWeightOut = await bpool.getDenormalizedWeight(covADaiAddress);
      const swapFee = await bpool.getSwapFee();

      const insuranceCost = await bpool.calcInGivenOut(
        tokenBalanceIn,
        tokenWeightIn,
        tokenBalanceOut,
        tokenWeightOut,
        amount,
        swapFee,
      );

      // Step 4. Add together for total DAI cost
      const totalDaiCost = assetCost.add(insuranceCost);

      // Step 5. mint saveDAI
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

      // Step 6. Get ending balance
      const endingBalance = await dai.balanceOf(userWallet1);

      const diff = initialBalance.sub(endingBalance);

      // total DAI cost and diff in balanc are off due to rounding
      const relDif = calcRelativeDiff(totalDaiCost, diff);
      assert.isAtMost(relDif.toNumber(), errorDelta);
    });
    it('should increase the user\'s assetTokens and insuranceTokens balances', async () => {
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

      const assetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
      const insuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

      const diff = insuranceBalance.sub(assetBalance);
      assert.isAtMost(diff.toNumber(), errorDelta);
    });
    it('should emit the amount of tokens minted', async () => {
      const receipt = await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(receipt, 'Mint', { amount: amount, user: wallet });
    });
  });
  describe('transfer', function () {
    beforeEach(async () => {
      // Mint saveToken
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
    });
    context('full transfer', function () {
      it('should transfer all saveDAI tokens from sender to recipient', async () => {
        const senderBalanceBefore = await saveDaiAaveInstance.balanceOf(userWallet1);
        await saveDaiAaveInstance.transfer(recipient, senderBalanceBefore, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);

        assert.equal(senderBalanceAfter.toString(), 0);
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // get ratio and amounts to transfer
        const saveTokenBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        const ratio = amount.div(saveTokenBalance);
        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        await saveDaiAaveInstance.transfer(recipient, saveTokenBalance, { from: userWallet1 });

        const senderAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        // diff in sender balance
        const assetDiff = initialAssetBalance.sub(senderAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(senderInsuranceBalance);

        assert.equal(assetDiff.toString(), assetTransfer.toString());
        assert.equal(insuranceDiff.toString(), insuranceTransfer.toString());
        assert.equal(receipientAssetBalance.toString(), assetTransfer.toString());
        assert.equal(receipientInsuranceBalance.toString(), insuranceTransfer.toString());
      });
    });
    context('partial transfer', function () {
      it('should transfer saveDAI from sender to recipient', async () => {
        initialSaveBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        partialTransfer = initialSaveBalance.div(new BN (4));

        await saveDaiAaveInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);
        const senderRemainder = initialSaveBalance.sub(partialTransfer);

        assert.equal(senderRemainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });

      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialSaveBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // partial amount to be transferred
        const partialTransfer = initialSaveBalance.div(new BN (4));
        const ratio = partialTransfer.div(initialSaveBalance);

        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        await saveDaiAaveInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        // diff in sender balance
        const assetDiff = initialAssetBalance.sub(senderAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(senderInsuranceBalance);

        assert.equal(assetDiff.toString(), assetTransfer.toString());
        assert.equal(insuranceDiff.toString(), insuranceTransfer.toString());
        assert.equal(receipientAssetBalance.toString(), assetTransfer.toString());
        assert.equal(receipientInsuranceBalance.toString(), insuranceTransfer.toString());
      });
    });
  });
  describe('transferFrom', async function () {
    beforeEach(async () => {
      // Mint saveToken
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
    });
    context('full transfer', function () {
      it('should transfer all saveDAI tokens from sender to recipient', async () => {
        const senderBalanceBefore = await saveDaiAaveInstance.balanceOf(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, senderBalanceBefore, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, senderBalanceBefore,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);

        assert.equal(senderBalanceAfter.toString(), 0);
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // get ratio and amounts to transfer
        const saveTokenBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        const ratio = amount.div(saveTokenBalance);
        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, saveTokenBalance, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, saveTokenBalance,
          { from: relayer },
        );

        const senderAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        // diff in sender balance
        const assetDiff = initialAssetBalance.sub(senderAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(senderInsuranceBalance);

        assert.equal(assetDiff.toString(), assetTransfer.toString());
        assert.equal(insuranceDiff.toString(), insuranceTransfer.toString());
        assert.equal(receipientAssetBalance.toString(), assetTransfer.toString());
        assert.equal(receipientInsuranceBalance.toString(), insuranceTransfer.toString());
      });
    });
    context('partial transfer', function () {
      it('should transfer saveDAI from sender to recipient', async () => {
        initialSaveBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        partialTransfer = initialSaveBalance.div(new BN (4));

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);
        const senderRemainder = initialSaveBalance.sub(partialTransfer);

        assert.equal(senderRemainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });

      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialSaveBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // partial amount to be transferred
        const partialTransfer = initialSaveBalance.div(new BN (4));
        const ratio = partialTransfer.div(initialSaveBalance);

        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        // diff in sender balance
        const assetDiff = initialAssetBalance.sub(senderAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(senderInsuranceBalance);

        assert.equal(assetDiff.toString(), assetTransfer.toString());
        assert.equal(insuranceDiff.toString(), insuranceTransfer.toString());
        assert.equal(receipientAssetBalance.toString(), assetTransfer.toString());
        assert.equal(receipientInsuranceBalance.toString(), insuranceTransfer.toString());
      });
    });

  });
  describe('withdrawForUnderlyingAsset', function () {
    beforeEach(async () => {
      // Mint saveToken
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
    });
    it('revert if the user does not have enough SaveTokens to unbundle', async () => {
      await expectRevert(saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
        'Balance must be greater than 0');
    });
    it('should decrease insuranceTokens and assetTokens from SaveToken contract', async () => {
      // identify initial balances
      const aDAIbalanceInitial = await aDai.balanceOf(saveDaiAaveAddress);
      const covADaibalance = await covADai.balanceOf(saveDaiAaveAddress);

      // unbundle userWallet1's SaveTokens
      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      // identify final balances
      const aDAIbalanceFinal = await aDai.balanceOf(saveDaiAaveAddress);
      const covADaibalanceFinal = await covADai.balanceOf(saveDaiAaveAddress);

      diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
      diffIncovADai = covADaibalance.sub(covADaibalanceFinal);

      const relDif = calcRelativeDiff(diffInaDai, diffIncovADai);

      assert.isAtMost(relDif.toNumber(), errorDelta);
    });
    it('should send msg.sender the underlying asset', async () => {
      daiAmount = await saveDaiAaveInstance.balanceOf(userWallet1);
      initialUnderlyingBalance = await dai.balanceOf(userWallet1);

      // Calculate how much DAI is needed for insurance
      const tokenBalanceIn = await bpool.getBalance(daiAddress);
      const tokenWeightIn = await bpool.getDenormalizedWeight(daiAddress);
      const tokenBalanceOut = await bpool.getBalance(covADaiAddress);
      const tokenWeightOut = await bpool.getDenormalizedWeight(covADaiAddress);
      const swapFee = await bpool.getSwapFee();

      const insuranceCost = await bpool.calcInGivenOut(
        tokenBalanceIn,
        tokenWeightIn,
        tokenBalanceOut,
        tokenWeightOut,
        amount,
        swapFee,
      );

      let projectedDaiTotal = daiAmount.add(insuranceCost) / 1e18;

      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      finalUnderlyingBalance = await dai.balanceOf(userWallet1);

      let diffInDai = finalUnderlyingBalance.sub(initialUnderlyingBalance) / 1e18;

      assert.approximately(projectedDaiTotal, diffInDai, 0.4);
    });
    it('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {
      // unbundle userWallet1's tokens
      const withdrawalReceipt = await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(withdrawalReceipt, 'WithdrawForUnderlyingAsset', { amount: amount, user: wallet });
    });
    it('should burn the amount of msg.sender\'s SaveTokens', async () => {
      const initialBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
      // unbundle userWallet's SaveTokens
      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });
      // Idenitfy the user's finanl balance
      const finalBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
      // Calculate the difference in saveDAI tokens
      const diff = initialBalance - finalBalance;
      assert.equal(diff, amount);
    });
    it('should decrease the user\'s assetTokens and insuranceTokens balances', async () => {
      const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
      const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

      // unbundle userWallet's SaveTokens
      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
      const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

      const asserDiff = initialAssetBalance.sub(finalAssetBalance);
      const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

      assert.equal(asserDiff.toString(), amount.toString());

      const relDif1 = calcRelativeDiff(amount, insuranceDiff);
      assert.isAtMost(relDif1.toNumber(), errorDelta);

      const relDif2 = calcRelativeDiff(asserDiff, insuranceDiff);
      assert.isAtMost(relDif2.toNumber(), errorDelta);
    });
  });
  describe('withdrawAll', function () {
    beforeEach(async () => {
      // Mint saveToken
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
    });
    it('revert if the user does not have enough SaveTokens to unbundle', async () => {
      await expectRevert(saveDaiAaveInstance.withdrawAll({ from: nonUserWallet }),
        'Balance must be greater than 0');
    });
    it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
      // identify initial balances
      const aDAIbalanceInitial = await aDai.balanceOf(saveDaiAaveAddress);
      const covADaibalance = await covADai.balanceOf(saveDaiAaveAddress);

      // unbundle userWallet1's SaveTokens
      await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

      // identify final balances
      const aDAIbalanceFinal = await aDai.balanceOf(saveDaiAaveAddress);
      const covADaibalanceFinal = await covADai.balanceOf(saveDaiAaveAddress);

      diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
      diffIncovADai = covADaibalance.sub(covADaibalanceFinal);

      const relDif = calcRelativeDiff(diffInaDai, diffIncovADai);

      assert.isAtMost(relDif.toNumber(), errorDelta);
    });
    it('should send msg.sender all of the underlying asset', async () => {
      daiAmount = await saveDaiAaveInstance.balanceOf(userWallet1);
      initialUnderlyingBalance = await dai.balanceOf(userWallet1);

      // Calculate how much DAI is needed for insurance
      const tokenBalanceIn = await bpool.getBalance(daiAddress);
      const tokenWeightIn = await bpool.getDenormalizedWeight(daiAddress);
      const tokenBalanceOut = await bpool.getBalance(covADaiAddress);
      const tokenWeightOut = await bpool.getDenormalizedWeight(covADaiAddress);
      const swapFee = await bpool.getSwapFee();

      const insuranceCost = await bpool.calcInGivenOut(
        tokenBalanceIn,
        tokenWeightIn,
        tokenBalanceOut,
        tokenWeightOut,
        amount,
        swapFee,
      );

      let projectedDaiTotal = daiAmount.add(insuranceCost) / 1e18;

      await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

      finalSaveDaiBlance = await saveDaiAaveInstance.balanceOf(userWallet1);
      finalUnderlyingBalance = await dai.balanceOf(userWallet1);

      let diffInDai = finalUnderlyingBalance.sub(initialUnderlyingBalance) / 1e18;

      assert.approximately(projectedDaiTotal, diffInDai, 0.4);
      assert.equal(finalSaveDaiBlance, 0);
    });
    it('should emit a WithdrawAll event with the msg.sender\'s address and the amount of SaveTokens unbundled', async () => {
      // unbundle all of userWallet1's tokens
      const withdrawalReceipt = await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(withdrawalReceipt, 'WithdrawAll', { amount: amount, user: wallet });
    });
    it('should empty the user\'s assetTokens and insuranceTokens balances', async () => {
      const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
      const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

      // unbundle userWallet's SaveTokens
      await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

      const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
      const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

      const assetDiff = initialAssetBalance.sub(finalAssetBalance);
      const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

      assert.equal(finalAssetBalance, 0);
      assert.equal(finalInsuranceBalance, 0);
    });
  });
  describe('pause and unpause', function () {
    it('should revert if paused by non admin', async () => {
      await expectRevert(saveDaiAaveInstance.pause({ from: userWallet1 }), 'Caller must be admin',
      );
    });
    it('should revert if unpaused by non admin', async () => {
      await saveDaiAaveInstance.pause({ from: owner });
      await expectRevert(saveDaiAaveInstance.unpause({ from: userWallet1 }), 'Caller must be admin',
      );
    });
  });
});
