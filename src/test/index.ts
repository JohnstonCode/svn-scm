import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    timeout: 30000, // default timeout: 10 seconds
    retries: 1,
    color: true
  });

  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((c, e) => {
    glob("**/**.test.js", { cwd: testsRoot })
      .then((files: string[]) => {
        // Add files to the test suite
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run((failures: number) => {
            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (err) {
          e(err);
        }
      })
      .catch(e);
  });
}
