const { commands, scm, window } = require("vscode");
const { inputCommitMessage, changesCommitted } = require("./messages");
const Svn = require("./svn");

function SvnCommands(model) {
  this.model = model;
  this.commands = [
    {
      commandId: "svn.commitWithMessage",
      method: this.commitWithMessage,
      options: { repository: true }
    },
    {
      commandId: "svn.add",
      method: this.addFile,
      options: {}
    },
    {
      commandId: "svn.fileOpen",
      method: this.fileOpen,
      options: {}
    }
  ];

  this.commands.map(({ commandId, method, options }) => {
    const command = this.createCommand(method, options);
    commands.registerCommand(commandId, command);
  });
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
  const svn = new Svn(repository.root);
  let message = repository.inputBox.value;

  try {
    await svn.commit(message);
    repository.inputBox.value = "";
    changesCommitted();
  } catch (error) {
    console.log(error);
  }
};

SvnCommands.prototype.addFile = async uri => {
  this.svn = new Svn();

  try {
    await this.svn.add(uri.resourceUri.fsPath);
  } catch (error) {
    console.log(error);
  }
};

module.exports = SvnCommands;
