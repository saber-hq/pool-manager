# Saber Pools Program

Allows the DAO to manage Saber pools and for anyone to create new pools without permission.

## Setup Instructions

### Running tests

1. Install deps via `yarn` (yarn version should be >= 3.2.0)
2. brew install gnu-sed
3. Run some scripts, `./scripts/idl.sh`, `./scripts/generate-idl-types.sh`, and `./scripts/pull-saber.sh`
4. `anchor build`
5. Now `yarn test` should work

### VS Code setup

1. When you open the project in VS Code, it will ask if you want to use the workspace TypeScript version. Click "Allow." Or, just follow [these steps](https://yarnpkg.com/getting-started/editor-sdks#vscode) to use the workspace version.
1. Install the [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) extension, so go-to-definition works for TypeScript.

## License

The Saber Pools program is licensed under the Affero General Public License, version 3.
