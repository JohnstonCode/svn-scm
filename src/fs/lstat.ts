import { lstat as fsLstat } from "fs";
import { promisify } from "util";

export const lstat = promisify(fsLstat);
