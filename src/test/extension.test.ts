//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as testUtil from "./testUtil";
import { Uri } from "vscode";
import { Svn } from "../svn";
import { Model } from "../model";
import { SvnFinder } from "../svnFinder";

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

  //Before Each
  setup(async () => {
  });

  teardown(() => {
    testUtil.destroyAllTempPaths();
  });

  test("Find Repository", async () => {
    const svnFinder = new SvnFinder();
    const info = await svnFinder.findSvn();
  });

  test("Try Open Repository", async () => {
    const repoUrl = await testUtil.createRepoServer();
    await testUtil.createStandardLayout(repoUrl);
    const checkoutDir = await testUtil.createRepoCheckout(repoUrl + "/trunk");

    const svnFinder = new SvnFinder();
    const info = await svnFinder.findSvn();
    const svn = new Svn({ svnPath: info.path, version: info.version });
    const model = new Model(svn);
    await model.tryOpenRepository(checkoutDir);
    model.dispose();
  });
});
