/**
 * Wires in Jest as the test runner in place of the default Mocha.
 */
import { ResultsObject, runCLI } from "jest";
import * as path from "path";
import * as sourceMapSupport from "source-map-support";

const testDirectory = path.resolve(__dirname, "../../tests");

const jestConfig = {
  colors: true,
  // rootDir: srcRootDir,
  // transform: JSON.stringify({ "^.+\\.ts$": "ts-jest" }),
  runInBand: true, // Required due to the way the "vscode" module is injected.
  // testRegex: "\\.spec\\.ts$",
  testEnvironment: testDirectory + "/jest-vscode-environment.js",
  setupTestFrameworkScriptFile: testDirectory + "/jest-vscode-framework-setup.js",
  // moduleFileExtensions: ["ts", "js", "json"],
  // globals: JSON.stringify({ "ts-jest": { tsConfigFile: "../tsconfig.json" } }),
};

export async function run(_testRoot: string, callback: TestRunnerCallback) {
  // Enable source map support. This is done in the original Mocha test runner,
  // so do it here. It is not clear if this is having any effect.
  sourceMapSupport.install();

  // Forward logging from Jest to the Debug Console.
  forwardStdoutStderrStreams();

  try {
    const { globalConfig, results } = await runCLI(jestConfig, [testDirectory]);
    const failures = collectTestFailureMessages(results);

    if (failures.length > 0) {
      console.log("globalConfig:", globalConfig); // tslint:disable-line:no-console
      callback(null, failures);
      return;
    }

    callback(null);
  } catch (e) {
    callback(e);
  }
}

/**
 * Collect failure messages from Jest test results.
 *
 * @param results Jest test results.
 */
function collectTestFailureMessages(results: ResultsObject): string[] {
  const failures = results.testResults.reduce<string[]>((acc, testResult) => {
    if (testResult.failureMessage) acc.push(testResult.failureMessage);
    return acc;
  }, []);

  return failures;
}

/**
 * Forward writes to process.stdout and process.stderr to console.log.
 *
 * For some reason this seems to be required for the Jest output to be streamed
 * to the Debug Console.
 */
function forwardStdoutStderrStreams() {
  const logger = (line: string) => {
    console.log(line); // tslint:disable-line:no-console
    return true;
  };

  process.stdout.write = logger;
  process.stderr.write = logger;
}

export type TestRunnerCallback = (error: Error | null, failures?: any) => void;
