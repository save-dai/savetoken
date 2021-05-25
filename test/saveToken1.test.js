/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');

const {
  calcRelativeDiff,
  getDAI,
} = require('./utils.js');

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

const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');

const COMPFarmer = artifacts.require('COMPFarmer');
const IERC20 = artifacts.require('IERC20');
const ICToken = artifacts.require('ICToken');
const IOToken = artifacts.require('IOToken');

const IUniswapFactory = artifacts.require('IUniswapFactory');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const IComptrollerLens = artifacts.require('IComptrollerLens');
const lensABI = require('./abi/lens.json'); // ABI for Compound's CErc20 Contract

// mainnet addresses
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';

const compAddress = web3.utils.toChecksumAddress('0xc00e94Cb662C3520282E6f5717214004A7f26888');
const lensAddress = web3.utils.toChecksumAddress('0xd513d22422a3062Bd342Ae374b4b9c20E0a9a074');
const comptrollerAddress = web3.utils.toChecksumAddress('0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b');

// OPYN COMPOUND TOKEN
contract('SaveDAI_Compound_Opyn_Expires_31_Feb_2021', async (accounts) => {
  const owner = accounts[0];
  const userWallet1 = accounts[1];
  const nonUserWallet = accounts[2];
  const recipient = accounts[3];
  const relayer = accounts[4];

  const errorDelta = 10 ** -5;
  let amount = '48921671711';

  before(async () => {
    // instantiate mock tokens
    dai = await IERC20.at(daiAddress);
    comp = await IERC20.at(compAddress);
    ocDai = await IOToken.at(ocDaiAddress);
    cDai = await ICToken.at(cDaiAddress);

    uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);
    ocDaiExchangeAddress = await uniswapFactory.getExchange(ocDaiAddress);
    ocDaiExchange = await IUniswapExchange.at(ocDaiExchangeAddress);
    daiExchangeAddress = await uniswapFactory.getExchange(daiAddress);
    daiExchange = await IUniswapExchange.at(daiExchangeAddress);

    // swap ETH for DAI
    await getDAI(userWallet1);
  });

  beforeEach(async () => {
    // deploys the farmer's logic contract
    compFarmer = await COMPFarmer.new();
    saveTokenFactory = await SaveTokenFactory.new(owner);
    compoundAdapter = await CompoundAdapter.new();
    opynAdapter = await OpynAdapter.new();

    compoundAdapterInstance = await CompoundAdapter.at(compoundAdapter.address);
    opynAdapterInstance = await OpynAdapter.at(opynAdapter.address);

    comptrollerInstance = await IComptrollerLens.at(comptrollerAddress);
    lensContract = new web3.eth.Contract(lensABI, lensAddress);

    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      cDaiAddress,
      opynAdapter.address,
      ocDaiAddress,
      uniswapFactoryAddress,
      compFarmer.address,
      'SaveDAI_Compound_Opyn_Expires_31_Feb_2021',
      'SDCO',
      8,
    );
    saveDaiAddress = saveToken.logs[0].args.addr;
    saveDaiInstance = await SaveToken.at(saveDaiAddress);

    // approve 1000 DAI
    await dai.approve(saveDaiAddress, ether('1000'), { from: userWallet1 });
  });
  it('user wallet1 should have DAI balance', async () => {
    const userWalletBalance = await dai.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(100));
  });

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

      const ocDAIbalance = await ocDai.balanceOf(saveDaiAddress);
      const cDAIbalance = await cDai.balanceOf(proxyAddress);
      const saveDaiMinted = await saveDaiInstance.balanceOf(userWallet1);

      // all token balances should match
      assert.equal(cDAIbalance.toString(), amount);
      assert.equal(ocDAIbalance.toString(), amount);
      assert.equal(saveDaiMinted.toString(), amount);
    });
    it('should decrease userWallet DAI balance', async () => {
      // Step 1. Get initial balance
      const initialBalance = await dai.balanceOf(userWallet1);

      // Step 2. Calculate how much DAI is needed for asset
      let exchangeRate = await cDai.exchangeRateStored.call();
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
      const endingBalance = await dai.balanceOf(userWallet1);

      const diff = initialBalance.sub(endingBalance);

      // total DAI cost and diff in balanc are off due to rounding
      const relDif = calcRelativeDiff(totalDaiCost, diff);
      assert.isAtMost(relDif.toNumber(), errorDelta);

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
    context('full transfer', function () {
      it('should transfer all saveDAI tokens from sender to recipient', async () => {
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);

        await saveDaiInstance.transfer(recipient, senderBalanceBefore, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        const diff = senderBalanceBefore.sub(senderBalanceAfter);

        assert.equal(senderBalanceBefore.toString(), diff.toString());
        assert.equal(senderBalanceBefore.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send all cDAI to recipient', async () => {
        const sendercDAIbalanceBefore = await cDai.balanceOf(senderProxyAddress);

        const receipt = await saveDaiInstance.transfer(recipient, sendercDAIbalanceBefore, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDai.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDai.balanceOf(recipientProxyAddress);

        const diff = sendercDAIbalanceBefore.sub(sendercDAIbalanceAfter);

        assert.equal(sendercDAIbalanceBefore.toString(), diff.toString());
        assert.equal(sendercDAIbalanceBefore.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // get ratio and amounts to transfer
        const saveTokenBalance = await saveDaiInstance.balanceOf(userWallet1);
        amount = new BN(amount);
        const ratio = amount.div(saveTokenBalance);
        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        await saveDaiInstance.transfer(recipient, amount, { from: userWallet1 });

        const senderAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

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
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);
        const partialTransfer = senderBalanceBefore.div(new BN (4));
        const remainder = senderBalanceBefore.sub(partialTransfer);

        await saveDaiInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);

        assert.equal(remainder.toString(), senderBalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientBalanceAfter.toString());
      });
      it('should deploy proxy and send cDAI to recipient', async () => {
        const sendercDAIbalanceBefore = await cDai.balanceOf(senderProxyAddress);
        const partialTransfer = sendercDAIbalanceBefore.div(new BN (4));
        const remainder = sendercDAIbalanceBefore.sub(partialTransfer);

        const receipt = await saveDaiInstance.transfer(recipient, partialTransfer, { from: userWallet1 });
        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDai.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDai.balanceOf(recipientProxyAddress);

        assert.equal(remainder.toString(), sendercDAIbalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialSaveBalance = await saveDaiInstance.balanceOf(userWallet1);
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // partial amount to be transferred
        const partialTransfer = initialSaveBalance.div(new BN (4));
        const ratio = partialTransfer.div(initialSaveBalance);

        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        await saveDaiInstance.transfer(recipient, partialTransfer, { from: userWallet1 });

        const senderAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

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
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      senderProxyAddress = event.args[0];
    });
    context('full transfer', function () {
      it('should transfer all saveDAI tokens from sender to recipient', async () => {
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
        const sendercDAIbalanceBefore = await cDai.balanceOf(senderProxyAddress);
        const senderBalanceBefore = await saveDaiInstance.balanceOf(userWallet1);

        // give approval to relayer to transfer tokens on sender's behalf
        await saveDaiInstance.approve(relayer, senderBalanceBefore, { from : userWallet1 });
        const receipt = await saveDaiInstance.transferFrom(
          userWallet1, recipient, senderBalanceBefore,
          { from: relayer },
        );

        const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
        recipientProxyAddress = event.args[0];

        const sendercDAIbalanceAfter = await cDai.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDai.balanceOf(recipientProxyAddress);

        assert.equal(sendercDAIbalanceAfter.toString(), 0);
        assert.equal(sendercDAIbalanceBefore.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // get ratio and amounts to transfer
        const saveTokenBalance = await saveDaiInstance.balanceOf(userWallet1);
        amount = new BN(amount);
        const ratio = amount.div(saveTokenBalance);
        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiInstance.approve(relayer, saveTokenBalance, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, saveTokenBalance,
          { from: relayer },
        );

        const senderAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

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
        initialSaveBalance = await saveDaiInstance.balanceOf(userWallet1);
        partialTransfer = initialSaveBalance.div(new BN (4));

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderBalanceAfter = await saveDaiInstance.balanceOf(userWallet1);
        const recipientBalanceAfter = await saveDaiInstance.balanceOf(recipient);
        const senderRemainder = initialSaveBalance.sub(partialTransfer);

        assert.equal(senderRemainder.toString(), senderBalanceAfter.toString());
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

        const sendercDAIbalanceAfter = await cDai.balanceOf(senderProxyAddress);
        const recipientcDAIBalanceAfter = await cDai.balanceOf(recipientProxyAddress);

        assert.equal(remainder.toString(), sendercDAIbalanceAfter.toString());
        assert.equal(partialTransfer.toString(), recipientcDAIBalanceAfter.toString());
      });
      it('should update sender and recipient assetToken and insuranceToken balances', async () => {
        const initialSaveBalance = await saveDaiInstance.balanceOf(userWallet1);
        const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

        // partial amount to be transferred
        const partialTransfer = initialSaveBalance.div(new BN (4));
        const ratio = partialTransfer.div(initialSaveBalance);

        const assetTransfer = ratio.mul(initialAssetBalance);
        const insuranceTransfer = ratio.mul(initialInsuranceBalance);

        // give approval to relayer to transfer saveDAI tokens on sender's behalf
        await saveDaiInstance.approve(relayer, partialTransfer, { from : userWallet1 });
        await saveDaiInstance.transferFrom(
          userWallet1, recipient, partialTransfer,
          { from: relayer },
        );

        const senderAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
        const senderInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);
        const receipientAssetBalance = await saveDaiInstance.getAssetBalance(recipient);
        const receipientInsuranceBalance = await saveDaiInstance.getInsuranceBalance(recipient);

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
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      proxyAddress = event.args[0];
    });
    it('revert if the user does not have enough SaveTokens to unbundle', async () => {
      await expectRevert(saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
        'Balance must be greater than 0');
    });
    it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
      // identify initial balances
      const cDaiBalanceInitial = await cDai.balanceOf(proxyAddress);
      const ocDaiBalanceInitial = await ocDai.balanceOf(saveDaiAddress);

      // all token balances should match
      assert.equal(cDaiBalanceInitial.toString(), amount);
      assert.equal(ocDaiBalanceInitial.toString(), amount);

      // unbundle userWallet1's SaveTokens
      await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      // identify final balances
      const cDAIbalanceFinal = await cDai.balanceOf(proxyAddress);
      const ocDAIbalanceFinal = await ocDai.balanceOf(saveDaiAddress);

      diffIncDai = cDaiBalanceInitial.sub(cDAIbalanceFinal);
      diffInocDai = ocDaiBalanceInitial.sub(ocDAIbalanceFinal);

      assert.equal(diffInocDai.toString(), diffInocDai) &&
      assert.equal(diffIncDai.toString(), amount);
    });
    it('should send msg.sender the underlying asset', async () => {
      tokenAmount = await saveDaiInstance.balanceOf(userWallet1);
      tokenAmount = tokenAmount.toNumber();

      // idenitfy the user's initialUnderlyingBalance
      initialUnderlyingBalance = await dai.balanceOf(userWallet1);

      // calculate how much DAI is needed for asset
      let exchangeRate = await cDai.exchangeRateStored.call();
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
      const updatedUnderlyingBalance = await dai.balanceOf(userWallet1);
      const diff = (updatedUnderlyingBalance.sub(initialUnderlyingBalance)) / 1e18;

      assert.approximately(daiBoughtTotal, diff, 0.0000009);
    });
    it('should send msg.sender all of the rewards tokens they\'ve yielded', async () => {
      const userCompBalance = await comp.balanceOf(userWallet1);

      const metaData1 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
      const metaDataBalance1 = metaData1[0];

      assert.equal(metaDataBalance1, userCompBalance);

      await time.advanceBlock();

      await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      const userCompBalance2 = await comp.balanceOf(userWallet1);

      const metaData2 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
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

      const assetDiff = initialAssetBalance.sub(finalAssetBalance);
      const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

      assert.equal(assetDiff.toString(), amount);
      assert.equal(insuranceDiff.toString(), amount);
    });
  });
  describe('withdrawReward', function () {
    beforeEach(async () => {
      // Mint saveToken
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      proxyAddress = event.args[0];
    });
    it('should send msg.sender all of the rewards tokens they\'ve yielded', async () => {
      const userCompBalance = await comp.balanceOf(userWallet1);

      const metaData1 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
      const metaDataBalance1 = metaData1[0];

      assert.equal(metaDataBalance1, userCompBalance);

      await time.advanceBlock();

      await saveDaiInstance.withdrawReward({ from: userWallet1 });

      const userCompBalance2 = await comp.balanceOf(userWallet1);

      const metaData2 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
      const metaDataBalance2 = metaData2[0];

      assert.equal(metaDataBalance2, userCompBalance2);
    });
    it('should emit a WithdrawReward event with the msg.sender\'s address and the amount of rewards tokens withdrawn', async () => {
      await time.advanceBlock();
      const initialCOMPBalance = await comp.balanceOf(userWallet1);

      const withdrawRewardReceipt = await saveDaiInstance.withdrawReward({ from: userWallet1 });

      const finalCOMPBalance = await comp.balanceOf(userWallet1);
      diff = finalCOMPBalance.sub(initialCOMPBalance);

      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(withdrawRewardReceipt, 'WithdrawReward', { amount: diff, user: wallet });
    });
  });
  describe('withdrawAll', function () {
    beforeEach(async () => {
      // Mint saveToken
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      proxyAddress = event.args[0];
    });
    it('revert if the user does not have enough SaveTokens to unbundle', async () => {
      await expectRevert(saveDaiInstance.withdrawAll({ from: nonUserWallet }),
        'Balance must be greater than 0');
    });
    it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
      // identify initial balances
      const cDaiBalanceInitial = await cDai.balanceOf(proxyAddress);
      const ocDaiBalanceInitial = await ocDai.balanceOf(saveDaiAddress);

      // all token balances should match
      assert.equal(cDaiBalanceInitial.toString(), amount);
      assert.equal(ocDaiBalanceInitial.toString(), amount);

      // unbundle userWallet1's SaveTokens
      await saveDaiInstance.withdrawAll({ from: userWallet1 });

      // identify final balances
      const cDAIbalanceFinal = await cDai.balanceOf(proxyAddress);
      const ocDAIbalanceFinal = await ocDai.balanceOf(saveDaiAddress);

      diffIncDai = cDaiBalanceInitial.sub(cDAIbalanceFinal);
      diffInocDai = ocDaiBalanceInitial.sub(ocDAIbalanceFinal);

      assert.equal(diffInocDai.toString(), diffInocDai) &&
      assert.equal(diffIncDai.toString(), amount);
    });
    it('should send msg.sender all of the underlying asset', async () => {
      tokenAmount = await saveDaiInstance.balanceOf(userWallet1);
      tokenAmount = tokenAmount.toNumber();

      // idenitfy the user's initialUnderlyingBalance
      initialUnderlyingBalance = await dai.balanceOf(userWallet1);

      // calculate how much DAI is needed for asset
      let exchangeRate = await cDai.exchangeRateStored.call();
      exchangeRate = exchangeRate / 1e18;
      daiReedem = (tokenAmount * exchangeRate) / 1e18;

      // calculate ocDAI for DAI on uniswap
      const eth = await ocDaiExchange.getTokenToEthInputPrice(tokenAmount);
      let daiSwapped = await daiExchange.getEthToTokenInputPrice(eth);
      daiSwapped = daiSwapped / 1e18;

      // add daiReedem + daiSwapped together, should be really close to diff
      const daiBoughtTotal = daiReedem + daiSwapped;

      // unbundle userWallet1's tokens
      await saveDaiInstance.withdrawAll({ from: userWallet1 });

      // idenitfy the user's updatedUnderlyingBalance
      const updatedUnderlyingBalance = await dai.balanceOf(userWallet1);
      const diff = (updatedUnderlyingBalance.sub(initialUnderlyingBalance)) / 1e18;

      assert.approximately(daiBoughtTotal, diff, 0.0000009);
    });
    it('should send msg.sender all of the rewards tokens they\'ve yielded', async () => {
      const userCompBalance = await comp.balanceOf(userWallet1);

      const metaData1 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
      const metaDataBalance1 = metaData1[0];

      assert.equal(metaDataBalance1, userCompBalance);

      await time.advanceBlock();

      await saveDaiInstance.withdrawAll({ from: userWallet1 });

      const userCompBalance2 = await comp.balanceOf(userWallet1);

      const metaData2 = await lensContract.methods.getCompBalanceMetadataExt(
        compAddress, comptrollerAddress, userWallet1).call();
      const metaDataBalance2 = metaData2[0];

      assert.equal(metaDataBalance2, userCompBalance2);
    });
    it('should emit a WithdrawAll event with the msg.sender\'s address and the amount of SaveTokens unbundled', async () => {
      // unbundle all of userWallet1's tokens
      const withdrawalReceipt = await saveDaiInstance.withdrawAll({ from: userWallet1 });

      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(withdrawalReceipt, 'WithdrawAll', { amount: amount, user: wallet });
    });
    it('should empty the user\'s assetTokens and insuranceTokens balances', async () => {
      const initialAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
      const initialInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

      // unbundle userWallet's SaveTokens
      await saveDaiInstance.withdrawAll({ from: userWallet1 });

      const finalAssetBalance = await saveDaiInstance.getAssetBalance(userWallet1);
      const finalInsuranceBalance = await saveDaiInstance.getInsuranceBalance(userWallet1);

      const assetDiff = initialAssetBalance.sub(finalAssetBalance);
      const insuranceDiff = initialInsuranceBalance.sub(finalInsuranceBalance);

      assert.equal(finalAssetBalance, 0);
      assert.equal(finalInsuranceBalance, 0);
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
  describe('getRewardsBalance', async function () {
    beforeEach(async () => {
      // Mint saveToken
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      proxyAddress = event.args[0];
    });
    it('should return total rewards balance that has yielded', async () => {
      // It isn't possible to get compAccrued on-chain w/ a view function
      // To test returning arbitrary uint256 to comform to IAsset & test _staticcall
      const mockCompBalance = 12345;
      const rewardsBalance = await saveDaiInstance.getRewardsBalance(userWallet1);

      assert.equal(rewardsBalance, mockCompBalance);
    });
  });
});


