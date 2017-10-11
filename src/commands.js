const {commands} = require('vscode');

function SvnCommands() {
	//some form of loop that gets the prototypes and registers them with vscode.
}

SvnCommands.prototype.fileOpen = (resourceUri) {
	commands.executeCommand('vscode.open', resourceUri);
}