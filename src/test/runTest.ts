import * as path from "path";
import { runTests } from "vscode-test";

async function go() {
  const extensionPath = path.resolve(__dirname, "../../");
  const testRunnerPath = path.resolve(__dirname, "../../out/test");
  const testWorkspace = path.resolve(__dirname, "../../");

  try {
    await runTests({
      version: process.env.CODE_VERSION,
      extensionPath,
      testRunnerPath,
      testWorkspace
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

go();
