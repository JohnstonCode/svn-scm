import { PathNormalizer, ResourceKind } from "../pathNormalizer";
import { Uri } from "vscode";
import { ISvnInfo } from "../common/types";

describe("SVN URLs parsing", () => {
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

  test("somedomain", function() {
    expect(nm1.branchRoot.toString()).toBe(Uri.parse(ri1.url).toString());
    expect(nm1.repoRoot.toString()).toBe(
      Uri.parse(ri1.repository.root).toString()
    );

    if (!nm1.checkoutRoot) {
      throw new Error("impossible");
    }
    expect(nm1.checkoutRoot.toString()).toBe(
      Uri.file(ri1.wcInfo.wcrootAbspath).toString()
    );
    const x1 = nm1.parse("/d1/f1");
    expect(x1.remoteFullPath.toString()).toBe(ri1.repository.root + "/d1/f1");
    if (!x1.localFullPath) {
      throw new Error("impossible");
    }
    expect(x1.localFullPath.toString()).toBe("file:///home/d1/f1");
    const x2 = nm1.parse("/branches/features/F1/dir/file.c");
    expect(x2.localFullPath!.toString()).toBe(
      "file:///home/user/dev/mypero/dir/file.c"
    );
  });

  const ri2 = {
    repository: {
      root: "svn://rootdomain.com"
    },
    url: "svn://rootdomain.com/foo/drupal-7/trunk",
    wcInfo: {
      wcrootAbspath: "/home/dev-mi/projects/drupal/foo"
    }
  };
  const nm2 = new PathNormalizer(ri2 as ISvnInfo);

  test("rootdomain", function() {
    const p1 = nm2.parse(
      "/foo/drupal-7/trunk/drupal/sites/all/themes/foo_theme/scss/foo-pdf.scss"
    );
    expect(p1.localFullPath!.path).toBe(
      "/home/dev-mi/projects/drupal/foo/drupal/sites/all/themes/foo_theme/scss/foo-pdf.scss"
    );

    const p2 = nm2.parse("drupal/sites", ResourceKind.LocalRelative);
    expect(p2.remoteFullPath.path).toBe("/foo/drupal-7/trunk/drupal/sites");
    const p3 = nm2.parse(
      "/home/dev-mi/projects/drupal/foo/drupal",
      ResourceKind.LocalFull
    );
    expect(p3.remoteFullPath.path).toBe("/foo/drupal-7/trunk/drupal");
  });

  const ri3 = {
    repository: {
      root: "svn://rootdomain.com"
    },
    url: "svn://rootdomain.com",
    wcInfo: {
      wcrootAbspath: "/home/user/svn"
    }
  };
  const nm3 = new PathNormalizer(ri3 as ISvnInfo);

  test("rootbranch", function() {
    const p4 = nm3.parse("/file.c");
    expect(p4.localFullPath!.path).toBe("/home/user/svn/file.c");
  });

  const ri4 = {
    repository: {
      root: "svn://rootdomain.com"
    },
    url: "svn://rootdomain.com/trunk",
    wcInfo: {
      wcrootAbspath: "X:\\work\\rootd"
    }
  };
  const nm4 = new PathNormalizer(ri4 as ISvnInfo);

  if (process.platform == "win32") {
    test("winpath", function() {
      const p4 = nm4.parse("/trunk/file.c");
      expect(p4.localFullPath!.fsPath).toBe("x:\\work\\rootd\\file.c");
    });
  }
});
