import { ISvnPath } from "../common/types";
import * as xml2js from "xml2js";
import { camelcase } from "../util";

export async function parseDiffXml(content: string): Promise<ISvnPath[]> {
  return new Promise<ISvnPath[]>((resolve, reject) => {
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
        if (err || !result.paths || !result.paths.path) {
          reject();
        }

        if (!Array.isArray(result.paths.path)) {
          result.paths.path = [result.paths.path];
        }

        resolve(result.paths.path);
      }
    );
  });
}
