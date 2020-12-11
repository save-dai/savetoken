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
const IUniswapExchange = artifacts.require('IUniswapExchange');

// mainnet addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const userWallet = '0x897607ab556177b0e0938541073ac1e01c55e483';
const compAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888';
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';
const cUSDCAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';
const ocUSDCAddress = '0x8ED9f862363fFdFD3a07546e618214b6D59F03d4';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const amount = '4892167171';
  const amount2 = '9784334342';

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
    saveTokenAddress = saveToken.logs[0].args.addr;
    saveTokenInstance = await SaveToken.at(saveTokenAddress);

    saveToken2 = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      cUSDCAddress,
      opynAdapter.address,
      ocUSDCAddress,
      uniswapFactoryAddress,
      'SaveUSDC',
      'SUT',
      8,
    );
    saveToken2Address = saveToken2.logs[0].args.addr;
    saveToken2Instance = await SaveToken.at(saveToken2Address);

    // instantiate mock tokens
    daiInstance = await ERC20.at(daiAddress);
    compInstance = await ERC20.at(compAddress);
    ocDaiInstance = await IOToken.at(ocDaiAddress);
    cDaiInstance = await ICToken.at(cDaiAddress);
    uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);
    ocDaiExchangeAddress = await uniswapFactory.getExchange(ocDaiAddress);
    ocDaiExchange = await IUniswapExchange.at(ocDaiExchangeAddress);
    daiExchangeAddress = await uniswapFactory.getExchange(daiAddress);
    daiExchange = await IUniswapExchange.at(daiExchangeAddress);

    // Send eth to userAddress to have gas to send an ERC20 tx.
    await web3.eth.sendTransaction({
      from: owner,
      to: userWallet,
      value: ether('10'),
    });

    await daiInstance.approve(saveTokenAddress, ether('10'), { from: userWallet });
    await daiInstance.approve(saveToken2Address, ether('1'), { from: userWallet });
  });

  it('user wallet should have DAI balance', async () => {
    const userWalletBalance = await daiInstance.balanceOf(userWallet);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(ether('0.1')));
  });
  it('should send ether to the DAI address', async () => {
    const ethBalance = await balance.current(userWallet);
    expect(new BN(ethBalance)).to.be.bignumber.least(new BN(ether('0.1')));
  });

  describe('mint', function () {
    context('one saveToken deployed', function () {
      it('should mint SaveTokens', async () => {
        // Step 1. Calculate how much DAI is needed for asset
        let exchangeRate = await cDaiInstance.exchangeRateStored.call();
        exchangeRate = (exchangeRate.toString()) / 1e18;
        let assetCost = amount * exchangeRate;
        assetCost = new BN(assetCost.toString());

        // console.log('assetCost', assetCost.toString());

        // Step 2. Calculate how much DAI is needed for insurance
        let insuranceCost = await saveTokenInstance.getCostOfInsurance.call(amount, { from: userWallet });

        // console.log('insuranceCost', insuranceCost.toString());

        // Step 3. Add costs together, add extra, and approve
        const totalDaiCost = assetCost.add(insuranceCost);
        amountToApprove = totalDaiCost.add(new BN(ether('0.1')));
        // console.log('amountToApprove', amountToApprove.toString());

        await daiInstance.approve(saveTokenAddress, amountToApprove, { from: userWallet });

        // Step 4. mint saveDAI
        await saveTokenInstance.mint(amount, { from: userWallet });

        const ocDAIbalance = await ocDaiInstance.balanceOf(saveTokenAddress);
        const cDAIbalance = await cDaiInstance.balanceOf(saveTokenAddress);
        const saveDaiMinted = await saveTokenInstance.balanceOf(userWallet);

        // all token balances should match
        assert.equal(cDAIbalance.toString(), amount);
        assert.equal(ocDAIbalance.toString(), amount);
        assert.equal(saveDaiMinted.toString(), amount);
      });
    });

    context('multiple SaveTokens deployed', function () {
      it('should deploy a new SaveToken with new info', async () => {
        const name = await saveToken2Instance.name.call();
        const symbol = await saveToken2Instance.symbol.call();
        const decimals = await saveToken2Instance.decimals.call();

        assert.equal('SaveUSDC', name);
        assert.equal('SUT', symbol);
        assert.equal(8, decimals.toNumber());
      });

      it.skip('should return different balances for the two SaveToken contracts', async () => {
        let initialBalance = await saveTokenInstance.balanceOf(userWallet);
        let initialSupply = await saveTokenInstance.totalSupply();

        await saveTokenInstance.mint(amount, { from: userWallet });

        const finalBalance = await saveTokenInstance.balanceOf(userWallet);
        const finalTotalSupply = await saveTokenInstance.totalSupply();

        assert.equal(amount, (finalBalance.sub(initialBalance)).toNumber());
        assert.equal(amount, (finalTotalSupply.sub(initialSupply)).toNumber());

        await saveToken2Instance.mint(amount2, { from: userWallet });
        const balance2 = await saveToken2Instance.balanceOf(userWallet);
        const totalSupply2 = await saveToken2Instance.totalSupply();

        assert.equal(amount2, balance2.toNumber());
        assert.equal(amount2, totalSupply2.toNumber());
      });
    });
  });

  describe('withdrawForUnderlyingAsset', function () {
    it.skip('revert if ths user does not have a farmer address', async () => {

    });
    it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
      await saveTokenInstance.mint(amount, { from: userWallet });
      // identify initial balances
      const cDaiBalanceInitial = await cDaiInstance.balanceOf(saveTokenAddress);
      const ocDaiBalanceInitial = await ocDaiInstance.balanceOf(saveTokenAddress);

      const cDAIbalance = await cDaiInstance.balanceOf(saveTokenAddress);
      const ocDAIbalance = await ocDaiInstance.balanceOf(saveTokenAddress);

      // all token balances should match
      assert.equal(cDAIbalance.toString(), amount);
      assert.equal(ocDAIbalance.toString(), amount);

      // unbundle userWallet's SaveTokens
      await saveTokenInstance.withdrawForUnderlyingAsset(amount, { from: userWallet });

      // identify final balances
      const cDAIbalanceFinal = await cDaiInstance.balanceOf(saveTokenAddress);
      const ocDAIbalanceFinal = await ocDaiInstance.balanceOf(saveTokenAddress);

      diffIncDai = cDaiBalanceInitial.sub(cDAIbalanceFinal);
      diffInocDai = ocDaiBalanceInitial.sub(ocDAIbalanceFinal);

      assert.equal(diffIncDai.toString(), amount);
      assert.equal(ocDAIbalance.toString(), amount);
    });
    it('should send msg.sender the underlying asset', async () => {
      await saveTokenInstance.mint(amount, { from: userWallet });

      tokenAmount = await saveTokenInstance.balanceOf(userWallet);
      tokenAmount = tokenAmount.toNumber();

      // idenitfy the user's initialUnderlyingBalance
      initialUnderlyingBalance = await daiInstance.balanceOf(userWallet);

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

      // unbundle userWallet's SaveTokens
      await saveTokenInstance.withdrawForUnderlyingAsset(amount, { from: userWallet });

      // idenitfy the user's updatedUnderlyingBalance
      const updatedUnderlyingBalance = await daiInstance.balanceOf(userWallet);
      const diff = (updatedUnderlyingBalance.sub(initialUnderlyingBalance)) / 1e18;

      assert.approximately(daiBoughtTotal, diff, 0.0000009);
    });
    it('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {
      await saveTokenInstance.mint(amount, { from: userWallet });
      // unbundle userWallet's SaveTokens
      const transaction = await saveTokenInstance.withdrawForUnderlyingAsset(amount, { from: userWallet });
      // assert WithdrawForUnderlyingAsset fires
      const event = await transaction.logs[7].event;
      assert.equal(event, 'WithdrawForUnderlyingAsset');

      // assert msg.sender's address emits in the event
      const userAddress = await transaction.logs[7].args.user;
      assert.equal(userAddress.toLowerCase(), userWallet);

      // assert the correct amount was withdrawn
      const insuranceRemovedAmount = await transaction.logs[7].args.amount;
      assert.equal(insuranceRemovedAmount.toString(), amount);
    });
    it('should burn the amount of msg.sender\'s SaveTokens', async () => {
      await saveTokenInstance.mint(amount, { from: userWallet });

      const initialBalance = await saveTokenInstance.balanceOf(userWallet);

      // unbundle userWallet's SaveTokens
      await saveTokenInstance.withdrawForUnderlyingAsset(amount, { from: userWallet });

      // Idenitfy the user's finanl balance
      const finalBalance = await saveTokenInstance.balanceOf(userWallet);

      // Calculate the difference in saveDAI tokens
      const diff = initialBalance - finalBalance;

      assert.equal(diff, amount);
    });
  });
});
