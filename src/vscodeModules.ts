// Only this file is allowed to import VSCode modules
// tslint:disable: import-blacklist

import { env } from "vscode";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

function getNodeModule<T>(moduleName: string): T | undefined {
  const r =
    typeof __webpack_require__ === "function"
      ? __non_webpack_require__
      : require;
  try {
    return r(`${env.appRoot}/node_modules.asar/${moduleName}`);
  } catch (err) {
    // Not in ASAR.
  }
  try {
    return r(`${env.appRoot}/node_modules/${moduleName}`);
  } catch (err) {
    console.log(`Missing dependency: ${moduleName}`);
  }
  return undefined;
}

export const keytar = getNodeModule("keytar") as typeof import("keytar");

let iconv_lite = getNodeModule(
  "iconv-lite-umd"
) as typeof import("iconv-lite-umd");
if (!iconv_lite) {
  iconv_lite = getNodeModule("iconv-lite") as typeof import("iconv-lite");
}
export const iconv = iconv_lite;

export const jschardet = getNodeModule(
  "jschardet"
) as typeof import("jschardet");
