var vscode = require("vscode");
var svn = require("./svn");
var path = require("path");

function SvnContentProvider() {
  this.svn = new svn();
  vscode.workspace.registerTextDocumentContentProvider("svn", this);
}

SvnContentProvider.prototype.provideTextDocumentContent = function(uri) {
  return new Promise((resolve, reject) => {
    this.svn
      .show(uri.fsPath)
      .then(result => resolve(result))
      .catch(error => reject(error));
  });
};

module.exports = SvnContentProvider;
