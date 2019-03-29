import { readdir as fsReaddir } from "original-fs";
import { promisify } from "util";

export const readdir = promisify(fsReaddir);

