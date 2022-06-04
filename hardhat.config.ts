import "@nomiclabs/hardhat-waffle";
import "solidity-coverage"

module.exports = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
};
