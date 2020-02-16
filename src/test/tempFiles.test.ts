import * as assert from "assert";
import { Uri } from "vscode";
import { tempSvnFs } from "../temp_svn_fs";

suite("Test temp file creation", () => {
  test("Temp files matches expected", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const revisionUri = await tempSvnFs.createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );

    assert.equal(revisionUri.authority, "1181ae15a77d83ac0b077051dfed21ed");
    assert.equal(revisionUri.fsPath, "r30_test.js");
  });

  test("Temp file is created", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const uri = await tempSvnFs.createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );

    assert.ok(tempSvnFs.stat(uri));
  });

  test("Temp contents are correct", async () => {
    const svnUri = Uri.parse("http://example.com/svn/test/trunk/test.js");

    const revisionUri = await tempSvnFs.createTempSvnRevisionFile(
      svnUri,
      "30",
      "test content"
    );

    assert.equal(tempSvnFs.readFile(revisionUri), "test content");
  });
});
