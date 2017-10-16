const { commands, scm, window } = require("vscode");
const Svn = require("./svn");
const { inputCommitMessage } = require("./messages");

function SvnCommands() {
  this.svn = new Svn();

  commands.registerCommand("svn.fileOpen", this.fileOpen);
  commands.registerCommand("svn.commitAll", this.commitAll);
}

SvnCommands.prototype.fileOpen = resourceUri => {
  commands.executeCommand("vscode.open", resourceUri);
};

SvnCommands.prototype.commitAll = () => {
    this.svn = new Svn();

  inputCommitMessage(scm.inputBox.value)
    .then(result => this.svn.commitAll(result))
    .then(() => {
      scm.inputBox.value = "";
    })
    .catch(err => console.log(err));
};

module.exports = SvnCommands;
