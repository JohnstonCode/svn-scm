import * as vscode from "vscode";
import * as NodeEnvironment from "jest-environment-node";

class VsCodeEnvironment extends NodeEnvironment {
  constructor(config: any) {
    super(config);
  }

  public async setup() {
    await super.setup();
    this.global.vscode = vscode;
  }

  public async teardown() {
    this.global.vscode = {};
    return super.teardown();
  }

  public runScript(script: any) {
    return super.runScript(script);
  }
}

module.exports = VsCodeEnvironment;
