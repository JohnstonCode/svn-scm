// Only this file is allowed to import VSCode modules
// tslint:disable: import-blacklist

import { env, window } from "vscode";

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;

function getNodeModule<T>(moduleName: string, showError = true): T | undefined {
  const r =
    typeof __webpack_require__ === "function"
      ? __non_webpack_require__
      : require;

  const paths = [
    `${env.appRoot}/node_modules.asar/${moduleName}`,
    `${env.appRoot}/node_modules/${moduleName}`,
    moduleName
  ];

  for (const p of paths) {
    try {
      return r(p);
    } catch (err) {
      // Not in path.
    }
  }

  if (showError) {
    window.showErrorMessage(`Missing dependency: ${moduleName}`);
  }

  return undefined;
}

let iconv_lite = getNodeModule(
  "iconv-lite-umd",
  false
) as typeof import("iconv-lite-umd");
if (!iconv_lite) {
  iconv_lite = getNodeModule("iconv-lite") as typeof import("iconv-lite");
}
export const iconv = iconv_lite;

export const jschardet = getNodeModule(
  "jschardet"
) as typeof import("jschardet");
