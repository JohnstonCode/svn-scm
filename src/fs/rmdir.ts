import { rmdir as fsRmdir } from "fs";
import { promisify } from "util";

export const rmdir = promisify(fsRmdir);
