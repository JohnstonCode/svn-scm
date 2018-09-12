import * as assert from "assert";
import { ICpOptions, ISvnOptions } from "../common/types";
import { Svn } from "../svn";
import { Repository } from "../svnRepository";

suite("Svn Repository Tests", () => {
  let svn: Svn | null;
  const options = {
    svnPath: "/bin/svn",
    version: "1.9"
  } as ISvnOptions;

  suiteSetup(async () => {
    // svn = new Svn(options);
  });

  suiteTeardown(() => {
    svn = null;
  });

  test("Test removeAbsolutePath", async () => {
    svn = new Svn(options);
    const repository = new Repository(svn, "/tmp", "/tpm");
    repository.exec = async (args: string[], options?: ICpOptions) => {
      return {
        exitCode: 1,
        stderr: "",
        stdout: `<?xml version="1.0" encoding="UTF-8"?> <status> <target path="."> <entry path="test.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="newfiletester.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="added.php"> <wc-status item="unversioned" props="none"> </wc-status> </entry> <against revision="19"/> </target> </status>`
      };
    };

    const status = await repository.getStatus({});

    assert.equal(status[0].path, "test.php");
    assert.equal(status[1].path, "newfiletester.php");
    assert.equal(status[2].path, "added.php");
  });
});
