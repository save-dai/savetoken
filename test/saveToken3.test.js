/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');

const {
  getDAI,
} = require('./utils.js');

const {
  constants,
  ether,
  BN,
  expectRevert,
  expectEvent,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');

const AaveAdapter = artifacts.require('AaveAdapter');
const MockInsuranceAdapter = artifacts.require('MockInsurance');
const MockInsuranceToken = artifacts.require('MockInsuranceToken');

const IERC20 = artifacts.require('IERC20');
const IAToken = artifacts.require('IAToken');

const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const aDaiAddress = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';

// MOCKINSURANCE AAVE TOKEN
contract.only('SaveDAI_Aave_MockInsurance_Expires_XX_XXX_XXXX', async (accounts) => {
  const owner = accounts[0];
  const userWallet1 = accounts[1];
  const nonUserWallet = accounts[2];
  const amount = ether('150'); // 150 saveTokens

  before(async () => {
    dai = await IERC20.at(daiAddress);
    aDai = await IAToken.at(aDaiAddress);

    // swap ETH for DAI
    await getDAI(userWallet1);
  });

  beforeEach(async () => {
    mockInsuranceAdapter = await MockInsuranceAdapter.new();
    mockInsuranceAdapterInstance = await MockInsuranceAdapter.at(mockInsuranceAdapter.address);

    mockInsuranceToken = await MockInsuranceToken.new('mockInsurance', 'MI');
    insuranceToken = await IERC20.at(mockInsuranceToken.address);

    saveTokenFactory = await SaveTokenFactory.new(owner);

    aaveAdapter = await AaveAdapter.new();

    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      aaveAdapter.address,
	  aDaiAddress,
	  mockInsuranceAdapter.address,
	  mockInsuranceToken.address,
	  constants.ZERO_ADDRESS,
	  constants.ZERO_ADDRESS,
	  'SaveDAI_Aave_MockInsurance_Expires_XX_XXX_XXXX',
	  'SaveDAI__XX_XXX_XXXX',
	  18,
    );
    saveDaiAaveAddress = saveToken.logs[0].args.addr;
    saveDaiAaveInstance = await SaveToken.at(saveDaiAaveAddress);

    // approve 1000 DAI
    await dai.approve(saveDaiAaveAddress, ether('1000'), { from: userWallet1 });
  });

  describe('mint', function () {
    it('should mint SaveTokens', async () => {
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });

	  const insuranceBalance = await insuranceToken.balanceOf(saveDaiAaveAddress);
	  const aDAIbalance = await aDai.balanceOf(saveDaiAaveAddress);
	  const saveDaiAaveMinted = await saveDaiAaveInstance.balanceOf(userWallet1);

	  // saveDAI and aDAI should match
	  assert.equal(aDAIbalance.toString(), amount);
	  assert.equal(saveDaiAaveMinted.toString(), amount);
	  assert.equal(insuranceBalance.toString(), amount);
    });
    it('should emit the amount of tokens minted', async () => {
	  const receipt = await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
	  const wallet = web3.utils.toChecksumAddress(userWallet1);
	  expectEvent(receipt, 'Mint', { amount: amount, user: wallet });
    });
  });

  describe('withdrawForUnderlyingAsset', function () {
    beforeEach(async () => {
      // approve 1000 DAI
      await dai.approve(saveDaiAaveAddress, ether('1000'), { from: userWallet1 });
      // Mint saveToken
      await saveDaiAaveInstance.mint(amount, { from: userWallet1 });
    });
    it('should decrease insuranceTokens and assetTokens from SaveToken contract', async () => {
      // identify initial balances
      const aDAIbalanceInitial = await aDai.balanceOf(saveDaiAaveAddress);
      const insuranceBalanceInitial = await insuranceToken.balanceOf(saveDaiAaveAddress);

      // unbundle userWallet1's SaveTokens
      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      // identify final balances
      const aDAIbalanceFinal = await aDai.balanceOf(saveDaiAaveAddress);
      const insuranceBalanceFinal = await insuranceToken.balanceOf(saveDaiAaveAddress);

      diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
      diffInInsurance = insuranceBalanceInitial.sub(insuranceBalanceFinal);

      assert.equal(diffInInsurance.toString(), amount.toString());
    });
    it('should send msg.sender the underlying asset', async () => {
      initialUnderlyingBalance = await dai.balanceOf(userWallet1);

      // NOTE: not selling mock insurance tokens for underlying
      // the diffInDai in this mock instance only accounts for
      // withdrawing from Aave lending pool

      await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      finalUnderlyingBalance = await dai.balanceOf(userWallet1);

      let diffInDai = finalUnderlyingBalance.sub(initialUnderlyingBalance);

      assert.equal(amount.toString(), diffInDai.toString());
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
    it('should decrease insuranceTokens and assetTokens from SaveToken contract', async () => {
	  // identify initial balances
	  const aDAIbalanceInitial = await aDai.balanceOf(saveDaiAaveAddress);
	  const insuranceBalanceInitial = await insuranceToken.balanceOf(saveDaiAaveAddress);

	  // unbundle userWallet1's SaveTokens
	  await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

	  // identify final balances
	  const aDAIbalanceFinal = await aDai.balanceOf(saveDaiAaveAddress);
	  const insuranceBalanceFinal = await insuranceToken.balanceOf(saveDaiAaveAddress);

	  diffInaDai = aDAIbalanceInitial.sub(aDAIbalanceFinal);
	  diffInInsurance = insuranceBalanceInitial.sub(insuranceBalanceFinal);

	  assert.equal(diffInInsurance.toString(), amount.toString());
    });
    it('should send msg.sender all of the underlying asset', async () => {
	  initialUnderlyingBalance = await dai.balanceOf(userWallet1);

	  // NOTE: not selling mock insurance tokens for underlying
	  // the diffInDai in this mock instance only accounts for
	  // withdrawing from Aave lending pool

	  await saveDaiAaveInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

	  finalUnderlyingBalance = await dai.balanceOf(userWallet1);

	  let diffInDai = finalUnderlyingBalance.sub(initialUnderlyingBalance);

	  assert.equal(amount.toString(), diffInDai.toString());
    });
    it('should emit a WithdrawAll event with the msg.sender\'s address and the amount of SaveTokens unbundled', async () => {
      // unbundle all of userWallet1's tokens
      const withdrawalReceipt = await saveDaiAaveInstance.withdrawAll({ from: userWallet1 });

      const wallet = web3.utils.toChecksumAddress(userWallet1);
      expectEvent(withdrawalReceipt, 'WithdrawAll', { amount: amount, user: wallet });
    });
  });
});
