const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');

let secrets;
let mnemonic = '';
let mnemonic2 = '';

if (fs.existsSync('./secrets.json')) {
  secrets = require('./secrets.json');
  mnemonic = secrets.mnemonic;
  mnemonic2 = secrets.mnemonic2; // hold Matic tokens
  projectId = secrets.projectId;
}

module.exports = {
  networks: {
    develop: {
      port: 8545,
    },
    mainlocal: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '1',
      skipDryRun: true,
      gas: 6000000,
    },
    mainnet: {
      networkCheckTimeout: 100000,
      provider: () => new HDWalletProvider(mnemonic, `https://mainnet.infura.io/v3/${projectId}`),
      network_id: '2',       // Mainnet id
      chain_id: 1,
      gas: 8000000,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 2000,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true,    // Skip dry run before migrations? (default: false for public nets )
      gasPrice: 7000000000,  // 7 gwei (in wei) (default: 100 gwei)
    },
    //polygon Infura testnet
    polygon_infura_testnet: {
      provider: () => new HDWalletProvider(mnemonic2, `https://polygon-mumbai.infura.io/v3/${projectId}`),
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      chainId: 80001,
      gasPrice: 0,
    },
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '>=0.6.0 <0.8.0',
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};
