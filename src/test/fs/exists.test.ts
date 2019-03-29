import * as assert from "assert";
import { exists } from "../../fs/exists";
import { newTempDir, destroyAllTempPaths } from "../testUtil";
import { writeFileSync } from "fs";
import { join } from "path";

suite("Test async exists wrapper", () => {
  suiteTeardown(() => {
    destroyAllTempPaths();
  });

  test("Dir does exist", async () => {
    const fullpath = newTempDir("test-dir");

    assert.ok(await exists(fullpath));
  });

  test("Dir does not exist", async () => {
    assert.strictEqual(await exists("/tmp/thisfiledoesnotexsist"), false);
  });

  test("File does exist", async () => {
    const testDirPath = newTempDir("test-file-dir");
    const filePath = join(testDirPath, "testfile.txt");
    writeFileSync(filePath, "test");

    assert.ok(await exists(filePath));
  });

  test("File does not exist", async () => {
    assert.strictEqual(await exists("/tmp/thisfiledoesnotexsist.txt"), false);
  });
});
