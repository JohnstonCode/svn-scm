import { readdir as fsReaddir } from "fs";

export function readdir(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fsReaddir(path, (err, files) => {
      if (err) {
        reject(err);
      }

      resolve(files);
    });
  });
}
