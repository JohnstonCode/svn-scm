const { commands, scm, window } = require("vscode");
const { inputCommitMessage, changesCommitted } = require("./messages");
const svn = require("./svn");

function SvnCommands() {
  commands.registerCommand("svn.fileOpen", this.fileOpen);
  commands.registerCommand("svn.commitWithMessage", this.commitWithMessage);
  commands.registerCommand("svn.add", this.addFile);
}

SvnCommands.prototype.fileOpen = resourceUri => {
  commands.executeCommand("vscode.open", resourceUri);
};

SvnCommands.prototype.commitWithMessage = async function() {
  this.svn = new svn();
  let message = await inputCommitMessage(scm.inputBox.value);

  try {
    await this.svn.commit(message);
    scm.inputBox.value = "";
    changesCommitted();
  } catch (error) {
    console.log(error);
  }
};

SvnCommands.prototype.addFile = async uri => {
  this.svn = new svn();

  try {
    await this.svn.add(uri.resourceUri.path);
  } catch (error) {
    console.log(error);
  }
};

module.exports = SvnCommands;
