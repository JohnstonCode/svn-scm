import { unlink as fsUnlink } from "fs";
import { promisify } from "util";

export const unlink = promisify(fsUnlink);
