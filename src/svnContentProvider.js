var vscode = require('vscode');

module.exports = {
    init: function() {
        vscode.workspace.registerTextDocumentContentProvider('svn', this);
    },

    provideTextDocumentContent: function(uri) {
        
    }
};