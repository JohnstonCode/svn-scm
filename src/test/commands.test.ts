import * as testUtil from "./testUtil";
import { Uri, commands } from "vscode";
import { Model } from "../model";
import * as path from "path";
import * as fs from "fs";
import { Repository } from "../repository";
import { ISvnResourceGroup } from "../common/types";

describe("Commands Tests", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let model: Model;

  beforeAll(async () => {
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

  afterAll(() => {
    model.openRepositories.forEach(repository => repository.dispose());
    testUtil.destroyAllTempPaths();
  });

  test("Open file", async () => {
    const file = path.join(checkoutDir.fsPath, "new.txt");
    fs.writeFileSync(file, "test");

    await commands.executeCommand("svn.fileOpen", Uri.file(file));
  });

  test("Add file", async () => {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");

    expect(repository.unversioned.resourceStates.length).toBe(1);
    expect(repository.changes.resourceStates.length).toBe(0);

    const resource = repository.unversioned.resourceStates[0];

    await commands.executeCommand("svn.add", resource);

    expect(repository.unversioned.resourceStates.length).toBe(0);
    expect(repository.changes.resourceStates.length).toBe(1);
  });

  test("Commit file", async () => {
    const repository = model.getRepository(checkoutDir) as Repository;
    repository.inputBox.value = "First Commit";

    await commands.executeCommand("svn.commitWithMessage");
  });

  test("update", async () => {
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
    expect(repository.changes.resourceStates.length).toBe(1);

    const resource = repository.changes.resourceStates[0];

    await commands.executeCommand("svn.openResourceBase", resource);
    await commands.executeCommand("svn.openResourceHead", resource);
  });

  test("Add Changelist", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    expect(repository.changes.resourceStates.length).toBe(1);

    const resource = repository.changes.resourceStates[0];

    testUtil.overrideNextShowQuickPick(0);
    testUtil.overrideNextShowInputBox("changelist-test");

    await commands.executeCommand("svn.changelist", resource);
    expect(repository.changelists.has("changelist-test")).toBeTruthy();
  });

  test("Remove Changelist", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    const group = repository.changelists.get(
      "changelist-test"
    ) as ISvnResourceGroup;
    const resource = group.resourceStates[0];

    testUtil.overrideNextShowQuickPick(3);

    await commands.executeCommand("svn.changelist", resource);
    expect(group.resourceStates.length).toBe(0);
  });

  test("Show Patch", async function() {
    await commands.executeCommand("svn.patch");
  });

  test("Commit Selected File", async function() {
    const repository = model.getRepository(checkoutDir) as Repository;

    await commands.executeCommand("svn.refresh");
    expect(repository.changes.resourceStates.length).toBe(1);

    const resource = repository.changes.resourceStates[0];

    testUtil.overrideNextShowInputBox("Second Commit");
    await commands.executeCommand("svn.commit", resource);

    expect(repository.changes.resourceStates.length).toBe(0);
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

    const repository = model.getRepository(checkoutDir) as Repository;
    expect(await repository.getCurrentBranch()).toBe("branches/test");
  });

  test("Switch Branch", async function() {
    testUtil.overrideNextShowQuickPick(2);
    await commands.executeCommand("svn.switchBranch");

    const repository = model.getRepository(checkoutDir) as Repository;
    expect(await repository.getCurrentBranch()).toBe("trunk");
  });
});
