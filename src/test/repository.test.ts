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
import { commands, Uri, window, workspace } from "vscode";
import { Model } from "../model";
import { Repository } from "../repository";
import * as testUtil from "./testUtil";

// Defines a Mocha test suite to group tests of similar kind together
suite("Repository Tests", () => {
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
  });

  suiteTeardown(() => {
    model.openRepositories.forEach(repository => repository.dispose());
    testUtil.destroyAllTempPaths();
  });

  test("Empty Open Repository", async function() {
    assert.equal(model.repositories.length, 0);
  });

  test("Try Open Repository", async function() {
    await model.tryOpenRepository(checkoutDir.fsPath);
    assert.equal(model.repositories.length, 1);
  });

  test("Try Open Repository Again", async () => {
    await model.tryOpenRepository(checkoutDir.fsPath);
    assert.equal(model.repositories.length, 1);
  });

  test("Try get repository from Uri", () => {
    const repository = model.getRepository(checkoutDir);
    assert.ok(repository);
  });

  test("Try get repository from string", () => {
    const repository = model.getRepository(checkoutDir.fsPath);
    assert.ok(repository);
  });

  test("Try get repository from repository", () => {
    const repository = model.getRepository(checkoutDir.fsPath);
    const repository2 = model.getRepository(repository);
    assert.ok(repository2);
    assert.equal(repository, repository2);
  });

  test("Try get current branch name", async () => {
    const repository: Repository | undefined = model.getRepository(
      checkoutDir.fsPath
    );
    if (!repository) {
      return;
    }

    const name = await repository.getCurrentBranch();
    assert.equal(name, "trunk");
  });

  test("Try commit file", async function() {
    this.timeout(60000);
    const repository: Repository | undefined = model.getRepository(
      checkoutDir.fsPath
    );
    if (!repository) {
      return;
    }

    assert.equal(repository.changes.resourceStates.length, 0);

    const file = path.join(checkoutDir.fsPath, "new.txt");

    fs.writeFileSync(file, "test");

    const document = await workspace.openTextDocument(file);
    await window.showTextDocument(document);

    await repository.addFiles([file]);

    assert.equal(repository.changes.resourceStates.length, 1);

    const message = await repository.commitFiles("First Commit", [file]);
    assert.ok(/Committed revision (.*)\./i.test(message));

    assert.equal(repository.changes.resourceStates.length, 0);

    const remoteContent = await repository.show(file, "HEAD");
    assert.equal(remoteContent, "test");
  });

  test("Try switch branch", async function() {
    this.timeout(60000);
    const newCheckoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    await model.tryOpenRepository(newCheckoutDir.fsPath);

    const newRepository: Repository | undefined = model.getRepository(
      newCheckoutDir.fsPath
    );
    if (!newRepository) {
      return;
    }
    assert.ok(newRepository);

    await newRepository.newBranch("branches/test");
    const currentBranch = await newRepository.getCurrentBranch();

    assert.equal(currentBranch, "branches/test");
  });
});
