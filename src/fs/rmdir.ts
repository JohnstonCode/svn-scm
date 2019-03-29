import { rmdir as fsRmdir } from "original-fs";

export function rmdir(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fsRmdir(path, err => (err ? reject(err) : resolve()));
  });
}
