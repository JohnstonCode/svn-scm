import { writeFile as fsWriteFile } from "fs";
import { promisify } from "util";

export const writeFile = promisify(fsWriteFile);
