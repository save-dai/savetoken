/* TESTS USING MATICJS */

/* eslint-disable prefer-const */
/* global contract artifacts web3 before it assert */
/*
const { expect } = require('chai');

const HDWalletProvider = require('@truffle/hdwallet-provider');

const fs = require('fs');

let secrets;
let mnemonic3 = '';
let privateKey ='';

if (fs.existsSync('./secrets.json')) {
  secrets = require('./secrets.json');
  mnemonic3 = secrets.mnemonic3; // hold Matic tokens
  projectId = secrets.projectId;
}

const Matic = require('@maticnetwork/maticjs').MaticPOSClient;

const maticPOSClient = new Matic({
  parentProvider: new HDWalletProvider(privateKey, 'https://goerli.infura.io/v3/' + projectId),
  maticProvider: new HDWalletProvider(privateKey, 'https://polygon-mumbai.infura.io/v3/' + projectId),
  posRootChainManager: '0xBbD7cBFA79faee899Eaf900F13C9065bF03B1A74',
  posEtherPredicate: '0xe2B01f3978c03D6DdA5aE36b2f3Ac0d66C54a6D5',
});

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
contract('SaveDAI_Aave_MockInsurance_Expires_XX_XXX_XXXX', async (accounts) => {

  beforeEach(async () => {
    // instantiate mock tokens
    dai = await IERC20.at(daiAddress);
    aDai = await IAToken.at(aDaiAddress);
    // insuranceToken = await IERC20.at(mockInsuranceToken);
  });

  describe('testing', function () {
	  it('testing', async () => {
      console.log('test');
	    // Deposit ether into Matic chain using POS Portal.
      // It is an ERC20 token on Matic chain
      await maticPOSClient.depositEtherForUser(
		    accounts[0], // User address (in most cases, this will be sender's address),
		    100000, // Amount for deposit (in wei)
        { from: accounts[0] },
      );
	  });
  });
});
*/
