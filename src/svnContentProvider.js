var vscode = require('vscode');
var svnSpawn = require('svn-spawn');
var path = require('path');

module.exports = {
    client: null,

    init: function() {
        this.client = this.createClient();
        vscode.workspace.registerTextDocumentContentProvider('svn', this);
    },

    provideTextDocumentContent: function(uri) {
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
    },

    createClient: function() {
        return new svnSpawn({
            cwd: vscode.workspace.rootPath,
            noAuthCache: true,
        });
    }
};