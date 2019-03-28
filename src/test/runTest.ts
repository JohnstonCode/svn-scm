import * as path from "path";

import { runTests } from "vscode-test";

async function go() {
  const extensionPath = path.resolve(__dirname, "../../");
  const testRunnerPath = path.resolve(__dirname, "../../out/test");
  const testWorkspace = path.resolve(__dirname, "../../");

  try {
    process.env.CODE_VERSION = "stable";

    /**
     * Basic usage
     */
    await runTests({
      extensionPath,
      testRunnerPath,
      testWorkspace
    });

    process.env.CODE_VERSION = "minimal";

    /**
     * Use 1.26.0 release for testing
     */
    await runTests({
      version: "1.26.0",
      extensionPath,
      testRunnerPath,
      testWorkspace
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }

  try {
    process.env.CODE_VERSION = "insider";

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
    console.error("Insiders tests failing!");
    process.exit(0);
  }
}

go();
