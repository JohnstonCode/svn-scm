import { readFile as fsReadFile } from "fs";
import { promisify } from "util";

export const readFile = promisify(fsReadFile);
