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
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');
const SaveTokenFarmer = artifacts.require('SaveTokenFarmer');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');
const ERC20 = artifacts.require('ERC20');
const ICToken = artifacts.require('ICToken');
const IOToken = artifacts.require('IOToken');
const IUniswapFactory = artifacts.require('IUniswapFactory');

// mainnet addresses
const compAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888';
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

const userWallet1 = '0x897607ab556177b0e0938541073ac1e01c55e483';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';

const userWallet2 = '0xa1a69453e299aa567214d0f2714084cb3b7e9ce1';
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const cUSDCAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ocUSDCAddress = '0x8ED9f862363fFdFD3a07546e618214b6D59F03d4';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];

  beforeEach(async () => {
    // deploys the farmer's logic contract
    saveTokenFarmer = await SaveTokenFarmer.new();
    saveTokenFactory = await SaveTokenFactory.new();
    compoundAdapter = await CompoundAdapter.new();
    opynAdapter = await OpynAdapter.new();

    compoundAdapterInstance = await CompoundAdapter.at(compoundAdapter.address);
    opynAdapterInstance = await OpynAdapter.at(opynAdapter.address);

    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      cDaiAddress,
      opynAdapter.address,
      ocDaiAddress,
      uniswapFactoryAddress,
      'SaveDAI',
      'SDT',
      8,
    );
    saveDaiAddress = saveToken.logs[0].args.addr;
    saveDaiInstance = await SaveToken.at(saveDaiAddress);

    saveToken2 = await saveTokenFactory.createSaveToken(
      usdcAddress,
      compoundAdapter.address,
      cUSDCAddress,
      opynAdapter.address,
      ocUSDCAddress,
      uniswapFactoryAddress,
      'SaveUSDC',
      'SUT',
      8,
    );
    saveUsdcAddress = saveToken2.logs[0].args.addr;
    saveUsdcInstance = await SaveToken.at(saveUsdcAddress);

    // instantiate mock tokens
    daiInstance = await ERC20.at(daiAddress);
    usdcInstance = await ERC20.at(usdcAddress);
    compInstance = await ERC20.at(compAddress);
    ocDaiInstance = await IOToken.at(ocDaiAddress);
    cDaiInstance = await ICToken.at(cDaiAddress);
    uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);

    // Send eth to userAddress to have gas to send an ERC20 tx.
    await web3.eth.sendTransaction({
      from: owner,
      to: userWallet1,
      value: ether('1'),
    });

    // Send eth to userAddress to have gas to send an ERC20 tx.
    await web3.eth.sendTransaction({
      from: owner,
      to: userWallet2,
      value: ether('1'),
    });

    await daiInstance.approve(saveDaiAddress, ether('10'), { from: userWallet1 });
    await daiInstance.approve(saveUsdcAddress, ether('10'), { from: userWallet2 });
  });
  it('user wallet should have DAI balance', async () => {
    const userWalletBalance = await daiInstance.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(ether('0.1')));
  });
  it('user wallet should have USDC balance', async () => {
    const userWalletBalance = await usdcInstance.balanceOf(userWallet2);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(1000));
  });
  it('should send ether to the DAI address', async () => {
    const ethBalance = await balance.current(userWallet1);
    expect(new BN(ethBalance)).to.be.bignumber.least(new BN(ether('0.1')));
  });

  describe('mint', function () {
    context('one saveToken', function () {

      it('should mint SaveTokens', async () => {
        amount = '4892167171';

        // Step 1. Calculate how much DAI is needed for asset
        let exchangeRate = await cDaiInstance.exchangeRateStored.call();
        exchangeRate = (exchangeRate.toString()) / 1e18;
        let assetCost = amount * exchangeRate;
        assetCost = new BN(assetCost.toString());

        // console.log('assetCost', assetCost.toString());

        // Step 2. Calculate how much DAI is needed for insurance
        let insuranceCost = await saveDaiInstance.getCostOfInsurance.call(amount, { from: userWallet1 });

        // console.log('insuranceCost', insuranceCost.toString());

        // Step 3. Add costs together, add extra, and approve
        const totalDaiCost = assetCost.add(insuranceCost);
        amountToApprove = totalDaiCost.add(new BN(ether('0.1')));
        // console.log('amountToApprove', amountToApprove.toString());

        await daiInstance.approve(saveDaiAddress, amountToApprove, { from: userWallet1 });

        // Step 4. mint saveDAI
        await saveDaiInstance.mint(amount, { from: userWallet1 });

        const ocDAIbalance = await ocDaiInstance.balanceOf(saveDaiAddress);
        const cDAIbalance = await cDaiInstance.balanceOf(saveDaiAddress);
        const saveDaiMinted = await saveDaiInstance.balanceOf(userWallet1);

        // all token balances should match
        assert.equal(cDAIbalance.toString(), amount);
        assert.equal(ocDAIbalance.toString(), amount);
        assert.equal(saveDaiMinted.toString(), amount);
      });
    });

    context('multiple SaveTokens deployed', function () {
      it('should deploy a new SaveToken with new info', async () => {
        const name = await saveUsdcInstance.name.call();
        const symbol = await saveUsdcInstance.symbol.call();
        const decimals = await saveUsdcInstance.decimals.call();

        assert.equal('SaveUSDC', name);
        assert.equal('SUT', symbol);
        assert.equal(8, decimals.toNumber());
      });

      it.skip('should mint second saveToken', async () => {

      });
    });
  });

  describe('withdrawForUnderlyingAsset', function () {
    it.skip('revert if ths user does not have a farmer address', async () => {

    });
    it.skip('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {

    });
    it.skip('should send msg.sender the underlying asset', async () => {

    });
    it.skip('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {

    });
    it.skip('should burn the amount of msg.sender\'s SaveTokens', async () => {

    });
  });
});
