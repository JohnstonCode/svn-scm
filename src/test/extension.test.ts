import * as assert from "assert";
import * as vscode from "vscode";
import * as testUtil from "./testUtil";

suite("Extension Tests", () => {
  setup(async () => {});

  teardown(() => {
    testUtil.destroyAllTempPaths();
  });

  test("should be present", () => {
    assert.ok(vscode.extensions.getExtension("johnstoncode.svn-scm"));
  });

  // The extension is already activated by vscode before running mocha test framework.
  // No need to test activate any more. So commenting this case.
  // tslint:disable-next-line: only-arrow-functions
  test("should be able to activate the extension", function (done) {
    this.timeout(60 * 1000);
    const extension = vscode.extensions.getExtension(
      "johnstoncode.svn-scm"
    ) as vscode.Extension<any>;

    if (!extension) {
      assert.fail("Extension not found");
    }

    if (!extension.isActive) {
      extension.activate().then(
        _api => {
          done();
        },
        () => {
          assert.fail("Failed to activate extension");
        }
      );
    } else {
      done();
    }
  });
});
