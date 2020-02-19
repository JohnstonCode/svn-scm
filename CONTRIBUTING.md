# Contributing

Before you contribute to this project, please open an issue beforehand to discuss the changes you want to make.

## Development setup

Requirements    
* [Git](https://git-scm.com/)
* [NodeJs](https://nodejs.org/) >= 12.4.0
* [yarn](https://classic.yarnpkg.com/lang/en/) >= 1.22

First you will need to fork the project
![Github Fork](images/docs/fork.png)

Then clone your fork
```
git clone https://github.com/<YOUR_USERNAME>/svn-scm.git
```

### Dependencies
To install all of the required dependencies run
```
yarn --frozen-lockfile
```

### Build
To build the extension
```
yarn run build
```

### Watch
For development run in watch mode
```
yarn run compile
```

### Formatting
This project uses [prettier](https://prettier.io/) for code formatting. You can run prettier across the code by calling `yarn run style-fix`

### Linting
This project uses [ESLint](https://eslint.org/) for code linting. You can run ESLint across the code by calling `yarn run lint`. To fix fixable errors run `yarn run lint:fix`

### Debugging
Run in VS Code
1. Open the `svn-scm` folder
2. Make sure the [dependencies](#dependencies) are installed
3. Run in [watch](#watch) mode
4. Choose the `Launch Extension` launch configuration from the launch dropdown in the Debug viewlet and press `F5`.
