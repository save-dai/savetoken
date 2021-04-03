/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');
const Decimal = require('decimal.js');

const {
  BN,
  ether,
  time,
  balance,
  expectRevert,
  expectEvent,
  constants,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');

const AaveAdapter = artifacts.require('AaveAdapter');
const CoverAdapter = artifacts.require('CoverAdapter');

const ERC20 = artifacts.require('ERC20');
const IAToken = artifacts.require('IAToken');

const IUniswapFactory = artifacts.require('IUniswapFactory');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const IPool = artifacts.require('IBalancerPool');
const verbose = process.env.VERBOSE;

// mainnet addresses
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';
const balancerPool = '0xb9efee79155b4bd6d06dd1a4c8babde306960bab';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const aDaiAddress = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
const covADaiAddress = '0xD3866617F3DdC2953A969f831830b60F1603e14b';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const userWallet1 = accounts[1];
  const nonUserWallet = accounts[3];
  const recipient = accounts[4];
  const relayer = accounts[5];

  const { toWei } = web3.utils;
  const { fromWei } = web3.utils;
  const errorDelta = 10 ** -8;

  const deadline = 1099511627776;
  const amount = ether('150'); // 100 saveTokens

  before(async () => {
    // instantiate mock tokens
    dai = await ERC20.at(daiAddress);
    aDai = await IAToken.at(aDaiAddress);
    covADai = await ERC20.at(covADaiAddress);

    uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);
    bpool = await IPool.at(balancerPool);
    daiExchangeAddress = await uniswapFactory.getExchange(daiAddress);
    daiExchange = await IUniswapExchange.at(daiExchangeAddress);

    // swap ETH for DAI
    await daiExchange.ethToTokenSwapInput(
      1,
      deadline,
      { from: userWallet1, value: ether('50') },
    );
  });

  beforeEach(async () => {
    // deploys the farmer's logic contract
    saveTokenFactory = await SaveTokenFactory.new(owner);

    aaveAdapter = await AaveAdapter.new();
    coverAdapter = await CoverAdapter.new();

    aaveAdapterInstance = await AaveAdapter.at(aaveAdapter.address);
    coverAdapterInstance = await CoverAdapter.at(coverAdapter.address);


    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      aaveAdapter.address,
      aDaiAddress,
      coverAdapter.address,
      covADaiAddress,
      balancerPool,
      constants.ZERO_ADDRESS,
      'SaveDAI_Aave_Cover',
      'SDAT',
      18,
    );
    saveDaiAaveAddress = saveToken.logs[0].args.addr;
    saveDaiAaveInstance = await SaveToken.at(saveDaiAaveAddress);

    // approve 1000 DAI
    await dai.approve(saveDaiAaveAddress, toWei('1000'), { from: userWallet1 });
  });
  it('user wallet1 should have DAI balance', async () => {
    const userWalletBalance = await dai.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(100));
  });

  context('one saveToken deployed: saveDAI - Aave and Cover', function () {
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

        const actual = fromWei(covADaibalance);
        const expected = fromWei(saveDaiAaveMinted);

        function calcRelativeDiff (expected, actual) {
          return ((Decimal(expected).minus(Decimal(actual))).div(expected)).abs();
        }
        const relDif = calcRelativeDiff(expected, actual);

        if (verbose) {
          console.log('mint');
          console.log(`covADaibalance : ${covADaibalance.toString()}`);
          console.log(`aDAIbalance : ${aDAIbalance.toString()}`);
          console.log(`saveDaiAaveMinted : ${saveDaiAaveMinted.toString()}`);
          console.log(`relDif : ${relDif})`);
        }

        assert.isAtMost(relDif.toNumber(), errorDelta);

        // all token balances should match
        // assert.equal(aDAIbalance.toString(), amount);
        // assert.equal(ocDAIbalance.toString(), amount);
        // assert.equal(saveDaiAaveMinted.toString(), amount);
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
        assert.equal(totalDaiCost.toString().substring(0, 6), diff.toString().substring(0, 6));
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
      it('should transfer all saveDAI tokens from sender to recipient (full transfer)', async () => {
        const senderBalanceBefore = await saveDaiAaveInstance.balanceOf(userWallet1);

        await saveDaiAaveInstance.transfer(recipient, senderBalanceBefore, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);

        const diff = senderBalanceBefore.sub(senderBalanceAfter);

        assert.equal(senderBalanceBefore.toString(), diff.toString());
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should transfer saveDAI from sender to recipient (partial transfer)', async () => {
        const senderBalanceBefore = await saveDaiAaveInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        await saveDaiAaveInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);

        assert.equal(remainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });
      it('should decrease the sender\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        await saveDaiAaveInstance.transfer(recipient, amount, { from: userWallet1 });

        const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
      it('should increase the recipient\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        await saveDaiAaveInstance.transfer(recipient, amount, { from: userWallet1 });

        const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        const asserDiff = finalAssetBalance.sub(initialAssetBalance);
        const insuranceDiff = finalInsuranceBalance.sub(initialInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
    });
    describe('transferFrom', async function () {
      beforeEach(async () => {
        // Mint saveToken
        await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
      });
      it('should transfer all saveDAI tokens from sender to recipient (full transfer)', async () => {
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
      it('should transfer saveDAI tokens from sender to recipient (partial transfer)', async () => {
        const senderBalanceBefore = await saveDaiAaveInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiAaveInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiAaveInstance.balanceOf(recipient);

        assert.equal(remainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });
      it('should decrease the sender\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, amount, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, amount,
          { from: relayer },
        );

        const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
      it('should increase the recipient\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiAaveInstance.approve(relayer, amount, { from : userWallet1 });
        await saveDaiAaveInstance.transferFrom(
          userWallet1, recipient, amount,
          { from: relayer },
        );

        const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(recipient);
        const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(recipient);

        const asserDiff = finalAssetBalance.sub(initialAssetBalance);
        const insuranceDiff = finalInsuranceBalance.sub(initialInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
    });
    describe.skip('withdrawForUnderlyingAsset', function () {
      beforeEach(async () => {
        // Mint saveToken
        await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
      });
      it('revert if the user does not have enough SaveTokens to unbundle', async () => {
        await expectRevert(saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
          'must successfully execute delegatecall');
      });
      it('should decrease insuranceTokens and assetTokens from SaveToken contract', async () => {
        // identify initial balances
        const aDAIbalanceInitial = await aDai.balanceOf(saveDaiAaveAddress);
        const ocDAIbalanceInitial = await ocDaiInstance.balanceOf(saveDaiAaveAddress);
        // all token balances should match
        assert.equal(aDAIbalanceInitial.toString(), amount);
        assert.equal(ocDAIbalanceInitial.toString(), amount);

        // unbundle userWallet1's SaveTokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        // identify final balances
        const aDAIbalanceFinal = await aDai.balanceOf(saveDaiAaveAddress);
        const ocDAIbalanceFinal = await ocDaiInstance.balanceOf(saveDaiAaveAddress);

        diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
        diffInocDai = ocDAIbalanceInitial.sub(ocDAIbalanceFinal);

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.equal(diffInocDai.toString(), 0) &&
          assert.equal(diffInaDai.toString(), amount)
          :
          assert.equal(diffInocDai.toString(), diffInocDai) &&
          assert.equal(diffInaDai.toString(), amount);
      });
      it('should send msg.sender the underlying asset', async () => {
        // dai already deposited
        daiAmount = await saveDaiAaveInstance.balanceOf(userWallet1);
        daiAmount = daiAmount.toNumber();

        // idenitfy the user's initialUnderlyingBalance
        initialUnderlyingBalance = await dai.balanceOf(userWallet1);

        // calculate ocDAI for DAI on uniswap
        const eth = await ocDaiExchange.getTokenToEthInputPrice(daiAmount);
        let daiSwapped = await daiExchange.getEthToTokenInputPrice(eth);
        daiSwapped = daiSwapped / 1e18;

        const daiTotal = daiAmount + daiSwapped;

        // unbundle userWallet1's tokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        // idenitfy the user's updatedUnderlyingBalance
        const updatedUnderlyingBalance = await dai.balanceOf(userWallet1);
        const diff = updatedUnderlyingBalance.sub(initialUnderlyingBalance);

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.equal(daiAmount, diff)
          :
          assert.approximately(daiTotal, diff, 0.0000009);
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

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
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
});
