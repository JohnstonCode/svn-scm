import * as fs from "fs";

export function readDir(path: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) {
        reject(err);
      }

      resolve(files);
    });
  });
}

export function stat(path: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        reject(err);
      }

      resolve(stats);
    });
  });
}

export function exists(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.access(path, err => (err ? reject(err) : resolve(true)));
  });
}
