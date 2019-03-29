import { lstat as fsLstat } from "original-fs";
import { promisify } from "util";

export const lstat = promisify(fsLstat);
