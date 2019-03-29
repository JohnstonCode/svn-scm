import { writeFile as fsWriteFile } from "original-fs";
import { promisify } from "util";

export const writeFile = promisify(fsWriteFile);
