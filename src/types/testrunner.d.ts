interface TestRunnerConfig {
  ui: string;
  useColors: boolean;
}

declare module "vscode/lib/testrunner" {
  function configure(config: TestRunnerConfig): void;
}
