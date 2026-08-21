import { readdir as fsReaddir } from "fs";
import { promisify } from "util";

export const readdir = promisify(fsReaddir);
