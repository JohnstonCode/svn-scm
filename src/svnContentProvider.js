var vscode = require('vscode');
var svn = require('./svn');
var path = require('path');

function svnContentProvider() {
	this.svn = new svn();
	vscode.workspace.registerTextDocumentContentProvider('svn', this);
}

svnContentProvider.prototype.provideTextDocumentContent = function(uri) {
	const relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath).replace(/\\/g, '/');

	return new Promise((resolve, reject) => {
		this.svn.cmd(['ls', relativePath])
		.then(() => {
			return this.svn.cmd(['cat', '-r', 'HEAD', relativePath]);
		})
		.then((result) => {
			resolve(result);
		})
		.catch((err) => {
			reject(error);
		});
	});
}

module.exports = svnContentProvider;
