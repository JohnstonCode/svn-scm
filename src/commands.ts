import {
  commands,
  scm,
  window,
  Uri,
  TextDocumentShowOptions,
  QuickPickItem
} from "vscode";
import { inputCommitMessage } from "./messages";
import { Svn } from "./svn";
import { Model } from "./model";
import { Repository } from "./repository";
import { Resource } from "./resource";
import { toSvnUri } from "./uri";
import * as path from "path";

interface CommandOptions {
  repository?: boolean;
}

interface Command {
  commandId: string;
  key: string;
  method: Function;
  options: CommandOptions;
}

const Commands: Command[] = [];

function command(commandId: string, options: CommandOptions = {}): Function {
  return (target: any, key: string, descriptor: any) => {
    if (!(typeof descriptor.value === "function")) {
      throw new Error("not supported");
    }

    Commands.push({ commandId, key, method: descriptor.value, options });
  };
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
  protected tree: string = "";
  protected name: string = "";

  constructor(protected ref: string) {
    let parts = ref.split("/");
    if (parts[1]) {
      this.tree = parts[0];
      this.name = parts[1];
    } else {
      this.tree = parts[0];
      this.name = parts[0];
    }
  }

  get label(): string {
    return this.name;
  }

  get description(): string {
    return this.tree;
  }

  async run(repository: Repository): Promise<void> {
    await repository.switchBranch(this.ref);
  }
}

export class SvnCommands {
  private commands: any[] = [];

  constructor(private model: Model) {
    Commands.map(({ commandId, method, options }) => {
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
        } else if (this.model.repositories.length === 1) {
          repositoryPromise = Promise.resolve(this.model.repositories[0]);
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

      return result.catch(err => {
        console.error(err);
      });
    };

    return result;
  }

  @command("svn.fileOpen")
  fileOpen(resourceUri: Uri) {
    commands.executeCommand("vscode.open", resourceUri);
  }

  @command("svn.commitWithMessage", { repository: true })
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
      const result = await repository.repository.commitFiles(
        message,
        filePaths
      );
      window.showInformationMessage(result);
      repository.inputBox.value = "";
      repository.update();
    } catch (error) {
      console.error(error);
      window.showErrorMessage(error);
    }
  }

  @command("svn.add")
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

  @command("svn.commit", { repository: true })
  async commit(
    repository: Repository,
    ...resourceStates: Resource[]
  ): Promise<void> {
    try {
      const paths = resourceStates.map(state => {
        return state.resourceUri.fsPath;
      });
      const message = await inputCommitMessage();

      if (message === undefined) {
        return;
      }

      const result = await repository.repository.commitFiles(message, paths);
      window.showInformationMessage(result);
      repository.update();
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to commit");
    }
  }

  @command("svn.refresh", { repository: true })
  async refresh(repository: Repository) {
    repository.update();
    repository.updateBranches();
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

  @command("svn.openDiffHead")
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

  @command("svn.switchBranch", { repository: true })
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

  @command("svn.branch", { repository: true })
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

  @command("svn.revert")
  async revert(...resourceStates: Resource[]) {
    if (resourceStates.length === 0) {
      return;
    }

    const yes = "Yes I'm sure";
    const answer = await window.showWarningMessage(
      "Are you sure? This will wipe all local changes.",
      yes
    );

    if (answer !== yes) {
      return;
    }

    try {
      const paths = resourceStates.map(state => {
        return state.resourceUri;
      });

      await this.runByRepository(paths, async (repository, paths) =>
        repository.repository.revert(paths)
      );
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to revert");
    }
  }

  @command("svn.update", { repository: true })
  async update(repository: Repository) {
    try {
      const result = await repository.repository.update();
      window.showInformationMessage(result);
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to update");
    }
  }

  private runByRepository<T>(
    resource: Uri,
    fn: (repository: Repository, resource: Uri) => Promise<T>
  ): Promise<T[]>;
  private runByRepository<T>(
    resources: Uri[],
    fn: (repository: Repository, resources: Uri[]) => Promise<T>
  ): Promise<T[]>;
  private async runByRepository<T>(
    arg: Uri | Uri[],
    fn: (repository: Repository, resources: any) => Promise<T>
  ): Promise<T[]> {
    const resources = arg instanceof Uri ? [arg] : arg;
    const isSingleResource = arg instanceof Uri;

    const groups = resources.reduce(
      (result, resource) => {
        const repository = this.model.getRepository(resource);

        if (!repository) {
          console.warn("Could not find git repository for ", resource);
          return result;
        }

        const tuple = result.filter(p => p.repository === repository)[0];

        if (tuple) {
          tuple.resources.push(resource);
        } else {
          result.push({ repository, resources: [resource] });
        }

        return result;
      },
      [] as { repository: Repository; resources: Uri[] }[]
    );

    const promises = groups.map(({ repository, resources }) =>
      fn(repository as Repository, isSingleResource ? resources[0] : resources)
    );

    return Promise.all(promises);
  }
}
