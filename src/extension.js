const vscode = require("vscode");
const path = require("path");
const Svn = require("./svn");
const svnSCM = require("./svnSCM");
const svnContentProvider = require("./svnContentProvider");
const SvnCommands = require("./commands");

function activate(context) {
  console.log("svn-scm is now active!");

  const disposable = [];
  const rootPath = vscode.workspace.rootPath;

  const watcher = vscode.workspace.createFileSystemWatcher(`${rootPath}/**/*`);

  const commands = new SvnCommands();
  const sourceControl = new svnSCM();
  const contentProvider = new svnContentProvider();
  const svn = new Svn();

  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
