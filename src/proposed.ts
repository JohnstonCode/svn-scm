import * as fs from "original-fs";
import { ConfigurationTarget, env, window } from "vscode";
import { access, exists, writeFile } from "./fs";
import { configuration } from "./helpers/configuration";
import { hasSupportToDecorationProvider } from "./util";

enum ProposedType {
  PRODUCT = "product",
  ARGUMENT = "argument",
  NONE = "none",
}

export async function checkProposedApi() {

  if (hasSupportToDecorationProvider()) {
    return;
  }

  let status: ProposedType | null | undefined = null;
  status = configuration.get<ProposedType | null>("enableProposedApi", null);

  if (!status) {
    status = await promptProposedApi();
  }

  try {
    setProposedApi(status);
  } catch (error) {
    console.error(error);
    await window.showErrorMessage("Failed to configure proposed features for SVN");
  }
}

async function promptProposedApi() {
  const product = "Yes, edit product.json";
  const argument = "Yes, with start argument";
  const none = "No";
  const choice = await window.showWarningMessage(
    `Do you like to enable proposed features for SVN?
    More info [here](https://github.com/JohnstonCode/svn-scm#experimental)`,
    product,
    argument,
    none
  );

  switch (choice) {
    case product:
      return ProposedType.PRODUCT;
    case argument:
      return ProposedType.ARGUMENT;
    case none:
      return ProposedType.NONE;
  }

  return undefined;
}

export async function setProposedApi(status?: ProposedType) {
  switch (status) {
    case ProposedType.PRODUCT:
      enableProposedProduct();
      break;
    case ProposedType.ARGUMENT:
      enableProposedArgument();
      break;
    case ProposedType.NONE:
      break;
  }

  if (status) {
    configuration.update("enableProposedApi", status, ConfigurationTarget.Global);
  }
}

async function enableProposedProduct() {
  const productPath = env.appRoot + "/product.json";

  if (!await exists(productPath)) {
    window.showErrorMessage(`Can't find the "product.json" of VSCode.`);
    return;
  }
  if (!await access(productPath, fs.constants.W_OK)) {
    window.showErrorMessage(`The "product.json" of VSCode is not writable.
      Please, append "johnstoncode.svn-scm" on "extensionAllowedProposedApi" array`);
    return;
  }

  const productJson = require(productPath) as {
    extensionAllowedProposedApi: string[],
    [key: string]: any;
  };

  productJson.extensionAllowedProposedApi = productJson.extensionAllowedProposedApi || [];

  if (productJson.extensionAllowedProposedApi.includes("johnstoncode.svn-scm")) {
    return;
  }
  productJson.extensionAllowedProposedApi.push("johnstoncode.svn-scm");

  await writeFile(productPath, JSON.stringify(productJson, null, 2));

  const message = "SVN proposed features enabled, please, close the VSCode and open again";

  window.showInformationMessage(message);
}

async function enableProposedArgument() {
  const packagePath = __dirname + "/../package.json";

  const packageJson = require(packagePath);

  if (!packageJson || packageJson.enableProposedApi !== false) {
    return;
  }

  packageJson.enableProposedApi = true;
  await writeFile(packagePath, JSON.stringify(packageJson, null, 2));

  const message = `SVN proposed features enabled, please,
    close the VSCode and run with: --enable-proposed-api johnstoncode.svn-scm`;

  window.showInformationMessage(message);
}
