import { extensions, Extension } from "vscode";

describe("Extension", () => {
  test("Should be present", () => {
    expect(extensions.getExtension("johnstoncode.svn-scm")).toBeTruthy();
  });

  test("Should be active", () => {
    const extension = extensions.getExtension(
      "johnstoncode.svn-scm"
    ) as Extension<any>;

    if (!extension) {
      throw new Error("Extension not found");
    }

    expect(extension.isActive).toBeTruthy();
  });
});
