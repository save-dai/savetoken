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
const COMPFarmer = artifacts.require('COMPFarmer');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');
const ERC20 = artifacts.require('ERC20');
const ICToken = artifacts.require('ICToken');
const IOToken = artifacts.require('IOToken');
const IUniswapFactory = artifacts.require('IUniswapFactory');
const IUniswapExchange = artifacts.require('IUniswapExchange');

// mainnet addresses
const compAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888';
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

const userWallet1 = '0xe8b1764ae2e927c61c0bf15fe39fa508e6bb426d';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';

const userWallet2 = '0xa1a69453e299aa567214d0f2714084cb3b7e9ce1';
const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const cUSDCAddress = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';
const ocUSDCAddress = '0x8ED9f862363fFdFD3a07546e618214b6D59F03d4';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const nonUserWallet = accounts[1];
  const amount = '4892167171';

  beforeEach(async () => {
    // deploys the farmer's logic contract
    compFarmer = await COMPFarmer.new();
    saveTokenFactory = await SaveTokenFactory.new();
    compoundAdapter = await CompoundAdapter.new(compAddress);
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
      compFarmer.address,
      'SaveDAI',
      'SDT',
      8,
    );
    saveDaiAddress = saveToken.logs[0].args.addr;
    saveDaiInstance = await SaveToken.at(saveDaiAddress);

    // instantiate mock tokens
    daiInstance = await ERC20.at(daiAddress);
    usdcInstance = await ERC20.at(usdcAddress);
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
      to: userWallet1,
      value: ether('1'),
    });

    await daiInstance.approve(saveDaiAddress, ether('10'), { from: userWallet1 });
  });
  it('user wallet should have DAI balance', async () => {
    const userWalletBalance = await daiInstance.balanceOf(userWallet1);
    expect(new BN(userWalletBalance)).to.be.bignumber.least(new BN(ether('0.1')));
  });
  it('user wallet2 should have USDC balance', async () => {
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
        const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });

        // Step 5. get address of COMP proxy
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

      it.skip('should mint second saveToken', async () => {

      });
    });
  });

  describe('withdrawForUnderlyingAsset', function () {
    it('revert if the user does not have enough SaveTokens to unbundle', async () => {
      await expectRevert(saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: nonUserWallet }),
        'User must have enough SaveTokens to unbundle');
    });
    it('should decrease insuranceTokens from SaveToken contract and assetTokens from farmer', async () => {
      const receipt = await saveDaiInstance.mint(amount, { from: userWallet1 });

      // identify userWallet1's rewards farmer proxy
      const event = await expectEvent.inTransaction(receipt.tx, CompoundAdapter, 'ProxyCreated');
      const proxyAddress = event.args[0];

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

      assert.equal(diffIncDai.toString(), amount);
      assert.equal(diffInocDai.toString(), amount);
    });
    it('should send msg.sender the underlying asset', async () => {
      await saveDaiInstance.mint(amount, { from: userWallet1 });

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

      assert.approximately(daiBoughtTotal, diff, 0.0000009);
    });
    it('should emit a WithdrawForUnderlyingAsset event with the msg.sender\'s address and the amount of SaveTokens withdrawn', async () => {
      await saveDaiInstance.mint(amount, { from: userWallet1 });

      // unbundle userWallet1's tokens
      const receipt = await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      // identify userWallet1's rewards farmer proxy
      const event = await expectEvent.inTransaction(receipt.tx, SaveToken, 'WithdrawForUnderlyingAsset');

      assert.equal(event.event, 'WithdrawForUnderlyingAsset');
      // assert msg.sender's address emits in the event
      assert.equal(event.args[0].toLowerCase(), userWallet1);

      // assert the correct amount was withdrawn
      assert.equal(event.args[1], amount);
    });
    it('should burn the amount of msg.sender\'s SaveTokens', async () => {
      await saveDaiInstance.mint(amount, { from: userWallet1 });

      const initialBalance = await saveDaiInstance.balanceOf(userWallet1);

      // unbundle userWallet's SaveTokens
      await saveDaiInstance.withdrawForUnderlyingAsset(amount, { from: userWallet1 });

      // Idenitfy the user's finanl balance
      const finalBalance = await saveDaiInstance.balanceOf(userWallet1);

      // Calculate the difference in saveDAI tokens
      const diff = initialBalance - finalBalance;

      assert.equal(diff, amount);
    });
  });
});
