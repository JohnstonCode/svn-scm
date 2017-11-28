import { ExtensionContext, Disposable, window } from "vscode";
import { Svn } from "./svn";
import { SvnContentProvider } from "./svnContentProvider";
import { SvnCommands } from "./commands";
import { Model } from "./model";
import { toDisposable } from "./util";

function activate(context: ExtensionContext) {
  const disposables: Disposable[] = [];

  const outputChannel = window.createOutputChannel("Svn");
  disposables.push(outputChannel);

  const svn = new Svn();
  const model = new Model(svn);
  const contentProvider = new SvnContentProvider(model);
  const commands = new SvnCommands(model);
  disposables.push(model);

  outputChannel.appendLine("svn-scm is now active!");

  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );

  const onOutput = (str: string) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
