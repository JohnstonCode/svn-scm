import { PathNormalizer } from "../pathNormalizer";
import { ISvnInfo } from "../common/types";
import { Uri } from "vscode";

describe("Url parsing", () => {
  const ri1 = {
    repository: {
      root: "svn://somedomain.x.org/public/devs"
    },
    url: "svn://somedomain.x.org/public/devs/branches/features/F1",
    wcInfo: {
      wcrootAbspath: "/home/user/dev/mypero"
    }
  };
  const nm1 = new PathNormalizer(ri1 as ISvnInfo);

  test("r1 ops", function() {
    expect(nm1.branchRoot.toString()).toEqual(Uri.parse(ri1.url).toString());
    expect(nm1.repoRoot.toString()).toEqual(
      Uri.parse(ri1.repository.root).toString()
    );

    if (!nm1.checkoutRoot) {
      throw new Error("impossible");
    }

    expect(nm1.checkoutRoot.toString()).toEqual(
      Uri.file(ri1.wcInfo.wcrootAbspath).toString()
    );

    const x1 = nm1.parse("/d1/f1");
    expect(x1.remoteFullPath.toString()).toEqual(
      ri1.repository.root + "/d1/f1"
    );

    if (!x1.localFullPath) {
      throw new Error("impossible");
    }

    expect(x1.localFullPath.toString()).toEqual("file:///home/d1/f1");
  });
});
