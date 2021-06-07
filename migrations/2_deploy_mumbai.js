const {
  constants,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');

const AaveAdapter = artifacts.require('AaveAdapter');
const MockInsuranceAdapter = artifacts.require('MockInsurance');
const MockInsuranceToken = artifacts.require('MockInsuranceToken');

const daiAddress = '0x27a44456bEDb94DbD59D0f0A14fE977c777fC5C3';
const aDaiAddress = '0x639cB7b21ee2161DF9c882483C9D55c90c20Ca3e';

const StorageLib = artifacts.require('StorageLib');
const ERC20StorageLib = artifacts.require('ERC20StorageLib');

const insuranceTokenName = 'SaveDAI_Aave_MockInsurance_Expires_XX_XXX_XXXX';
const insuranceTokenSymbol = 'SaveDAI__XX_XXX_XXXX';

const owner = '0xBBCe9b0F36533f43Bbe296609ABd4C576d0f5a18';

module.exports = function (deployer) {
  deployer.then(async () => {

    this.StorageLib = await deployer.deploy(StorageLib);
    this.ERC20StorageLib = await deployer.deploy(ERC20StorageLib);

    await SaveToken.detectNetwork();
	await SaveToken.link('StorageLib', this.StorageLib.address);
	await SaveToken.link('ERC20StorageLib', this.ERC20StorageLib.address);

    await AaveAdapter.detectNetwork();
	await AaveAdapter.link('StorageLib', this.StorageLib.address);

    await MockInsuranceAdapter.detectNetwork();
	await MockInsuranceAdapter.link('StorageLib', this.StorageLib.address);

	this.aaveAdapter = await deployer.deploy(AaveAdapter);
	this.insuranceAdapter = await deployer.deploy(MockInsuranceAdapter);
	this.insuranceToken = await deployer.deploy(MockInsuranceToken, insuranceTokenName, insuranceTokenSymbol);

    this.saveTokenFactory = await deployer.deploy(SaveTokenFactory, owner);

    saveToken = await this.saveTokenFactory.createSaveToken(
      daiAddress,
      aaveAdapter.address, 
      aDaiAddress,
      insuranceAdapter.address,
      insuranceToken.address,
      constants.ZERO_ADDRESS,
      constants.ZERO_ADDRESS,
      'SaveDAI_Aave_Cover_Expires_31_May_2021',
      'SaveDAI_MAY2021',
      18,
   	);
    saveDaiAaveAddress = saveToken.logs[0].args.addr;
    saveDaiAaveInstance = await SaveToken.at(saveDaiAaveAddress);

    console.log("SaveTokenFactory........:", this.saveTokenFactory.address.toString());
    console.log("SaveToken...............:", saveDaiAaveAddress.toString());
    console.log("DAI Underlying..........:", daiAddress.toString());
    console.log("AaveAdapter.............:", this.aaveAdapter.address.toString());
    console.log("aDai....................:", aDaiAddress.toString());
    console.log("MockInsuranceAdapter....:", this.insuranceAdapter.address.toString());
    console.log("MockInsuranceToken......:", this.insuranceToken.address.toString());
  });

};
