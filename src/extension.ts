import {
  commands,
  Disposable,
  ExtensionContext,
  OutputChannel,
  Uri,
  window,
  workspace
} from "vscode";
import { SvnCommands } from "./commands";
import SvnDecorations from "./decorations/svnDecorations";
import { configuration } from "./helpers/configuration";
import { Model } from "./model";
import { Svn } from "./svn";
import { SvnContentProvider } from "./svnContentProvider";
import { SvnFinder } from "./svnFinder";
import {
  hasSupportToDecorationProvider,
  hasSupportToRegisterDiffCommand,
  toDisposable
} from "./util";
import { DepNodeProvider } from "./treeView/incommingChangesDataProvider";

async function init(
  context: ExtensionContext,
  outputChannel: OutputChannel,
  disposables: Disposable[]
) {
  commands.executeCommand("setContext", "svnOpenRepositoryCount", "0");

  const pathHint = configuration.get<string>("path");
  const svnFinder = new SvnFinder();

  const info = await svnFinder.findSvn(pathHint);
  const svn = new Svn({ svnPath: info.path, version: info.version });
  const model = new Model(svn);
  const contentProvider = new SvnContentProvider(model);
  const svnCommands = new SvnCommands(model);
  disposables.push(model, contentProvider, svnCommands);

  const rootPath = workspace.rootPath;
  const incommingChangesProvider = new DepNodeProvider(rootPath);

  window.registerTreeDataProvider("incommingChanges", incommingChangesProvider);

  // First, check the vscode has support to DecorationProvider
  if (hasSupportToDecorationProvider()) {
    const decoration = new SvnDecorations(model);
    disposables.push(decoration);
  }
  const onRepository = () =>
    commands.executeCommand(
      "setContext",
      "svnOpenRepositoryCount",
      `${model.repositories.length}`
    );
  model.onDidOpenRepository(onRepository, null, disposables);
  model.onDidCloseRepository(onRepository, null, disposables);
  onRepository();

  commands.executeCommand(
    "setContext",
    "svnHasSupportToRegisterDiffCommand",
    hasSupportToRegisterDiffCommand() ? "1" : "0"
  );

  outputChannel.appendLine(`Using svn "${info.version}" from "${info.path}"`);

  const onOutput = (str: string) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
}

async function _activate(context: ExtensionContext, disposables: Disposable[]) {
  const outputChannel = window.createOutputChannel("Svn");
  commands.registerCommand("svn.showOutput", () => outputChannel.show());
  disposables.push(outputChannel);

  const showOutput = configuration.get<boolean>("showOutput");

  if (showOutput) {
    outputChannel.show();
  }

  try {
    await init(context, outputChannel, disposables);
  } catch (err) {
    if (!/Svn installation not found/.test(err.message || "")) {
      throw err;
    }

    const shouldIgnore =
      configuration.get<boolean>("ignoreMissingSvnWarning") === true;

    if (shouldIgnore) {
      return;
    }

    console.warn(err.message);
    outputChannel.appendLine(err.message);
    outputChannel.show();

    const download = "Download SVN";
    const neverShowAgain = "Don't Show Again";
    const choice = await window.showWarningMessage(
      "SVN not found. Install it or configure it using the 'svn.path' setting.",
      download,
      neverShowAgain
    );

    if (choice === download) {
      commands.executeCommand(
        "vscode.open",
        Uri.parse("https://subversion.apache.org/packages.html")
      );
    } else if (choice === neverShowAgain) {
      await configuration.update("ignoreMissingSvnWarning", true);
    }
  }
}

export async function activate(context: ExtensionContext) {
  const disposables: Disposable[] = [];
  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );

  await _activate(context, disposables).catch(err => console.error(err));
}

// this method is called when your extension is deactivated
/* tslint:disable:no-empty */
function deactivate() {}
exports.deactivate = deactivate;
