import { mkdir as fsMkdir } from "original-fs";

export function mkdir(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fsMkdir(path, err => (err ? reject(err) : resolve()));
  });
}
