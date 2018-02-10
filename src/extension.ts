import {
  ExtensionContext,
  Disposable,
  workspace,
  window,
  commands
} from "vscode";
import { Svn } from "./svn";
import { SvnFinder } from "./svnFinder";
import { SvnContentProvider } from "./svnContentProvider";
import { SvnCommands } from "./commands";
import { Model } from "./model";
import {
  toDisposable,
  hasSupportToDecorationProvider,
  hasSupportToRegisterDiffCommand
} from "./util";

async function init(context: ExtensionContext, disposables: Disposable[]) {
  const config = workspace.getConfiguration("svn");
  const outputChannel = window.createOutputChannel("Svn");
  disposables.push(outputChannel);

  const showOutput = config.get<boolean>("showOutput");

  if (showOutput) {
    outputChannel.show();
  }

  const enabled = config.get<boolean>("enabled") === true;
  const pathHint = config.get<string>("path");
  const svnFinder = new SvnFinder();

  let info = null;
  try {
    info = await svnFinder.findSvn(pathHint);
  } catch (error) {
    outputChannel.appendLine(error);
    return;
  }

  const svn = new Svn({ svnPath: info.path, version: info.version });
  const model = new Model(svn);
  const contentProvider = new SvnContentProvider(model);
  const svnCommands = new SvnCommands(model);
  disposables.push(model, contentProvider, svnCommands);

  // First, check the vscode has support to DecorationProvider
  if (hasSupportToDecorationProvider()) {
    import("./decorationProvider").then(provider => {
      const decoration = new provider.SvnDecorations(model);
      disposables.push(decoration);
    });
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

  outputChannel.appendLine("Using svn " + info.version + " from " + info.path);

  const onOutput = (str: string) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
}

export async function activate(context: ExtensionContext) {
  const disposables: Disposable[] = [];
  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );

  await init(context, disposables).catch(err => console.error(err));
}

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
