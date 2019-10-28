import * as assert from "assert";
import { Uri } from "vscode";
import { exists } from "../fs/exists";
import { readFile } from "../fs/read_file";
import * as os from "os";
import { join } from "path";
import { createTempSvnRevisionFile } from "../tempFiles";

const tempRevisionPath = join(
  os.tmpdir(),
  "vscode-svn",
  "1181ae15a77d83ac0b077051dfed21ed",
  "r30_test.js"
);

suite("Test temp file creation", () => {
  test("Temp files matches expected", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const revisionUri = await createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );

    assert.equal(revisionUri.fsPath, tempRevisionPath);
  });

  test("Temp file is created", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    await createTempSvnRevisionFile(svnUri, "30", "test content");

    assert.ok(await exists(tempRevisionPath));
  });

  test("Temp contents are correct", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const revisionUri = await createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );

    assert.equal(await readFile(revisionUri.fsPath), "test content");
  });
});
