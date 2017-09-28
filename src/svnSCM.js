var {Uri, scm} = require('vscode');

module.exports = {
    sourceControl: null,

    init: function() {
        this.sourceControl = scm.createSourceControl('svn', 'svn');
        this.sourceControl.quickDiffProvider = this;

        return this.sourceControl;
    },

    provideOriginalResource: function(uri) {
        if (uri.scheme !== 'file') {
            return;
        }

        return new Uri().with({ scheme: 'svn', query: uri.path, path: uri.path});
    }
};
