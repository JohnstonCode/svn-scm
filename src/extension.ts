import { ExtensionContext, Disposable, workspace, window } from "vscode";
import { Svn, findSvn } from "./svn";
import { SvnContentProvider } from "./svnContentProvider";
import { SvnCommands } from "./commands";
import { Model } from "./model";
import { toDisposable } from "./util";

async function init(context: ExtensionContext, disposables: Disposable[]) {
  const outputChannel = window.createOutputChannel("Svn");
  disposables.push(outputChannel);

  const config = workspace.getConfiguration('svn');
  const enabled = config.get<boolean>('enabled') === true;
  const pathHint = config.get<string>('path');

  let info = null;
  try {
    info = await findSvn(pathHint);
  } catch (error) {
    outputChannel.appendLine(error);
    return;
  }

  const svn = new Svn({svnPath: info.path, version: info.version});
  const model = new Model(svn);
  const contentProvider = new SvnContentProvider(model);
  const commands = new SvnCommands(model);
  disposables.push(model);

  outputChannel.appendLine("Using svn " + info.version + " from " + info.path);

  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );

  const onOutput = (str: string) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
}

function activate(context: ExtensionContext): any {
  const disposables: Disposable[] = [];
  context.subscriptions.push(new Disposable(() => Disposable.from(...disposables).dispose()));

  init(context, disposables)
    .catch(err => console.error(err));
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
