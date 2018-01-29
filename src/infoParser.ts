import * as xml2js from "xml2js";
import { camelcase } from "./util";

export interface ISvnInfo {
  kind: string;
  path: string;
  revision: string;
  url: string;
  relativeUrl: string;
  repository: {
    root: string;
    uuid: string;
  };
  wcInfo: {
    wcrootAbspath: string;
    uuid: string;
  };
  commit: {
    revision: string;
    author: string;
    date: string;
  };
}

export async function parseInfoXml(content: string): Promise<ISvnInfo> {
  return new Promise<ISvnInfo>((resolve, reject) => {
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
        if (err || typeof result.entry === "undefined") {
          reject();
        }

        resolve(result.entry);
      }
    );
  });
}
