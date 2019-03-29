import { mkdir as fsMkdir } from "original-fs";
import { promisify } from "util";

export const mkdir = promisify(fsMkdir);
