# perpdex-stablecoin

This repository contains LFF-token smart contracts of [PerpDEX](https://perpdex.com/).

## Local Development

You need Node.js 16+ to build. Use [nvm](https://github.com/nvm-sh/nvm) to install it.

```bash
yarn install
```

### test
```bash
# build deps' typechain
cd deps/perpdex-contract/
npm install
npm run build
cd ../../

# copy them
mkdir -p typechain/perpdex-contract
cp -r deps/perpdex-contract/typechain/* typechain/perpdex-contract/

# run test
yarn test
```

## Changelog

See [CHANGELOG](https://github.com/perpdex/perpdex-stablecoin/blob/main/CHANGELOG.md).

## Related Projects

- [perpdex-contract](https://github.com/perpdex/perpdex-contract)
