/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');

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
const COMPFarmer = artifacts.require('COMPFarmer');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const AaveAdapter = artifacts.require('AaveAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');
const IERC20 = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');
const IAToken = artifacts.require('IAToken');
const IOToken = artifacts.require('IOToken');
const IUniswapFactory = artifacts.require('IUniswapFactory');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const lensABI = require('./abi/lens.json'); // ABI for Compound's CErc20 Contract

// mainnet addresses
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';
const aDaiAddress = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';

const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const cUSDCAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ocUSDCAddress = '0x8ED9f862363fFdFD3a07546e618214b6D59F03d4';

const compAddress = web3.utils.toChecksumAddress('0xc00e94Cb662C3520282E6f5717214004A7f26888');
const lensAddress = web3.utils.toChecksumAddress('0xd513d22422a3062Bd342Ae374b4b9c20E0a9a074');
const comptroller = web3.utils.toChecksumAddress('0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b');

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const userWallet1 = accounts[1];
  const userWallet2 = accounts[2];
  const nonUserWallet = accounts[3];
  const recipient = accounts[4];
  const relayer = accounts[5];

  const amount = '48921671711';
  const amount2 = '4892';
  const deadline = 1099511627776;

  before(async () => {
    // instantiate mock tokens
    daiInstance = await IERC20.at(daiAddress);
    usdcInstance = await IERC20.at(usdcAddress);
    compInstance = await IERC20.at(compAddress);
    ocDaiInstance = await IOToken.at(ocDaiAddress);
    cDaiInstance = await ICToken.at(cDaiAddress);
    aDaiInstance = await IAToken.at(aDaiAddress);

    uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);
    ocDaiExchangeAddress = await uniswapFactory.getExchange(ocDaiAddress);
    ocDaiExchange = await IUniswapExchange.at(ocDaiExchangeAddress);
    daiExchangeAddress = await uniswapFactory.getExchange(daiAddress);
    daiExchange = await IUniswapExchange.at(daiExchangeAddress);
    usdcExchangeAddress = await uniswapFactory.getExchange(usdcAddress);
    usdcExchange = await IUniswapExchange.at(usdcExchangeAddress);

    // swap ETH for DAI
    await daiExchange.ethToTokenSwapInput(
      1,
      deadline,
      { from: userWallet1, value: ether('50') },
    );

    // swap ETH for USDC
    await usdcExchange.ethToTokenSwapInput(
      1,
      deadline,
      { from: userWallet2, value: ether('50') },
    );
  });

  beforeEach(async () => {
    // deploys the farmer's logic contract
    compFarmer = await COMPFarmer.new();
    saveTokenFactory = await SaveTokenFactory.new(owner);
    compoundAdapter = await CompoundAdapter.new();
    opynAdapter = await OpynAdapter.new();

    compoundAdapterInstance = await CompoundAdapter.at(compoundAdapter.address);
    opynAdapterInstance = await OpynAdapter.at(opynAdapter.address);

    lensContract = new web3.eth.Contract(lensABI, lensAddress);

    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      cDaiAddress,
      opynAdapter.address,
      ocDaiAddress,
      uniswapFactoryAddress,
      compFarmer.address,
      'SaveDAI',
      'SDT',
      8,
    );
    saveDaiAddress = saveToken.logs[0].args.addr;
    saveDaiInstance = await SaveToken.at(saveDaiAddress);

    // approve 1000 DAI
    await daiInstance.approve(saveDaiAddress, ether('1000'), { from: userWallet1 });
  });
  it('user wallet1 should have DAI balance', async () => {
    const userWalletBalance = await daiInstance.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(100));
  });
  it('user wallet2 should have USDC balance', async () => {
    const userWalletBalance = await usdcInstance.balanceOf(userWallet2);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(1000));
  });

  context('one saveToken deployed: saveDAI - Compound and Opyn', function () {
    describe('mint', function () {
      it('should revert if paused', async () => {
        await saveDaiInstance.pause({ from: owner });
        // mint saveDAI tokens
        await expectRevert(saveDaiInstance.mint(amount, { from: userWallet1 }), 'Pausable: paused');
      });
      it('should mint SaveTokens', async () => {
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });

        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        const proxyAddress = event.args[0];

        const ocDAIbalance = await ocDaiInstance.balanceOf(saveDaiAddress);
        const cDAIbalance = await cDaiInstance.balanceOf(proxyAddress);
        const saveDaiMinted = await saveDaiInstance.balanceOf(userWallet1);

        // all token balances should match
        assert.equal(cDAIbalance.toString(), amount);
        assert.equal(ocDAIbalance.toString(), amount);
        assert.equal(saveDaiMinted.toString(), amount);
      });
      it('should decrease userWallet DAI balance', async () => {
        // Step 1. Get initial balance
        const initialBalance = await daiInstance.balanceOf(userWallet1);

        // Step 2. Calculate how much DAI is needed for asset
        let exchangeRate = await cDaiInstance.exchangeRateStored.call();
        exchangeRate = (exchangeRate.toString()) / 1e18;
        let assetCost = amount * exchangeRate;
        assetCost = new BN(assetCost.toString());

        // Step 3. Calculate how much DAI is needed for insurance
        const ethToPay = await ocDaiExchange.getEthToTokenOutputPrice(amount);
        const insuranceCost = await daiExchange.getTokenToEthOutputPrice(ethToPay);

        // Step 4. Add together for total DAI cost
        const totalDaiCost = assetCost.add(insuranceCost);

        // Step 5. mint saveDAI
        await saveDaiInstance.mint(amount, { from: userWallet1 });

        // Step 6. Get ending balance
        const endingBalance = await daiInstance.balanceOf(userWallet1);

        const diff = initialBalance.sub(endingBalance);
        assert.equal(totalDaiCost.toString().substring(0, 6), diff.toString().substring(0, 6));
      });
      it('should increase the user\'s assetTokens and insuranceTokens balances', async () => {
        await saveDaiInstance.mint(amount, { from: userWallet1 });

        const assetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const insuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        assert.equal(assetBalance, amount);
        assert.equal(insuranceBalance, amount);
      });
      it('should emit the amount of tokens minted', async () => {
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const wallet = web3.utils.toChecksumAddress(userWallet1);
        expectEvent(receipt, 'Mint', { amount: amount, user: wallet });
      });
    });
    describe('transfer', function () {
      beforeEach(async () => {
        // Mint saveToken
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        senderProxyAddress = event.args[0];
      });
      it('should transfer all saveDAI tokens from sender to recipient (full transfer)', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);

        await saveDaiInstance.transfer(recipient, senderBalanceBefore, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        const diff = senderBalanceBefore.sub(senderBalanceAfter);

        assert.equal(senderBalanceBefore.toString(), diff.toString());
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send all cDAI to recipient (full transfer)', async () => {
        const sendercDAIbalanceBefore = await cDaiInstance.balanceOf(senderProxyAddress);

        const receipt = await saveDaiInstance.transfer(recipient, sendercDAIbalanceBefore, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDaiInstance.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDaiInstance.balanceOf(recipientProxyAddress);

        const diff = sendercDAIbalanceBefore.sub(sendercDAIbalanceAfter);

        assert.equal(sendercDAIbalanceBefore.toString(), diff.toString());
        assert.equal(sendercDAIbalanceBefore.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should transfer saveDAI from sender to recipient (partial transfer)', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        await saveDaiInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        assert.equal(remainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send cDAI to recipient (partial transfer)', async () => {
        const sendercDAIbalanceBefore = await cDaiInstance.balanceOf(senderProxyAddress);
        const partialTransfer = sendercDAIbalanceBefore.div(new BN (4));
        const remainder = sendercDAIbalanceBefore.sub(partialTransfer);


        const receipt = await saveDaiInstance.transfer(recipient, partialTransfer, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDaiInstance.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDaiInstance.balanceOf(recipientProxyAddress);

        assert.equal(remainder.toString(), sendercDAIbalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should decrease the sender\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        await saveDaiInstance.transfer(recipient, amount, { from: userWallet1 });

        const finalAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
      it('should increase the recipient\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

        await saveDaiInstance.transfer(recipient, amount, { from: userWallet1 });

        const finalAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

        const asserDiff = finalAssetBalance.sub(initialAssetBalance);
        const insuranceDiff = finalInsuranceBalance.sub(initialInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
    });
    describe('transferFrom', async function () {
      beforeEach(async () => {
        // Mint saveToken
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        senderProxyAddress = event.args[0];
      });
      it('should transfer all saveDAI tokens from sender to recipient (full transfer)', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, senderBalanceBefore, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, senderBalanceBefore,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        assert.equal(senderBalanceAfter.toString(), 0);
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send all cDAI to recipient (full transfer)', async () => {
        const sendercDAIbalanceBefore = await cDaiInstance.balanceOf(senderProxyAddress);
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, senderBalanceBefore, { from : userWallet1 });
        const receipt = await saveDaiInstance.transferFrom(
          userWallet1, recipient, senderBalanceBefore,
          { from: relayer },
        );

        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDaiInstance.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDaiInstance.balanceOf(recipientProxyAddress);

        assert.equal(sendercDAIbalanceAfter.toString(), 0);
        assert.equal(sendercDAIbalanceBefore.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should transfer saveDAI tokens from sender to recipient (partial transfer)', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        assert.equal(remainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send cDAI to recipient (partial transfer)', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        const receipt = await saveDaiInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDaiInstance.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDaiInstance.balanceOf(recipientProxyAddress);

        assert.equal(remainder.toString(), sendercDAIbalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should decrease the sender\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, amount, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, amount,
          { from: relayer },
        );

        const finalAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
      it('should increase the recipient\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, amount, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, amount,
          { from: relayer },
        );

        const finalAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

        const asserDiff = finalAssetBalance.sub(initialAssetBalance);
        const insuranceDiff = finalInsuranceBalance.sub(initialInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
    });
    describe('withdrawForUnderlyingAsset', function () {
      beforeEach(async () => {
        // Mint saveToken
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        proxyAddress = event.args[0];
      });
      it('revert if the user does not have enough SaveTokens to unbundle', async () => {
        await expectRevert(saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
          'must successfully execute delegatecall');
      });
      it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
        // identify initial balances
        const cDaiBalanceInitial = await cDaiInstance.balanceOf(proxyAddress);
        const ocDaiBalanceInitial = await ocDaiInstance.balanceOf(saveDaiAddress);

        // all token balances should match
        assert.equal(cDaiBalanceInitial.toString(), amount);
        assert.equal(ocDaiBalanceInitial.toString(), amount);

        // unbundle userWallet1's SaveTokens
        await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        // identify final balances
        const cDAIbalanceFinal = await cDaiInstance.balanceOf(proxyAddress);
        const ocDAIbalanceFinal = await ocDaiInstance.balanceOf(saveDaiAddress);

        diffIncDai = cDaiBalanceInitial.sub(cDAIbalanceFinal);
        diffInocDai = ocDaiBalanceInitial.sub(ocDAIbalanceFinal);

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.equal(diffInocDai.toString(), 0) &&
          assert.equal(diffIncDai.toString(), amount)
          :
          assert.equal(diffInocDai.toString(), diffInocDai) &&
          assert.equal(diffIncDai.toString(), amount);
      });
      it('should send msg.sender the underlying asset', async () => {
        tokenAmount = await saveDaiInstance.balanceOf(userWallet1);
        tokenAmount = tokenAmount.toNumber();

        // idenitfy the user's initialUnderlyingBalance
        initialUnderlyingBalance = await daiInstance.balanceOf(userWallet1);

        // calculate how much DAI is needed for asset
        let exchangeRate = await cDaiInstance.exchangeRateStored.call();
        exchangeRate = exchangeRate / 1e18;
        daiReedem = (tokenAmount * exchangeRate) / 1e18;

        // calculate ocDAI for DAI on uniswap
        const eth = await ocDaiExchange.getTokenToEthInputPrice(tokenAmount);
        let daiSwapped = await daiExchange.getEthToTokenInputPrice(eth);
        daiSwapped = daiSwapped / 1e18;

        // add daiReedem + daiSwapped together, should be really close to diff
        const daiBoughtTotal = daiReedem + daiSwapped;

        // unbundle userWallet1's tokens
        await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        // idenitfy the user's updatedUnderlyingBalance
        const updatedUnderlyingBalance = await daiInstance.balanceOf(userWallet1);
        const diff = (updatedUnderlyingBalance.sub(initialUnderlyingBalance)) / 1e18;

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.approximately(daiReedem, diff, 0.0000009)
          :
          assert.approximately(daiBoughtTotal, diff, 0.0000009);
      });
      it('should send msg.sender all of the rewards tokens they\'ve yielded', async () => {
        const userCompBalance = await compInstance.balanceOf(userWallet1);

        const metaData1 = await lensContract.methods.getCompBalanceMetadataExt(
          compAddress, comptroller, userWallet1).call();
        const metaDataBalance1 = metaData1[0];

        assert.equal(metaDataBalance1, userCompBalance);

        await time.advanceBlock();

        await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        const userCompBalance2 = await compInstance.balanceOf(userWallet1);

        const metaData2 = await lensContract.methods.getCompBalanceMetadataExt(
          compAddress, comptroller, userWallet1).call();
        const metaDataBalance2 = metaData2[0];

        assert.equal(metaDataBalance2, userCompBalance2);
      });
      it('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {
        // unbundle userWallet1's tokens
        const withdrawalReceipt = await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        const wallet = web3.utils.toChecksumAddress(userWallet1);
        expectEvent(withdrawalReceipt, 'WithdrawForUnderlyingAsset', { amount: amount, user: wallet });
      });
      it('should burn the amount of msg.sender\'s SaveTokens', async () => {
        const initialBalance = await saveDaiInstance.balanceOf(userWallet1);
        // unbundle userWallet's SaveTokens
        await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });
        // Idenitfy the user's finanl balance
        const finalBalance = await saveDaiInstance.balanceOf(userWallet1);
        // Calculate the difference in saveDAI tokens
        const diff = initialBalance - finalBalance;
        assert.equal(diff, amount);
      });
      it('should decrease the user\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // unbundle userWallet's SaveTokens
        await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

        const finalAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount);
        assert.equal(insuranceDiff, amount);
      });
    });
    describe('pause and unpause', function () {
      it('should revert if paused by non admin', async () => {
        await expectRevert(saveDaiInstance.pause({ from: userWallet1 }), 'Caller must be admin',
        );
      });
      it('should revert if unpaused by non admin', async () => {
        await saveDaiInstance.pause({ from: owner });
        await expectRevert(saveDaiInstance.unpause({ from: userWallet1 }), 'Caller must be admin',
        );
      });
    });
    describe('withdrawReward', function () {
      beforeEach(async () => {
        // Mint saveToken
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        proxyAddress = event.args[0];
      });
      it('should revert if the transfer of rewards is unsuccessful', async () => {
        await expectRevert(saveDaiInstance.withdrawReward({ from: nonUserWallet }),
          'must successfully execute delegatecall');
      });
      it('should send msg.sender all of the rewards tokens they\'ve yielded', async () => {
        const userCompBalance = await compInstance.balanceOf(userWallet1);

        const metaData1 = await lensContract.methods.getCompBalanceMetadataExt(
          compAddress, comptroller, userWallet1).call();
        const metaDataBalance1 = metaData1[0];

        assert.equal(metaDataBalance1, userCompBalance);

        await time.advanceBlock();

        await saveDaiInstance.withdrawReward({ from: userWallet1 });

        const userCompBalance2 = await compInstance.balanceOf(userWallet1);

        const metaData2 = await lensContract.methods.getCompBalanceMetadataExt(
          compAddress, comptroller, userWallet1).call();
        const metaDataBalance2 = metaData2[0];

        assert.equal(metaDataBalance2, userCompBalance2);
      });
      it('should emit a WithdrawReward event with the msg.sender\'s address and the amount of rewards tokens withdrawn', async () => {
        await time.advanceBlock();
        const initialCOMPBalance = await compInstance.balanceOf(userWallet1);

        const withdrawRewardReceipt = await saveDaiInstance.withdrawReward({ from: userWallet1 });

        const finalCOMPBalance = await compInstance.balanceOf(userWallet1);
        diff = finalCOMPBalance.sub(initialCOMPBalance);

        const wallet = web3.utils.toChecksumAddress(userWallet1);
        expectEvent(withdrawRewardReceipt, 'WithdrawReward', { amount: diff, user: wallet });
      });
    });
    describe('getRewardsBalance', async function () {
      beforeEach(async () => {
        // Mint saveToken
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        proxyAddress = event.args[0];
      });
      it('should return total rewards balance that has yielded', async () => {
        const initialCOMPBalance = await compInstance.balanceOf(proxyAddress);

        await time.advanceBlock();

        await saveDaiInstance.getRewardsBalance({ from: userWallet1 });

        const metaData = await lensContract.methods.getCompBalanceMetadataExt(
          compAddress, comptroller, proxyAddress).call();
        const metaDataBalance = metaData[0];

        const finalCOMPBalance = await compInstance.balanceOf(proxyAddress);
        diff = finalCOMPBalance.sub(initialCOMPBalance);

        assert.equal(metaDataBalance, diff);
      });
      it('should emit a RewardsBalance event with the msg.sender\'s COMP balance in their proxy', async () => {
        await time.advanceBlock();

        const initialCOMPBalance = await compInstance.balanceOf(proxyAddress);

        const rewardsReceipt = await saveDaiInstance.getRewardsBalance({ from: userWallet1 });

        const finalCOMPBalance = await compInstance.balanceOf(proxyAddress);
        diff = finalCOMPBalance.sub(initialCOMPBalance);

        const wallet = web3.utils.toChecksumAddress(userWallet1);
        expectEvent(rewardsReceipt, 'RewardsBalance', { amount: diff, user: wallet });
      });
    });
  });

  context('one saveToken deployed: saveDAI - Aave and Cover', function () {
    beforeEach(async () => {
      saveTokenFactory = await SaveTokenFactory.new(owner);
      aaveAdapter = await AaveAdapter.new();
      // TODO: Replace w/ CoverAdapter
      opynAdapter = await OpynAdapter.new();

      aaveAdapterInstance = await AaveAdapter.at(aaveAdapter.address);
      opynAdapterInstance = await OpynAdapter.at(opynAdapter.address);

      saveToken3 = await saveTokenFactory.createSaveToken(
        daiAddress,
        aaveAdapter.address,
        aDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        // TODO: Replace w/ Balancer
        uniswapFactoryAddress,
        constants.ZERO_ADDRESS,
        // TODO: Determine naming convention for SaveTokens
        'SaveDAI_Aave',
        'SDAT',
        18,
      );
      saveDaiAaveAddress = saveToken3.logs[0].args.addr;
      saveDaiAaveInstance = await SaveToken.at(saveDaiAaveAddress);

      // approve 1000 DAI
      await daiInstance.approve(saveDaiAaveAddress, ether('1000'), { from: userWallet1 });
    });
    describe('mint', function () {
      it('should revert if paused', async () => {
        await saveDaiAaveInstance.pause({ from: owner });
        // mint saveDAI tokens
        await expectRevert(saveDaiAaveInstance.mint(amount, { from: userWallet1 }), 'Pausable: paused');
      });
      it('should mint SaveTokens', async () => {
        await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

        const ocDAIbalance = await ocDaiInstance.balanceOf(saveDaiAaveAddress);
        const aDAIbalance = await aDaiInstance.balanceOf(saveDaiAaveAddress);
        const saveDaiAaveMinted = await saveDaiAaveInstance.balanceOf(userWallet1);

        // all token balances should match
        assert.equal(aDAIbalance.toString(), amount);
        assert.equal(ocDAIbalance.toString(), amount);
        assert.equal(saveDaiAaveMinted.toString(), amount);
      });
      it('should decrease userWallet DAI balance', async () => {
        const initialDaiBalance = await daiInstance.balanceOf(userWallet1);

        let assetCost = amount;
        assetCost = new BN(assetCost.toString());

        const ethToPay = await ocDaiExchange.getEthToTokenOutputPrice(amount);
        const insuranceCost = await daiExchange.getTokenToEthOutputPrice(ethToPay);

        const totalDaiCost = assetCost.add(insuranceCost);

        await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

        const finalDaiBalance = await daiInstance.balanceOf(userWallet1);

        const diff = initialDaiBalance.sub(finalDaiBalance);

        assert.equal(totalDaiCost.toString(), diff.toString());
      });
      it('should increase the user\'s assetTokens and insuranceTokens balances', async () => {
        await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

        const assetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const insuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        assert.equal(assetBalance, amount);
        assert.equal(insuranceBalance, amount);
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
    describe('withdrawForUnderlyingAsset', function () {
      beforeEach(async () => {
        // Mint saveToken
        await saveDaiAaveInstance.mint(amount2, { from: userWallet1 });
      });
      it('revert if the user does not have enough SaveTokens to unbundle', async () => {
        await expectRevert(saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
          'must successfully execute delegatecall');
      });
      it('should decrease insuranceTokens and assetTokens from SaveToken contract', async () => {
        // identify initial balances
        const aDAIbalanceInitial = await aDaiInstance.balanceOf(saveDaiAaveAddress);
        const ocDAIbalanceInitial = await ocDaiInstance.balanceOf(saveDaiAaveAddress);
        // all token balances should match
        assert.equal(aDAIbalanceInitial.toString(), amount2);
        assert.equal(ocDAIbalanceInitial.toString(), amount2);

        // unbundle userWallet1's SaveTokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount2, { from: userWallet1 });

        // identify final balances
        const aDAIbalanceFinal = await aDaiInstance.balanceOf(saveDaiAaveAddress);
        const ocDAIbalanceFinal = await ocDaiInstance.balanceOf(saveDaiAaveAddress);

        diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
        diffInocDai = ocDAIbalanceInitial.sub(ocDAIbalanceFinal);

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.equal(diffInocDai.toString(), 0) &&
          assert.equal(diffInaDai.toString(), amount2)
          :
          assert.equal(diffInocDai.toString(), diffInocDai) &&
          assert.equal(diffInaDai.toString(), amount2);
      });
      it('should send msg.sender the underlying asset', async () => {
        // dai already deposited
        daiAmount = await saveDaiAaveInstance.balanceOf(userWallet1);
        daiAmount = daiAmount.toNumber();

        // idenitfy the user's initialUnderlyingBalance
        initialUnderlyingBalance = await daiInstance.balanceOf(userWallet1);

        // calculate ocDAI for DAI on uniswap
        const eth = await ocDaiExchange.getTokenToEthInputPrice(daiAmount);
        let daiSwapped = await daiExchange.getEthToTokenInputPrice(eth);
        daiSwapped = daiSwapped / 1e18;

        const daiTotal = daiAmount + daiSwapped;

        // unbundle userWallet1's tokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount2, { from: userWallet1 });

        // idenitfy the user's updatedUnderlyingBalance
        const updatedUnderlyingBalance = await daiInstance.balanceOf(userWallet1);
        const diff = updatedUnderlyingBalance.sub(initialUnderlyingBalance);

        expired = await ocDaiInstance.hasExpired();
        expired ?
          assert.equal(daiAmount, diff)
          :
          assert.approximately(daiTotal, diff, 0.0000009);
      });
      it('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {
        // unbundle userWallet1's tokens
        const withdrawalReceipt = await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount2, { from: userWallet1 });

        const wallet = web3.utils.toChecksumAddress(userWallet1);
        expectEvent(withdrawalReceipt, 'WithdrawForUnderlyingAsset', { amount: amount2, user: wallet });
      });
      it('should burn the amount of msg.sender\'s SaveTokens', async () => {
        const initialBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        // unbundle userWallet's SaveTokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount2, { from: userWallet1 });
        // Idenitfy the user's finanl balance
        const finalBalance = await saveDaiAaveInstance.balanceOf(userWallet1);
        // Calculate the difference in saveDAI tokens
        const diff = initialBalance - finalBalance;
        assert.equal(diff, amount2);
      });
      it('should decrease the user\'s assetTokens and insuranceTokens balances', async () => {
        const initialAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        // unbundle userWallet's SaveTokens
        await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount2, { from: userWallet1 });

        const finalAssetBalance = await saveDaiAaveInstance.getAssetBalance(userWallet1);
        const finalInsuranceBalance = await saveDaiAaveInstance.getInsuranceBalance(userWallet1);

        const asserDiff = initialAssetBalance.sub(finalAssetBalance);
        const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

        assert.equal(asserDiff, amount2);
        assert.equal(insuranceDiff, amount2);
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

  context('multiple SaveTokens deployed', function () {
    beforeEach(async () => {
      // deploy another saveToken
      saveToken2 = await saveTokenFactory.createSaveToken(
        usdcAddress,
        compoundAdapter.address,
        cUSDCAddress,
        opynAdapter.address,
        ocUSDCAddress,
        uniswapFactoryAddress,
        compFarmer.address,
        'SaveUSDC',
        'SUT',
        8,
      );
      saveUsdcAddress = saveToken2.logs[0].args.addr;
      saveUsdcInstance = await SaveToken.at(saveUsdcAddress);

      // Send eth to userAddress to have gas to send an ERC20 tx.
      await web3.eth.sendTransaction({
        from: owner,
        to: userWallet2,
        value: ether('1'),
      });
      await daiInstance.approve(saveUsdcAddress, ether('10'), { from: userWallet2 });
    });
    it('should deploy a new SaveToken with new info', async () => {
      const name = await saveUsdcInstance.name.call();
      const symbol = await saveUsdcInstance.symbol.call();
      const decimals = await saveUsdcInstance.decimals.call();

      assert.equal('SaveUSDC', name);
      assert.equal('SUT', symbol);
      assert.equal(8, decimals.toNumber());
    });
  });
});
