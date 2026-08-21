# Contributing

Before you contribute to this project, please open an issue beforehand to discuss the changes you want to make.

## Development setup

Requirements    
* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) >= 22.18.0
* [npm](https://www.npmjs.com/) >= 10.x (comes with Node.js)

First you will need to fork the project
![Github Fork](images/docs/fork.png)

Then clone your fork
```bash
git clone https://github.com/<YOUR_USERNAME>/svn-scm.git
cd svn-scm
```

### Dependencies
To install all of the required dependencies run
```bash
npm install
```

### Build
To build the extension
```bash
npm run build
```

This will:
1. Compile TypeScript sources (`npm run build:ts`)
2. Compile SCSS styles (`npm run build:css`)

### Watch
For development run in watch mode
```bash
npm run compile
```

For CSS watch mode (separate terminal):
```bash
npm run watch:css
```

### Testing
To run tests:
```bash
npm run test-compile  # Compile test files
npm test             # Run tests
```

### Formatting
This project uses [Prettier](https://prettier.io/) for code formatting.

Check formatting:
```bash
npm run style-check
```

Fix formatting:
```bash
npm run style-fix
```

### Linting
This project uses [ESLint](https://eslint.org/) for code linting.

Run linter:
```bash
npm run lint
```

Fix linting errors:
```bash
npm run lint:fix
```

### Debugging
Run in VS Code:
1. Open the `svn-scm` folder in VS Code
2. Make sure the [dependencies](#dependencies) are installed
3. Run `npm run compile` in watch mode
4. Press `F5` or choose the `Launch Extension` launch configuration from the Debug viewlet

### Packaging
To create a VSIX package for testing:
```bash
npx @vscode/vsce package
```

### Project Structure
- `src/` - TypeScript source files
- `scss/` - SASS/SCSS stylesheets
- `css/` - Compiled CSS files (generated)
- `out/` - Compiled JavaScript files (generated)
- `icons/` - SVG icons
- `images/` - Project images and screenshots

### Development Workflow
1. Fork and clone the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Install dependencies: `npm install`
4. Start development: `npm run compile` (watch mode)
5. Make your changes
6. Test your changes: `npm test`
7. Check formatting and linting: `npm run style-check && npm run lint`
8. Commit your changes with a descriptive message
9. Push to your fork: `git push origin my-feature`
10. Create a Pull Request

### Node.js and TypeScript Configuration
This project uses:
- **Node.js**: v22.18+
- **TypeScript**: v5.6+
- **Target**: ES2022
- **Module**: Node16
- **VS Code Engine**: v1.85+

Make sure your development environment matches these requirements.

### CI/CD Pipeline
The project uses GitHub Actions for:
- **Build testing** on Ubuntu, macOS, and Windows
- **ESLint** code quality checks
- **VSIX packaging** for distribution
- **Automatic publishing** to VS Code Marketplace and OpenVSX Registry

All pull requests will be automatically tested against these pipelines.