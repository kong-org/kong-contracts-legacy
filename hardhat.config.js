require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ganache");
require("hardhat-gas-reporter");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	solidity: {
    compilers: [
      {
        version: "0.5.2"
      },
      {
        version: "0.5.17"
      }
    ]
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
    gasReporter: {
    currency: 'USD',
    gasPrice: 100
  }
};

