import * as xml2js from "xml2js";

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

function camelcase(name: string) {
  return name
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
      return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
    .replace(/[\s\-]+/g, "");
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
