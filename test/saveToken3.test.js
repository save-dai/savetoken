/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
const { expect } = require('chai');

const {
  getDAI,
} = require('./utils.js');

const {
  BN,
  expectRevert,
  expectEvent,
  constants,
  ether,
} = require('@openzeppelin/test-helpers');

const SaveTokenFactory = artifacts.require('SaveTokenFactory');
const SaveToken = artifacts.require('SaveToken');

const AaveAdapter = artifacts.require('AaveAdapter');
const MockInsuranceAdapter = artifacts.require('CoverAdapter');

const IERC20 = artifacts.require('IERC20');
const IAToken = artifacts.require('IAToken');

const daiAddress = '0x27a44456bEDb94DbD59D0f0A14fE977c777fC5C3';
const aDaiAddress = '0x639cB7b21ee2161DF9c882483C9D55c90c20Ca3e';
const mockInsuranceToken = '';

// MOCKINSURANCE AAVE TOKEN
contract.only('SaveDAI_Aave_MockInsurance_Expires_XX_XXX_XXXX', async (accounts) => {
	const owner = accounts[0];
	const userWallet1 = accounts[1];

    before(async () => {
	    // instantiate mock tokens
	    dai = await IERC20.at(daiAddress);
	    aDai = await IAToken.at(aDaiAddress);
	    // insuranceToken = await IERC20.at(mockInsuranceToken);

	    // swap ETH for DAI
	    //await getDAI(userWallet1);
  	});

    describe('', function () {
	    it('', async () => {

	    });
    });
});