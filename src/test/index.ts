import { runCLI, ResultsObject } from "jest";
import * as path from "path";

const projectRootPath = path.resolve(__dirname, "../../out");
const testDirectory = path.resolve(__dirname, "../test");

console.log(projectRootPath);
console.log(testDirectory);

const jestConfig = {
  roots: [testDirectory],
  runInBand: true,
  testEnvironment: testDirectory + "/test-runner/jest-vscode-environment.js",
  setupTestFrameworkScriptFile:
    testDirectory + "/test-runner/jest-vscode-framework-setup.js"
};

export async function run(): Promise<void> {
  forwardStdoutStderrStreams();

  return new Promise(async (resolve, reject) => {
    try {
      const { results } = await runCLI(jestConfig as any, [projectRootPath]);
      const failures = collectTestFailures(results);

      if (failures.length > 0) {
        reject(new Error(`${failures}`));
      }

      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function collectTestFailures(results: ResultsObject) {
  const failures = results.testResults.reduce<string[]>((acc, testResult) => {
    if (testResult.failureMessage) {
      acc.push(testResult.failureMessage);
    }

    return acc;
  }, []);

  return failures;
}

function forwardStdoutStderrStreams() {
  const logger = (line: string) => {
    console.log(line);
    return true;
  };

  process.stdout.write = logger;
  process.stderr.write = logger;
}
