import { exists } from "../../fs/exists";
import { newTempDir } from "../testUtil";
import { writeFileSync } from "fs";
import { join } from "path";

describe("Test async exists wrapper", () => {
    afterAll(() => {
        // destroyAllTempPaths();
    });

    test("Dir does exist", async () => {
        const fullpath = newTempDir("test-dir");

        expect(await exists(fullpath)).toBeTruthy();
    });

    test("Dir does not exist", async () => {
        expect(await exists('/tmp/thisfiledoesnotexsist')).toBe(false);
    });

    test("File does exist", async () => {
        const testDirPath = newTempDir("test-file-dir");
        const filePath = join(testDirPath, 'testfile.txt');
        writeFileSync(filePath, 'test');

        expect(await exists(filePath)).toBeTruthy();
    });

    test("File does not exist", async () => {
        expect(await exists('/tmp/thisfiledoesnotexsist.txt')).toBe(false);
    });
});
