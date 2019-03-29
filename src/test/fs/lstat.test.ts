import * as assert from "assert";
import { lstat } from "../../fs/lstat";
import { newTempDir, destroyAllTempPaths } from "../testUtil";
import { writeFileSync } from "fs";
import { join } from "path";

suite("Test async lstat wrapper", () => {
    suiteTeardown(() => {
        destroyAllTempPaths();
    });

    test("Test stat is dir", async () => {
        const fullpath = newTempDir("test-dir");

        assert.ok((await lstat(fullpath)).isDirectory());
    });

    test("Test stat is file", async () => {
        const testDirPath = newTempDir("test-file-dir");
        const filePath = join(testDirPath, 'testfile.txt');
        writeFileSync(filePath, 'test');

        assert.ok((await lstat(filePath)).isFile());
    });
});
