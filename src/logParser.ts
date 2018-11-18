import * as xml2js from "xml2js";
import { xml2jsParseSettings } from "./common/constants";
import { ISvnLogEntry } from "./common/types";

export async function parseSvnLog(content: string): Promise<ISvnLogEntry[]> {
  return new Promise<ISvnLogEntry[]>((resolve, reject) => {
    xml2js.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }
      let transformed = [];
      if (Array.isArray(result.logentry)) {
        transformed = result.logentry;
      } else if (typeof result.logentry === "object") {
        transformed = [result.logentry];
      }
      for (const logentry of transformed) {
        if (logentry.paths === undefined) {
          logentry.paths = [];
        } else if (Array.isArray(logentry.paths.path)) {
          logentry.paths = logentry.paths.path;
        } else {
          logentry.paths = [logentry.paths.path];
        }
      }
      resolve(transformed);
    });
  });
}
