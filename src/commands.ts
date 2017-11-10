import { commands, scm, window, Uri } from "vscode";
import { inputCommitMessage, changesCommitted } from "./messages";
import { Svn } from "./svn";
import { Model } from "./model";
import { Repository } from "./repository";

interface CommandOptions {
  repository?: boolean;
}

export class SvnCommands {
  private commands: any[] = [];

  constructor(private model: Model) {
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

  private createCommand(
    method: Function,
    options: CommandOptions
  ): (...args: any[]) => any {
    const result = (...args: any[]) => {
      let result;

      if (!options.repository) {
        result = Promise.resolve(method.apply(this, args));
      } else {
        const repository = this.model.getRepository(args[0]);
        let repositoryPromise;

        if (repository) {
          repositoryPromise = Promise.resolve(repository);
        } else if (this.model.openRepositories.length === 1) {
          repositoryPromise = Promise.resolve(this.model.repositories[0]);
        } else {
          repositoryPromise = this.model.pickRepository();
        }

        result = repositoryPromise.then(repository => {
          if (!repository) {
            return Promise.resolve();
          }

          return Promise.resolve(method.apply(this, [repository, args]));
        });
      }

      return result.catch(err => {
        console.error(err);
      });
    };

    return result;
  }

  fileOpen(resourceUri: Uri) {
    commands.executeCommand("vscode.open", resourceUri);
  }

  async commitWithMessage(repository: Repository) {
    const message = repository.inputBox.value;
    const changes = repository.changes.resourceStates;
    let filePaths;

    if (!message) {
      return;
    }

    if (changes.length === 0) {
      window.showInformationMessage("There are no changes to commit.");
      return;
    }

    filePaths = changes.map(state => {
      return state.resourceUri.fsPath;
    });

    try {
      await repository.repository.commitFiles(message, filePaths);
      repository.inputBox.value = "";
      changesCommitted();
      repository.update();
    } catch (error) {
      window.showErrorMessage("Unable to commit");
    }
  }

  async addFile(uri: Uri) {
    const svn = new Svn();

    try {
      await svn.add(uri.fsPath);
    } catch (error) {
      window.showErrorMessage("Unable to add file");
    }
  }

  async commit(repository: Repository, ...args: any[]) {
    const paths = args.map(state => {
      return state.resourceUri.fsPath;
    });
    const message = await inputCommitMessage();

    if (message === undefined) {
      return;
    }

    try {
      await repository.repository.commitFiles(message, paths);
      changesCommitted();
      repository.update();
    } catch (error) {
      window.showErrorMessage("Unable to commit");
    }
  }

  refresh(repository: Repository) {
    repository.update();
  }
}
