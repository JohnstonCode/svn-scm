import { ConstructorPolicy, ICpOptions, ISvnOptions } from "../common/types";
import { Svn } from "../svn";
import { Repository } from "../svnRepository";

describe("Svn Repository Tests", () => {
  let svn: Svn | null;
  const options = {
    svnPath: "svn",
    version: "1.9"
  } as ISvnOptions;

  test("Test getStatus", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );

    repository.exec = async (args: string[], options?: ICpOptions) => {
      return {
        exitCode: 1,
        stderr: "",
        stdout: `<?xml version="1.0" encoding="UTF-8"?> <status> <target path="."> <entry path="test.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="newfiletester.php"> <wc-status item="modified" revision="19" props="none"> <commit revision="19"> <author>chris</author> <date>2018-09-06T17:26:59.815389Z</date> </commit> </wc-status> </entry> <entry path="added.php"> <wc-status item="unversioned" props="none"> </wc-status> </entry> <against revision="19"/> </target> </status>`
      };
    };

    const status = await repository.getStatus({});

    expect(status[0].path).toEqual("test.php");
    expect(status[1].path).toEqual("newfiletester.php");
    expect(status[2].path).toEqual("added.php");
  });

  test("Test rename", async () => {
    svn = new Svn(options);
    const repository = await new Repository(
      svn,
      "/tmp",
      "/tpm",
      ConstructorPolicy.LateInit
    );
    repository.exec = async (args: string[], options?: ICpOptions) => {
      expect(args[0].includes("rename")).toBeTruthy();
      expect(args[1].includes("test.php")).toBeTruthy();
      expect(args[2].includes("tester.php")).toBeTruthy();

      return {
        exitCode: 1,
        stderr: "",
        stdout: `
        A         test.php
        D         tester.php
        `
      };
    };

    await repository.rename("test.php", "tester.php");
  });
});
