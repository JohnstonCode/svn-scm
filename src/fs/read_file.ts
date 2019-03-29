import { readFile as fsReadFile } from "original-fs";

export function readFile(
  filePath: string,
  options: { encoding?: string | null; flag?: string } = {}
): Promise<string | Buffer> {
  return new Promise((resolve, reject) => {
    fsReadFile(filePath, options, (err, data) =>
      err ? reject(err) : resolve(data)
    );
  });
}
