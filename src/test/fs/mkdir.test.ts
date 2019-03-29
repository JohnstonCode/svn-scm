import * as assert from "assert";
import { mkdir } from "../../fs/mkdir";
import { exists } from "../../fs/exists";
import { stat } from "../../fs/stat";

suite("Test async mkdir wrapper", () => {

    test("Create dir", async () => {
        const path = '/tmp/test-mkdir';
        await mkdir(path);

        assert.ok((await exists(path)));
        assert.ok((await stat(path)).isDirectory());
    });
});
