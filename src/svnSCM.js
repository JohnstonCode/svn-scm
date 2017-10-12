var { Uri, scm } = require("vscode");

function svnSCM() {
  this.sourceControl = scm.createSourceControl("svn", "svn");
  this.sourceControl.acceptInputCommand = {
    command: "svn.commitWithMessage",
    title: "commit"
  };
  this.sourceControl.quickDiffProvider = this;

  return this.sourceControl;
}

svnSCM.prototype.provideOriginalResource = uri => {
  if (uri.scheme !== "file") {
    return;
  }

  return new Uri().with({ scheme: "svn", query: uri.path, path: uri.path });
};

module.exports = svnSCM;
