import * as path from "path";
import { runTests } from "vscode-test";

async function go() {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "../../out/test");

  try {
    await runTests({
      version: process.env.CODE_VERSION,
      extensionDevelopmentPath,
      extensionTestsPath
    });
  } catch (err) {
    console.error("Failed to run tests");
    console.error(err);
    process.exit(1);
  }
}

go();
