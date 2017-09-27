var vscode = require('vscode');
var svnSpawn = require('svn-spawn');
var path = require('path');

module.exports = {
    init: function() {
        vscode.workspace.registerTextDocumentContentProvider('svn', this);
    },

    provideTextDocumentContent: function(uri) {
        const relativePath = path.relative(vscode.workspace.rootPath, uri.fsPath).replace(/\\/g, '/');

        var client = this.createClient();

        return new Promise((resolve, reject) => {
            client.cmd(['ls', relativePath], function(err, data) {
                if (err) {
                    resolve('');
                    reject(err);
                }
            });

            client.cmd(['cat', '-r', 'HEAD', relativePath], function(err, data) {
                resolve(data);
                reject(err);
            });
        });        
    },

    createClient: () => {
        return new svnSpawn({
          cwd: vscode.workspace.rootPath,
          noAuthCache: true,
        });
    }
};