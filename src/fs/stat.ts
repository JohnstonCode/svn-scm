import { stat as fsStat } from "original-fs";
import { promisify } from "util";

export const stat = promisify(fsStat);

