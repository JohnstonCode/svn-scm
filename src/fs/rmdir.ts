import { rmdir as fsRmdir } from "original-fs";
import { promisify } from "util";

export const rmdir = promisify(fsRmdir);

