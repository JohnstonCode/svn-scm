import { readFile as fsReadFile } from "original-fs";
import { promisify } from "util";

export const readFile = promisify(fsReadFile);

