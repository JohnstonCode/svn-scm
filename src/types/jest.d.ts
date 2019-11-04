// exposes an importable `runCLI()` and `ResultsObject`
// @types/jest only defines globals

declare module "jest" {
  /**
   * Execute Jest and return a promise with the results.
   *
   * @see https://github.com/facebook/jest/blob/master/packages/jest-cli/src/cli/index.js
   * @param jestConfig Jest configuration options.
   * @param projects Paths to projects to run tests on.
   */
  export function runCLI(
    jestConfig: object,
    projects: string[]
  ): Promise<{ globalConfig: object; results: ResultsObject }>;

  export interface ResultsObject {
    testResults: {
      failureMessage?: string;
    }[];
  }
}
