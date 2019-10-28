import * as assert from "assert";
import { Uri } from "vscode";
import { exists } from "../fs/exists";
import { readFile } from "../fs/read_file";
import * as os from "os";
import { join } from "path";
import { createTempSvnRevisionFile } from "../tempFiles";

suite("Test temp file creation", () => {
  test("Temp files matches expected", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const revisionUri = await createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );
    const tempRevisionPath = join(
      os.tmpdir(),
      "0a6ac614807951f8ffb8a639b0d16299",
      "r30_test.js"
    );

    assert.equal(revisionUri.fsPath, tempRevisionPath);
  });

  test("Temp file is created", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    await createTempSvnRevisionFile(svnUri, "30", "test content");

    const tempRevisionPath = join(os.tmpdir(), "hash", "r30_test.js");
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
