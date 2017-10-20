var vscode = require("vscode");
var svn = require("./svn");
var path = require("path");

function svnContentProvider() {
  this.svn = new svn();
  vscode.workspace.registerTextDocumentContentProvider("svn", this);
}

svnContentProvider.prototype.provideTextDocumentContent = function(uri) {
  return new Promise((resolve, reject) => {
    this.svn
      .cmd(["ls", uri.fsPath])
      .then(() => this.svn.cmd(["cat", "-r", "HEAD", uri.fsPath]))
      .then(result => {
        resolve(result);
      })
      .catch(err => {
        reject(err);
      });
  });
};

module.exports = svnContentProvider;
