declare module "jest-environment-node" {
  class NodeEnvironment {
    public global: any;

    constructor(config: any);

    public setup(): Promise<void>;
    public teardown(): Promise<void>;
    public runScript(script: any): any;
  }

  namespace NodeEnvironment {}
  export = NodeEnvironment;
}
