var vscode = require('vscode');

module.exports = {
    sourceControl: null,

    init: function() {
        this.sourceControl = vscode.scm.createSourceControl('svn', 'svn');
        this.sourceControl.quickDiffProvider = this;

        return this.sourceControl;
    },

    provideOriginalResource: function(uri) {
        if (uri.scheme !== 'file') {
            return;
        }

        return vscode.Uri.with({ scheme: 'svn', query: uri.path, path: uri.path});
    }
};