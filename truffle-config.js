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
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '^0.6.0',
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
};
