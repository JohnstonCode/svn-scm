import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "../../out/test");

  const isHeadless = process.argv.includes("--headless");
  const launchArgs = isHeadless ? ["--headless"] : [];

  try {
    await runTests({
      version: process.env.CODE_VERSION,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs
    });
  } catch (err) {
    const error = err as Error;
    console.error(`Failed to run tests: ${error}\n${error.stack}`);
    process.exit(1);
  }
}

main();
