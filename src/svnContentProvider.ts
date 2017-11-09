var vscode = require("vscode");

function SvnContentProvider(model) {
  this.model = model;
  vscode.workspace.registerTextDocumentContentProvider("svn", this);
}

SvnContentProvider.prototype.provideTextDocumentContent = async function(uri) {
  const repository = this.model.getRepository(uri.fsPath);

  if (!repository) {
    return "";
  }

  try {
    return await repository.show(uri.fsPath);
  } catch (error) {
    return "";
  }
};

module.exports = SvnContentProvider;
