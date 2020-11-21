/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */

const {
  ether,
} = require('@openzeppelin/test-helpers');

const SaveToken = artifacts.require('SaveToken');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');
const ERC20 = artifacts.require('ERC20');

// mainnet addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const userWallet = '0x897607ab556177b0e0938541073ac1e01c55e483';

contract('SaveToken', async (accounts) => {
  const owner = accounts[0];
  const aDaiAddress = accounts[1];
  const ocDaiAddress = accounts[2];

  describe('one saveToken', function () {
    before(async () => {
      compoundAdapter = await CompoundAdapter.new(cDaiAddress);
      opynAdapter = await OpynAdapter.new();

      saveToken = await SaveToken.new(
        daiAddress,
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );
      saveTokenAddress = saveToken.address;

      // instantiate mock tokens
      daiInstance = await ERC20.at(daiAddress);

      // Send eth to userAddress to have gas to send an ERC20 tx.
      await web3.eth.sendTransaction({
        from: owner,
        to: userWallet,
        value: ether('10'),
      });

      await daiInstance.approve(saveTokenAddress, ether('1'), { from: userWallet });
    });

    it('should return token metadata', async () => {
      const name = await saveToken.name.call();
      const symbol = await saveToken.symbol.call();
      const decimals = await saveToken.decimals.call();
      assert.equal('SaveDAI', name);
      assert.equal('SDT', symbol);
      assert.equal(8, decimals.toNumber());
    });
    it('should mint saveDAI tokens', async () => {
      const amount = 119;
      await saveToken.mint(amount, { from: userWallet });
      const balance = await saveToken.balanceOf(userWallet);
      const totalSupply = await saveToken.totalSupply();
      assert.equal((amount), balance.toNumber());
      assert.equal((amount), totalSupply.toNumber());
    });
  });

  describe('multiple saveTokens deployed', function () {
    before(async () => {
      compoundAdapter = await CompoundAdapter.new(cDaiAddress);
      opynAdapter = await OpynAdapter.new();

      saveToken = await SaveToken.new(
        daiAddress,
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );

      saveToken2 = await SaveToken.new(
        daiAddress,
        compoundAdapter.address,
        aDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveUSDC',
        'SUT',
        8,
      );
    });

    it('should deploy a new saveToken with new info', async () => {
      const name = await saveToken2.name.call();
      const symbol = await saveToken2.symbol.call();
      const decimals = await saveToken2.decimals.call();

      assert.equal('SaveUSDC', name);
      assert.equal('SUT', symbol);
      assert.equal(8, decimals.toNumber());
    });

    it('should return different balances for the two saveToken contracts', async () => {
      const amount = 150;
      await saveToken.mint(amount, { from: userWallet });
      const balance = await saveToken.balanceOf(userWallet);
      const totalSupply = await saveToken.totalSupply();
      assert.equal(amount, balance.toNumber());
      assert.equal(amount, totalSupply.toNumber());


      const amount2 = 300;
      await saveToken2.mint(amount2, { from: userWallet });
      const balance2 = await saveToken2.balanceOf(userWallet);
      const totalSupply2 = await saveToken2.totalSupply();

      assert.equal(amount2, balance2.toNumber());
      assert.equal(amount2, totalSupply2.toNumber());
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
