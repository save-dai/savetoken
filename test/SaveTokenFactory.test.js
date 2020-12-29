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

// mainnet addresses
const compAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const cDaiAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
const ocDaiAddress = '0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33';
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';

contract('SaveTokenFactory', async (accounts) => {

  before(async () => {
    // deploys the farmer's logic contract
    compFarmer = await COMPFarmer.new();
    saveTokenFactory = await SaveTokenFactory.new();
    compoundAdapter = await CompoundAdapter.new(compAddress);
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
        uniswapFactoryAddress,
        compFarmer.address,
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
        uniswapFactoryAddress,
        compFarmer.address,
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
        uniswapFactoryAddress,
        compFarmer.address,
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
