import * as assert from "assert";
import { matchAll, match } from "../util/globMatch";

suite("Glob match testing", () => {
  test("Test single match", () => {
    const matcher = match("**/*.js");

    assert.ok(matcher.match("test/tester.js"));
    assert.ok(matcher.match("tester/testing/test/tester.js"));
  });

  test("Test Multiple Matches", () => {
    const patterns = ["**/.git", "**/.hg", "**/vendor", "**/node_modules"];

    assert.strictEqual(matchAll(".git/test", patterns), false);
    assert.strictEqual(matchAll(".hg/test", patterns), false);
    assert.strictEqual(matchAll("vendor/test", patterns), false);
    assert.strictEqual(
      matchAll("project/test/node_modules/test/index.js", patterns),
      false
    );
  });
});
