import * as minimatch from "minimatch";

export function matchAll(
  path: string,
  patterns: string[],
  opts: minimatch.IOptions = {}
): boolean {
  let match = false;

  patterns.forEach(pattern => {
    const isExclusion = pattern[0] === "!";

    // If we've got a match, only re-test for exclusions.
    // if we don't have a match, only re-test for inclusions.
    if (match !== isExclusion) {
      return;
    }

    match = minimatch(path, pattern, opts);
  });

  return match;
}

export function match(pattern: string) {
  return new minimatch.Minimatch(pattern);
}
