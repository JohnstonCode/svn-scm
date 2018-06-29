import * as xml2js from "xml2js";
import { Repository } from "./repository";
import { camelcase } from "./util";

export enum SvnKindType {
  FILE = "file",
  DIR = "dir"
}

export interface ISvnListItem {
  kind: SvnKindType;
  name: string;
  size: string;
  commit: {
    revision: string;
    author: string;
    date: string;
  };
}

export async function parseSvnList(content: string): Promise<ISvnListItem[]> {
  return new Promise<ISvnListItem[]>((resolve, reject) => {
    xml2js.parseString(
      content,
      {
        mergeAttrs: true,
        explicitRoot: false,
        explicitArray: false,
        attrNameProcessors: [camelcase],
        tagNameProcessors: [camelcase]
      },
      (err, result) => {
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
      }
    );
  });
}
