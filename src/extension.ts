import { ExtensionContext, Disposable } from "vscode";
import { Svn } from "./svn";
import { SvnContentProvider } from "./svnContentProvider";
import { SvnCommands } from "./commands";
import { Model } from "./model";

function activate(context: ExtensionContext) {
  const disposables: Disposable[] = [];
  const svn = new Svn();
  const model = new Model(svn);
  const contentProvider = new SvnContentProvider(model);
  const commands = new SvnCommands(model);
  disposables.push(model);

  console.log("svn-scm is now active!");

  context.subscriptions.push(
    new Disposable(() => Disposable.from(...disposables).dispose())
  );
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
