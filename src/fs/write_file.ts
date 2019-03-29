import { writeFile as fsWriteFile } from "original-fs";

export function writeFile(
  filePath: string,
  data: string,
  encoding?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (encoding) {
      fsWriteFile(filePath, data, encoding, err =>
        err ? reject(err) : resolve()
      );
    } else {
      fsWriteFile(filePath, data, err => (err ? reject(err) : resolve()));
    }
  });
}
