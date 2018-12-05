import * as minimatch from "minimatch";

interface IMinimatchOptions {
  debug?: boolean;
  nobrace?: boolean;
  noglobstar?: boolean;
  dot?: boolean;
  noext?: boolean;
  nocase?: boolean;
  nonull?: boolean;
  matchBase?: boolean;
  nocomment?: boolean;
  nonegate?: boolean;
  flipNegate?: boolean;
}

export function matchAll(
  path: string,
  patterns: string[],
  opts: IMinimatchOptions = {}
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
