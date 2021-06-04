const Decimal = require('decimal.js');
const { fromWei } = web3.utils;
const { toWei } = web3.utils;

const IUniswapFactory = artifacts.require('IUniswapFactory');
const IUniswapExchange = artifacts.require('IUniswapExchange');
const uniswapFactoryAddress = '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95';
const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';


function calcRelativeDiff (expected, actual) {
  actual = fromWei(actual);
  expected = fromWei(expected);
  return ((Decimal(expected).minus(Decimal(actual))).div(expected)).abs();
}

async function getDAI (user) {
  uniswapFactory = await IUniswapFactory.at(uniswapFactoryAddress);
  daiExchangeAddress = await uniswapFactory.getExchange(daiAddress);
  daiExchange = await IUniswapExchange.at(daiExchangeAddress);

  // swap ETH for DAI
  await daiExchange.ethToTokenSwapInput(
    1,
    1099511627776,
    { from: user, value: toWei('50') },
  );

}

module.exports = {
  calcRelativeDiff,
  getDAI,
};
