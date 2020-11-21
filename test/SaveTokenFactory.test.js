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
const CompoundAdapter = artifacts.require('CompoundAdapter');
const OpynAdapter = artifacts.require('OpynAdapter');

// mainnet addresses
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';

contract('SaveTokenFactory', async (accounts) => {
  const aaveAdapter = accounts[1];
  const aDaiAddress = accounts[2];
  const ocDaiAddress = accounts[3];
  const receiver1 = accounts[4];
  const receiver2 = accounts[5];

  before(async () => {
    saveTokenFactory = await SaveTokenFactory.new();
    compoundAdapter = await CompoundAdapter.new(cDaiAddress);
    opynAdapter = await OpynAdapter.new();
  });

  describe('createSaveToken', function () {
    it('should deploy saveToken and add address to the saveTokens array', async () => {
      saveToken = await saveTokenFactory.createSaveToken(
        daiAddress,
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );
      const address = saveToken.logs[0].args.addr;
      const saveTokenAddress = await saveTokenFactory.saveTokens.call(0);
      assert.equal(address, saveTokenAddress);
    });

    it('should emit SaveTokenCreated event', async () => {
      const { logs }  = await saveTokenFactory.createSaveToken(
        daiAddress,
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );
      expectEvent.inLogs(logs, 'SaveTokenCreated');
    });
    it('should set token metadata', async () => {
      saveToken = await saveTokenFactory.createSaveToken(
        daiAddress,
        compoundAdapter.address,
        cDaiAddress,
        opynAdapter.address,
        ocDaiAddress,
        'SaveDAI',
        'SDT',
        8,
      );
      const address = saveToken.logs[0].args.addr;
      const saveTokenInstance = await SaveToken.at(address);
      const name = await saveTokenInstance.name.call();
      const symbol = await saveTokenInstance.symbol.call();
      const decimals = await saveTokenInstance.decimals.call();
      assert.equal('SaveDAI', name);
      assert.equal('SDT', symbol);
      assert.equal(8, decimals.toNumber());
    });
  });
});
