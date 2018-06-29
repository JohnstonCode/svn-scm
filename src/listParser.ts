import * as xml2js from "xml2js";
import { xml2jsParseSettings } from "./common/constants";
import { ISvnListItem } from "./common/types";

export async function parseSvnList(content: string): Promise<ISvnListItem[]> {
  return new Promise<ISvnListItem[]>((resolve, reject) => {
    xml2js.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }

      if (result.list && result.list.entry) {
        if (!Array.isArray(result.list.entry)) {
          result.list.entry = [result.list.entry];
        }
        resolve(result.list.entry);
      } else {
        resolve([]);
      }
    });
  });
}
