import { matchAll, match } from "../util/globMatch";

describe("Glob match testing", () => {
  test("Test single match", () => {
    const matcher = match("**/*.js");

    expect(matcher.match("test/tester.js")).toBeTruthy();
    expect(matcher.match("tester/testing/test/tester.js")).toBeTruthy();
  });

  test("Test Multiple Matches", () => {
    const patterns = ["**/.git", "**/.hg", "**/vendor", "**/node_modules"];

    expect(matchAll(".git/test", patterns)).toBe(false);
    expect(matchAll(".hg/test", patterns)).toBe(false);
    expect(matchAll("vendor/test", patterns)).toBe(false);
    expect(matchAll("project/test/node_modules/test/index.js", patterns)).toBe(
      false
    );
  });
});
