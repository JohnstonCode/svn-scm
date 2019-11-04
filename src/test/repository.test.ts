import * as fs from "original-fs";
import * as path from "path";
import { commands, Uri, window, workspace } from "vscode";
import { Model } from "../model";
import { Repository } from "../repository";
import * as testUtil from "./testUtil";

describe("Repository Tests", () => {
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
  });

  afterAll(() => {
    model.openRepositories.forEach(repository => repository.dispose());
    // testUtil.destroyAllTempPaths();
  });

  test("Empty Open Repository", async function() {
    expect(model.repositories.length).toBe(0);
  });

  test("Try Open Repository", async function() {
    await model.tryOpenRepository(checkoutDir.fsPath);
    expect(model.repositories.length).toBe(1);
  });

  test("Try Open Repository Again", async () => {
    await model.tryOpenRepository(checkoutDir.fsPath);
    expect(model.repositories.length).toBe(1);
  });

  test("Try get repository from Uri", () => {
    const repository = model.getRepository(checkoutDir);
    expect(repository).toBeTruthy();
  });

  test("Try get repository from string", () => {
    const repository = model.getRepository(checkoutDir.fsPath);
    expect(repository).toBeTruthy();
  });

  test("Try get repository from repository", () => {
    const repository = model.getRepository(checkoutDir.fsPath);
    const repository2 = model.getRepository(repository);
    expect(repository2).toBeTruthy();
    expect(repository).toBe(repository2);
  });

  test("Try get current branch name", async () => {
    const repository: Repository | null = model.getRepository(
      checkoutDir.fsPath
    );
    if (!repository) {
      return;
    }

    const name = await repository.getCurrentBranch();
    expect(name).toBe("trunk");
  });

  test("Try commit file", async () => {
    const repository: Repository | null = model.getRepository(
      checkoutDir.fsPath
    );
    if (!repository) {
      return;
    }

    expect(repository.changes.resourceStates.length).toBe(0);

    const file = path.join(checkoutDir.fsPath, "new.txt");

    fs.writeFileSync(file, "test");

    const document = await workspace.openTextDocument(file);
    await window.showTextDocument(document);

    await repository.addFiles([file]);

    expect(repository.changes.resourceStates.length).toBe(1);

    const message = await repository.commitFiles("First Commit", [file]);
    expect(/1 file commited: revision (.*)\./i.test(message)).toBeTruthy();

    expect(repository.changes.resourceStates.length).toBe(0);

    const remoteContent = await repository.show(file, "HEAD");
    expect(remoteContent).toBe("test");
  }, 60000);

  test("Try switch branch", async () => {
    const newCheckoutDir = await testUtil.createRepoCheckout(
      testUtil.getSvnUrl(repoUri) + "/trunk"
    );

    await model.tryOpenRepository(newCheckoutDir.fsPath);

    const newRepository: Repository | null = model.getRepository(
      newCheckoutDir.fsPath
    );
    if (!newRepository) {
      return;
    }
    expect(newRepository).toBeTruthy();

    await newRepository.newBranch("branches/test");
    const currentBranch = await newRepository.getCurrentBranch();

    expect(currentBranch).toBe("branches/test");
  }, 60000);
});
