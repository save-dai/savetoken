/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */

const SaveToken = artifacts.require('SaveToken');
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');

contract('SaveToken', async (accounts) => {
  const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
  const aaveAdapter = accounts[1];
  const aDaiAddress = accounts[2];
  const ocDaiAddress = accounts[3];
  const receiver1 = accounts[4];
  const receiver2 = accounts[5];

  describe('one saveToken', function () {
    before(async () => {
      compoundAdapter = await CompoundAdapter.new();
      opynAdapter = await OpynAdapter.new();

      saveToken = await SaveToken.new(
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );
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
      await saveToken.mint(receiver1, amount);
      const balance = await saveToken.balanceOf(receiver1);
      const totalSupply = await saveToken.totalSupply();
      assert.equal((amount * 2), balance.toNumber());
      assert.equal((amount * 2), totalSupply.toNumber());
    });
  });

  describe('multiple saveTokens deployed', function () {
    before(async () => {
      compoundAdapter = await CompoundAdapter.new();
      opynAdapter = await OpynAdapter.new();

      saveToken = await SaveToken.new(
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );

      saveToken2 = await SaveToken.new(
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
      await saveToken.mint(receiver1, amount);
      const balance = await saveToken.balanceOf(receiver1);
      const totalSupply = await saveToken.totalSupply();
      assert.equal((amount * 2), balance.toNumber());
      assert.equal((amount * 2), totalSupply.toNumber());


      const amount2 = 300;
      await saveToken2.mint(receiver2, amount2);
      const balance2 = await saveToken2.balanceOf(receiver2);
      const totalSupply2 = await saveToken2.totalSupply();

      assert.equal((amount2 * 2), balance2.toNumber());
      assert.equal((amount2 * 2), totalSupply2.toNumber());

    });


  });


});
