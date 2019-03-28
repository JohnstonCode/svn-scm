import { access } from "original-fs";

export function exists(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    access(path, err => (err ? reject(err) : resolve(true)));
  });
}
