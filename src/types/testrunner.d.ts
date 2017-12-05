interface testrunnerconfig {
  ui: string;
  useColors: boolean;
}

declare module "vscode/lib/testrunner" {
  function configure(config: testrunnerconfig): void;
}
