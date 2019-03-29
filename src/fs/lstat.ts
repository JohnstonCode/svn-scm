import { lstat as fsLstat, Stats } from "original-fs";

export function lstat(filePath: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    fsLstat(filePath, (err, stats) => (err ? reject(err) : resolve(stats)));
  });
}
