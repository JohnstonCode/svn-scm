import * as xml2js from "xml2js";
import { xml2jsParseSettings } from "./common/constants";
import { ISvnLogEntry } from "./common/types";

export async function parseSvnLog(content: string): Promise<ISvnLogEntry[]> {
  return new Promise<ISvnLogEntry[]>((resolve, reject) => {
    xml2js.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }
      let transformed: any[];
      if (Array.isArray(result)) {
        transformed = result.map(e => e.logentry);
      } else {
        transformed = [result.logentry];
      }
      for (const logentry of transformed) {
        if (logentry.paths === undefined) {
          continue;
        }
        if (!Array.isArray(logentry.paths)) {
          logentry.paths = [logentry.paths];
        }
        logentry.paths = logentry.paths.map((p: any) => p.path);
      }
      resolve(transformed);
    });
  });
}
