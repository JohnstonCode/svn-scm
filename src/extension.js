const vscode = require("vscode");
const path = require("path");
const Svn = require("./svn");
const svnContentProvider = require("./svnContentProvider");
const SvnCommands = require("./commands");
const Model = require("./model");

function activate(context) {
  console.log("svn-scm is now active!");

  const disposable = [];
  const svn = new Svn();
  const model = new Model(svn);
  const contentProvider = new svnContentProvider();
  const commands = new SvnCommands(model);

  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;
