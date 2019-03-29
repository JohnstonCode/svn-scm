import * as assert from "assert";
import { readFile } from "../../fs/read_file";
import { newTempDir, destroyAllTempPaths } from "../testUtil";
import { writeFileSync } from "fs";
import { join } from "path";

suite("Test async readFile wrapper", () => {
    suiteTeardown(() => {
        destroyAllTempPaths();
    });

    test("Able to read file", async () => {
        const testDirPath = newTempDir("test-file-dir");
        const filePath = join(testDirPath, 'testfile.txt');
        const data = 'this is a file';
        writeFileSync(filePath, data);

        assert.strictEqual((await readFile(filePath)), data);
    });
});
