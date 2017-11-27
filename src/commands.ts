import {
  commands,
  scm,
  window,
  Uri,
  TextDocumentShowOptions,
  QuickPickItem
} from "vscode";
import { inputCommitMessage, changesCommitted } from "./messages";
import { Svn } from "./svn";
import { Model } from "./model";
import { Repository } from "./repository";
import { Resource } from "./resource";
import { toSvnUri } from "./uri";
import * as path from "path";

interface CommandOptions {
  repository?: boolean;
}

class CreateBranchItem implements QuickPickItem {
  constructor(private commands: SvnCommands) {}

  get label(): string {
    return "$(plus) Create new branch";
  }

  get description(): string {
    return "";
  }

  async run(repository: Repository): Promise<void> {
    await this.commands.branch(repository);
  }
}

class SwitchBranchItem implements QuickPickItem {
  constructor(protected ref: string) {}

  get label(): string {
    return this.ref;
  }

  get description(): string {
    return "";
  }

  async run(repository: Repository): Promise<void> {
    await repository.switchBranch(this.ref);
  }
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
      },
      {
        commandId: "svn.openDiffHead",
        method: this.openDiffHead,
        options: {}
      },
      {
        commandId: "svn.switchBranch",
        method: this.switchBranch,
        options: { repository: true }
      },
      {
        commandId: "svn.branch",
        method: this.branch,
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

  async addFile(resource: Resource) {
    const repository = this.model.getRepository(resource.resourceUri.fsPath);

    if (!repository) {
      return;
    }

    try {
      await repository.addFile(resource.resourceUri.fsPath);
    } catch (error) {
      console.log(error);
      window.showErrorMessage("Unable to add file");
    }
  }

  async commit(repository: Repository, ...args: any[][]): Promise<void> {
    try {
      const paths = args[0].map(state => {
        return state.resourceUri.fsPath;
      });
      const message = await inputCommitMessage();

      if (message === undefined) {
        return;
      }

      await repository.repository.commitFiles(message, paths);
      changesCommitted();
      repository.update();
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to commit");
    }
  }

  refresh(repository: Repository) {
    repository.update();
  }

  async openDiff(resource: Resource, against: string) {
    const left = this.getLeftResource(resource);
    const right = this.getRightResource(resource);
    const title = this.getDiffTitle(resource, against);

    if (!right) {
      return;
    }

    if (!left) {
      window.showErrorMessage(`No diff available at ${against}`);
      return;
    }

    try {
      await commands.executeCommand("vscode.diff", left, right, title);
    } catch (error) {
      console.log(error);
    }
  }

  private getDiffTitle(resource: Resource, ref: string): string {
    let file = path.basename(resource.relativePath);

    return `${file} (${ref})`;
  }

  async openDiffHead(resource: Resource) {
    if (resource instanceof Resource) {
      this.openDiff(resource, "HEAD");
    }
  }

  private getURI(uri: Uri, ref: string): Uri {
    return toSvnUri(uri, ref);
  }

  private getLeftResource(resource: Resource) {
    const repository = this.model.getRepository(resource.resourceUri.fsPath);

    if (!repository) {
      return;
    }

    switch (resource.type) {
      case "modified":
        return this.getURI(resource.resourceUri, "HEAD");
      default:
        return false;
    }
  }

  private getRightResource(resource: Resource) {
    return resource.resourceUri;
  }

  async switchBranch(repository: Repository) {
    const branches = repository.branches.map(
      branch => new SwitchBranchItem(branch)
    );
    const placeHolder = "Pick a branch to switch to.";
    const createBranch = new CreateBranchItem(this);
    const picks = [createBranch, ...branches];

    const choice = await window.showQuickPick(picks, { placeHolder });

    if (!choice) {
      return;
    }

    await choice.run(repository);
  }

  async branch(repository: Repository): Promise<void> {
    const result = await window.showInputBox({
      prompt: "Please provide a branch name",
      ignoreFocusOut: true
    });

    if (!result) {
      return;
    }

    const name = result.replace(
      /^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g,
      "-"
    );
    await repository.branch(name);
  }
}
