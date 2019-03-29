import { access, exists as fsExists } from "original-fs";
import * as util from "util";


export const exists = util.promisify(fsExists);

// export function exists(path: string): Promise<boolean> {
//   return new Promise((resolve, reject) => {
//     access(path, err => (err ? resolve(false) : resolve(true)));
//   });
// }
