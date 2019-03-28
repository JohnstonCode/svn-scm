/* tslint:disable */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as fs from "original-fs";
import * as path from "path";
import { commands, Uri } from "vscode";
import { ISvnResourceGroup } from "../common/types";
import { Model } from "../model";
import { Repository } from "../repository";
import * as testUtil from "./testUtil";
import { timeout } from "../util";

// Defines a Mocha test suite to group tests of similar kind together
suite("Commands Tests", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let model: Model;

  suiteSetup(async () => {
    await testUtil.activeExtension();

    repoUri = await testUtil.createRepoServer();
    await testUtil.createStandardLayout(testUtil.getSvnUrl(repoUri));
    checkoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    model = (await commands.executeCommand(
      "svn.getModel",
      checkoutDir
    )) as Model;

    await model.tryOpenRepository(checkoutDir.fsPath);
  });

  suiteTeardown(() => {
    model.openRepositories.forEach(repository => repository.dispose());
    testUtil.destroyAllTempPaths();
  });

  test("File Open", async function() {
    const file = path.join(checkoutDir.fsPath, "new.txt");
    fs.writeFileSync(file, "test");

    await commands.executeCommand("svn.fileOpen", Uri.file(file));
  });

  test("Add File", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    assert.equal(repository.unversioned.resourceStates.length, 1);
    assert.equal(repository.changes.resourceStates.length, 0);

    const resource = repository.unversioned.resourceStates[0];

    await commands.executeCommand("svn.add", resource);

    assert.equal(repository.unversioned.resourceStates.length, 0);
    assert.equal(repository.changes.resourceStates.length, 1);
  });

  test("Commit File", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;
    repository.inputBox.value = "First Commit";

    await commands.executeCommand("svn.commitWithMessage");
  });

  test("Update", async function() {
    await commands.executeCommand("svn.update");
  });

  test("Show Log", async function() {
    await commands.executeCommand("svn.log");
  });

  test("Open Changes", async function() {
    const file = path.join(checkoutDir.fsPath, "new.txt");
    fs.writeFileSync(file, "test 2");
    const uri = Uri.file(file);

    await commands.executeCommand("svn.refresh");
    await commands.executeCommand("svn.openChangeBase", uri);
    await commands.executeCommand("svn.openChangeHead", uri);
  });

  test("Open File", async function() {
    const file = path.join(checkoutDir.fsPath, "new.txt");
    const uri = Uri.file(file);

    await commands.executeCommand("svn.openFile", uri);
    await commands.executeCommand("svn.openHEADFile", uri);
  });

  test("Open Diff (Double click o source control)", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    assert.equal(repository.changes.resourceStates.length, 1);

    const resource = repository.changes.resourceStates[0];

    await commands.executeCommand("svn.openResourceBase", resource);
    await commands.executeCommand("svn.openResourceHead", resource);
  });

  test("Add Changelist", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    assert.equal(repository.changes.resourceStates.length, 1);

    const resource = repository.changes.resourceStates[0];

    testUtil.overrideNextShowQuickPick(0);
    testUtil.overrideNextShowInputBox("changelist-test");

    await commands.executeCommand("svn.changelist", resource);
    assert.ok(repository.changelists.has("changelist-test"));
  });

  test("Remove Changelist", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    const group = repository.changelists.get(
      "changelist-test"
    ) as ISvnResourceGroup;
    const resource = group.resourceStates[0];

    testUtil.overrideNextShowQuickPick(3);

    await commands.executeCommand("svn.changelist", resource);
    assert.equal(group.resourceStates.length, 0);
  });

  test("Show Patch", async function() {
    await commands.executeCommand("svn.patch");
  });

  test("Commit Selected File", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    assert.equal(repository.changes.resourceStates.length, 1);

    const resource = repository.changes.resourceStates[0];

    testUtil.overrideNextShowInputBox("Second Commit");
    await commands.executeCommand("svn.commit", resource);

    assert.equal(repository.changes.resourceStates.length, 0);
  });

  test("Commit File", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;
    repository.inputBox.value = "First Commit";

    await commands.executeCommand("svn.commitWithMessage");
  });

  test("New Branch", async function() {
    testUtil.overrideNextShowQuickPick(0);
    testUtil.overrideNextShowQuickPick(1);
    testUtil.overrideNextShowInputBox("test");
    testUtil.overrideNextShowInputBox("Created new branch test");
    await commands.executeCommand("svn.switchBranch");

    // Wait run updateRemoteChangedFiles
    await timeout(2000);

    const repository = model.getRepository(checkoutDir) as Repository;
    assert.equal(await repository.getCurrentBranch(), "branches/test");
  });

  test("Switch Branch", async function() {
    testUtil.overrideNextShowQuickPick(2);
    await commands.executeCommand("svn.switchBranch");

    // Wait run updateRemoteChangedFiles
    await timeout(2000);

    const repository = model.getRepository(checkoutDir) as Repository;
    assert.equal(await repository.getCurrentBranch(), "trunk");
  });
});
