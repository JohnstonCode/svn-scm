/* tslint:disable */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";
import * as path from "path";
import { PathNormalizer } from "../pathNormalizer";
import { Uri } from "vscode";
import { ISvnInfo } from "../common/types";

// Defines a Mocha test suite to group tests of similar kind together
suite("Url parsing", () => {
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

  suiteSetup(async () => {
    // do nothing
  });

  suiteTeardown(async () => {
    // do nothing
  });

  test("r1 ops", function() {
    assert.equal(nm1.branchRoot.toString(), Uri.parse(ri1.url).toString());
    assert.equal(
      nm1.repoRoot.toString(),
      Uri.parse(ri1.repository.root).toString()
    );
    assert.equal(
      nm1.checkoutRoot.toString(),
      Uri.file(ri1.wcInfo.wcrootAbspath).toString()
    );
    const x1 = nm1.parse("/d1/f1");
    assert.equal(x1.remoteFullPath.toString(), ri1.repository.root + "/d1/f1");
    assert.equal(x1.localFullPath.toString(), "file:///home/d1/f1");
  });
});
