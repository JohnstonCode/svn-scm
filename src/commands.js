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
    },
    {
      commandId: "svn.commit",
      method: this.commit,
      options: { repository: true }
    },
    {
      commandId: "svn.refresh",
      method: this.refresh,
      options: { repository: true }
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
  const message = repository.sourceControl.inputBox.value;
  const resourceStates = repository.changes.resourceStates;
  let filePaths;

  if (!message) {
    return;
  }

  if (resourceStates.length === 0) {
    window.showInformationMessage("There are no changes to commit.");
    return;
  }

  filePaths = resourceStates.map(state => {
    return state.resourceUri.fsPath;
  });

  try {
    await repository.repository.commitFiles(message, filePaths);
    repository.sourceControl.inputBox.value = "";
    changesCommitted();
    repository.update();
  } catch (error) {
    window.showErrorMessage("Unable to commit");
  }
};

SvnCommands.prototype.addFile = async uri => {
  this.svn = new Svn();

  try {
    await this.svn.add(uri.resourceUri.fsPath);
  } catch (error) {
    window.showErrorMessage("Unable to add file");
  }
};

SvnCommands.prototype.commit = async function(repository, ...args) {
  const paths = args.map(resourceState => {
    return resourceState.resourceUri.fsPath;
  });

  try {
    const message = await inputCommitMessage();
    await repository.repository.commitFiles(message, paths);
    changesCommitted();
    repository.update();
  } catch (error) {
    window.showErrorMessage("Unable to commit");
  }
};

SvnCommands.prototype.refresh = function(repository) {
  repository.update();
};

module.exports = SvnCommands;
