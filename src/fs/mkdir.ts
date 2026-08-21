import { mkdir as fsMkdir } from "fs";
import { promisify } from "util";

export const mkdir = promisify(fsMkdir);
