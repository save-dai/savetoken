/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */

const {
  ether,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');
const SaveTokenFarmer = artifacts.require('SaveTokenFarmer');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');
const ERC20 = artifacts.require('ERC20');

// mainnet addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const userWallet = '0x897607ab556177b0e0938541073ac1e01c55e483';
const compAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888';
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const aDaiAddress = accounts[1];
  const ocDaiAddress = accounts[2];

  before(async () => {
    // deploys the farmer's logic contract
    saveTokenFarmer = await SaveTokenFarmer.new();
    saveTokenFarmerAddress = saveTokenFarmer.address;
    saveTokenFactory = await SaveTokenFactory.new();
    compoundAdapter = await CompoundAdapter.new();
    opynAdapter = await OpynAdapter.new();


    saveToken = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      cDaiAddress,
      opynAdapter.address,
      ocDaiAddress,
      uniswapFactoryAddress,
      compAddress,
      saveTokenFarmerAddress,
      'SaveDAI',
      'SDT',
      8,
    );
    saveTokenAddress = saveToken.logs[0].args.addr;
    saveTokenInstance = await SaveToken.at(saveTokenAddress);

    saveToken2 = await saveTokenFactory.createSaveToken(
      daiAddress,
      compoundAdapter.address,
      aDaiAddress,
      opynAdapter.address,
      ocDaiAddress,
      uniswapFactoryAddress,
      compAddress,
      saveTokenFarmerAddress,
      'SaveUSDC',
      'SUT',
      8,
    );
    saveToken2Address = saveToken2.logs[0].args.addr;
    saveToken2Instance = await SaveToken.at(saveToken2Address);

    // instantiate mock tokens
    daiInstance = await ERC20.at(daiAddress);
    compInstance = await ERC20.at(compAddress);

    // Send eth to userAddress to have gas to send an ERC20 tx.
    await web3.eth.sendTransaction({
      from: owner,
      to: userWallet,
      value: ether('10'),
    });

    await daiInstance.approve(saveTokenAddress, ether('1'), { from: userWallet });
    await daiInstance.approve(saveToken2Address, ether('1'), { from: userWallet });
  });

  describe('mint', function () {
    context('one saveToken', function () {
      it('should return token metadata', async () => {
        const name = await saveTokenInstance.name.call();
        const symbol = await saveTokenInstance.symbol.call();
        const decimals = await saveTokenInstance.decimals.call();
        assert.equal('SaveDAI', name);
        assert.equal('SDT', symbol);
        assert.equal(8, decimals.toNumber());
      });
      it('should mint SaveToekns', async () => {
        const amount = 119;
        await saveTokenInstance.mint(amount, { from: userWallet });
        const balance = await saveTokenInstance.balanceOf(userWallet);
        const totalSupply = await saveTokenInstance.totalSupply();
        assert.equal((amount), balance.toNumber());
        assert.equal((amount), totalSupply.toNumber());
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

      it('should return different balances for the two SaveToken contracts', async () => {
        const amount = 150;
        let initialBalance = await saveTokenInstance.balanceOf(userWallet);
        let initialSupply = await saveTokenInstance.totalSupply();

        await saveTokenInstance.mint(amount, { from: userWallet });

        const finalBalance = await saveTokenInstance.balanceOf(userWallet);
        const finalTotalSupply = await saveTokenInstance.totalSupply();

        assert.equal(amount, (finalBalance.sub(initialBalance)).toNumber());
        assert.equal(amount, (finalTotalSupply.sub(initialSupply)).toNumber());

        const amount2 = 300;
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
