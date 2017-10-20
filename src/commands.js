const { commands, scm, window } = require("vscode");
const { inputCommitMessage, changesCommitted } = require("./messages");
const svn = require("./svn");

function SvnCommands(model) {
  this.model = model;
  this.commands = [
    {
      commandId: "svn.commitWithMessage",
      method: this.commitWithMessage,
      options: { repository: true }
    }
  ];

  this.commands.map(({ commandId, method, options }) => {
    const command = this.createCommand(method, options);
    commands.registerCommand(commandId, command);
  });
  // commands.registerCommand("svn.fileOpen", this.fileOpen);
  // commands.registerCommand("svn.commitWithMessage", this.commitWithMessage);
  // commands.registerCommand("svn.add", this.addFile);
}

SvnCommands.prototype.createCommand = function(method, options) {
  const result = (...args) => {
    let result;

    if (!options.repository) {
      result = Promise.resolve(method.apply(this, args));
    } else {
      const repository = this.model.getRepository(args[0]);
      let repositoryPromise;

      if (repository) {
        repositoryPromise = Promise.resolve(repository);
      } else if (this.model.openRepositories.length === 1) {
        repositoryPromise = Promise.resolve(this.model.openRepositories[0]);
      } else {
        repositoryPromise = this.model.pickRepository();
      }

      result = repositoryPromise.then(repository => {
        if (!repository) {
          return Promise.resolve();
        }

        return Promise.resolve(method.apply(this, [repository, ...args]));
      });
    }

    return result.catch(async err => {
      console.error(err);
    });
  };

  return result;
};

SvnCommands.prototype.fileOpen = resourceUri => {
  commands.executeCommand("vscode.open", resourceUri);
};

SvnCommands.prototype.commitWithMessage = async function(repository) {
  // console.log("fsdsfsf");
  // this.svn = new svn();
  // let message = await inputCommitMessage(scm.inputBox.value);

  console.log(repository.inputBox.value);
  // try {
  //   await this.svn.commit(message);
  //   scm.inputBox.value = "";
  //   changesCommitted();
  // } catch (error) {
  //   console.log(error);
  // }
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
