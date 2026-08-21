import { stat as fsStat } from "fs";
import { promisify } from "util";

export const stat = promisify(fsStat);
