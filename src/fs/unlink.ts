import { unlink as fsUnlink } from "original-fs";
import { promisify } from "util";

export const unlink = promisify(fsUnlink);

