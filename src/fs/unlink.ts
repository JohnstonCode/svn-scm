import { unlink as fsUnlink } from "original-fs";

export function unlink(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fsUnlink(filePath, err => (err ? reject(err) : resolve()));
  });
}
