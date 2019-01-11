import * as testUtil from './testUtil';
import { Uri, commands } from "vscode";
import { Model } from "../model";

describe("Repository Tests", () => {
  let repoUri: Uri;
  let checkoutDir: Uri;
  let model: Model;

  beforeAll(async () => {
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
    testUtil.destroyAllTempPaths();
  });

  test("No open repositories", () => {
    expect(model.repositories.length).toBe(0);
  });
});
