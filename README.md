```diff
Warning: this code has not been audited and may contain bugs and/or vulnerabilities.
```

# SaveToken
## Open an insured, interest-bearing savings account—without a bank! 💰
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/save-dai/savetoken/blob/master/LICENSE)

Open source implementation of the SaveToken savings protocol. Version 1.0.

## Documentation
Find documention to integrate the SaveToken protocol [here](https://docs.savedai.xyz/)

## Contracts

| Contract | About |
| ------ | ------ |
| [SaveTokenFactory](https://github.com/save-dai/savetoken/blob/master/contracts/SaveTokenFactory.sol) | Factory contract used to generate SaveTokens with different asset and insurance token pairs  |
| [SaveToken](https://github.com/save-dai/savetoken/blob/master/contracts/SaveToken.sol) | Base ERC20 SaveToken contract  |

# Installation

1. Run `git clone` to clone this repo.
2. Run `cd savetoken` .
3. Run `npm install` to install all dependencies.

# Testing and Deployment
To run the tests, you will need to fork the Ethereum Mainnet and unlock the following accounts:
- uniswapFactoryAddress: `0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95`
- daiAddress: `0x6B175474E89094C44Da98b954EedeAC495271d0F`
- ocDaiAddress: `0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33`

1. Open a tab in your terminal and run:

`ganache-cli -e 1000 -f NODE_URL --unlock "0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95" --unlock "0x6B175474E89094C44Da98b954EedeAC495271d0F" --unlock "0x98CC3BD6Af1880fcfDa17ac477B2F612980e5e33"`

2. In another tab, `cd` into the project and run:

`truffle test --network mainlocal`

# Resources
- Website: [savedai.xyz](https://savedai.xyz)
- Discord: [saveDAI](https://discord.gg/wuBtFUTm)
- Twitter: [@save_dai](https://twitter.com/save_dai)
- Medium: [@savedai](https://medium.com/savedai)

## Audit Report
- TBD

## License
The SaveToken protocol is under the [MIT License] (https://github.com/save-dai/savetoken/blob/master/LICENSE)
