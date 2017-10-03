var vscode = require('vscode');
var svnSpawn = require('svn-spawn');
var path = require('path');

function svnContentProvider() {
	this.client = this.createClient();
	vscode.workspace.registerTextDocumentContentProvider('svn', this);
}

svnContentProvider.prototype.provideTextDocumentContent = function(uri) {
	const relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath).replace(/\\/g, '/');
	
	return new Promise((resolve, reject) => {
		this.client.cmd(['ls', relativePath], function(err, data) {
			if (err) {
				resolve('');
				reject(err);
			}
		});

		this.client.cmd(['cat', '-r', 'HEAD', relativePath], function(err, data) {
			resolve(data);
			reject(err);
		});
	});
}

svnContentProvider.prototype.createClient = () => {
	return new svnSpawn({
		cwd: vscode.workspace.rootPath,
		noAuthCache: true,
	});
}

module.exports = svnContentProvider;