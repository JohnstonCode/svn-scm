import { camelcase } from "../util";

export const xml2jsParseSettings = {
  mergeAttrs: true,
  explicitRoot: false,
  explicitArray: false,
  attrNameProcessors: [camelcase],
  tagNameProcessors: [camelcase]
};
