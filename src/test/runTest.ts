import * as path from "path";

import { runTests } from "vscode-test";

async function go() {
  try {
    const extensionPath = path.resolve(__dirname, "../../");
    const testRunnerPath = path.resolve(__dirname, "../../out/test");
    const testWorkspace = path.resolve(__dirname, "../../");

    /**
     * Basic usage
     */
    await runTests({
      extensionPath,
      testRunnerPath,
      testWorkspace
    });

    /**
     * Use 1.26.0 release for testing
     */
    await runTests({
      version: "1.26.0",
      extensionPath,
      testRunnerPath,
      testWorkspace
    });

    /**
     * Use insiders release for testing
     */
    await runTests({
      version: "insiders",
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
