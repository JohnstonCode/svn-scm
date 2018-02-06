import {
  commands,
  scm,
  window,
  Uri,
  TextDocumentShowOptions,
  QuickPickItem,
  workspace,
  SourceControlResourceGroup,
  ViewColumn,
  SourceControlResourceState,
  ProgressLocation
} from "vscode";
import { inputCommitMessage } from "./messages";
import { Svn, Status, SvnErrorCodes } from "./svn";
import { Model } from "./model";
import { Repository } from "./repository";
import { Resource } from "./resource";
import { toSvnUri, fromSvnUri } from "./uri";
import * as fs from "fs";
import * as path from "path";
import { start } from "repl";
import { getConflictPickOptions } from "./conflictItems";

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
    try {
      await repository.switchBranch(this.ref);
    } catch (error) {
      if (error.svnErrorCode === SvnErrorCodes.NotShareCommonAncestry) {
        window.showErrorMessage(
          `Path '${
            repository.workspaceRoot
          }' does not share common version control ancestry with the requested switch location.`
        );
        return;
      }

      window.showErrorMessage("Unable to switch branch");
    }
  }
}

class ChangeListItem implements QuickPickItem {
  constructor(protected group: SourceControlResourceGroup) {}

  get label(): string {
    return this.group.label;
  }

  get description(): string {
    return this.group.label;
  }
  get resourceGroup(): SourceControlResourceGroup {
    return this.group;
  }
}

class NewChangeListItem implements QuickPickItem {
  constructor() {}

  get label(): string {
    return "$(plus) New changelist";
  }

  get description(): string {
    return "Create a new change list";
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
    if (!message) {
      return;
    }

    const picks: ChangeListItem[] = [];

    if (repository.changes.resourceStates.length) {
      picks.push(new ChangeListItem(repository.changes));
    }

    const svnConfig = workspace.getConfiguration("svn");
    const ignoreOnCommitList = svnConfig.get<string[]>(
      "sourceControl.ignoreOnCommit",
      []
    );

    repository.changelists.forEach((group, changelist) => {
      if (
        group.resourceStates.length &&
        !ignoreOnCommitList.includes(changelist)
      ) {
        picks.push(new ChangeListItem(group));
      }
    });

    if (picks.length === 0) {
      window.showInformationMessage("There are no changes to commit.");
      return;
    }

    let choice;
    // If has only changes, not prompt to select changelist
    if (picks.length === 1 && repository.changes.resourceStates.length) {
      choice = picks[0];
    } else {
      choice = await window.showQuickPick(picks, {
        placeHolder: "Select a changelist to commit"
      });
    }

    if (!choice) {
      return;
    }

    const filePaths = choice.resourceGroup.resourceStates.map(state => {
      return state.resourceUri.fsPath;
    });

    // If files is renamed, the commit need previous file
    choice.resourceGroup.resourceStates.forEach(state => {
      if (state instanceof Resource) {
        if (state.type === Status.ADDED && state.renameResourceUri) {
          filePaths.push(state.renameResourceUri.fsPath);
        }
      }
    });

    try {
      const result = await repository.commitFiles(message, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
    } catch (error) {
      console.error(error);
      window.showErrorMessage(error);
    }
  }

  @command("svn.add")
  async addFile(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.addFiles(paths);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to add file");
      }
    });
  }

  @command("svn.addChangelist")
  async addChangelist(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const picks: QuickPickItem[] = [];

      repository.changelists.forEach((group, changelist) => {
        if (group.resourceStates.length) {
          picks.push(new ChangeListItem(group));
        }
      });
      picks.push(new NewChangeListItem());

      const selectedChoice: any = await window.showQuickPick(picks, {});
      if (!selectedChoice) {
        return;
      }

      let changelistName = "";

      if (selectedChoice instanceof NewChangeListItem) {
        const newChangelistName = await window.showInputBox();
        if (!newChangelistName) {
          return;
        }
        changelistName = newChangelistName;
      } else if (selectedChoice instanceof ChangeListItem) {
        changelistName = selectedChoice.resourceGroup.id.replace(
          /^changelist-/,
          ""
        );
      } else {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.addChangelist(paths, changelistName);
      } catch (error) {
        console.log(error);
        window.showErrorMessage(
          `Unable to add file 
          "${paths.join(",")}" to changelist "${changelistName}"`
        );
      }
    });
  }

  @command("svn.removeChangelist")
  async removeChangelist(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.removeChangelist(paths);
      } catch (error) {
        console.log(error);
        window.showErrorMessage(
          `Unable to remove file "${paths.join(",")}" from changelist`
        );
      }
    });
  }

  @command("svn.commit")
  async commit(...resources: SourceControlResourceState[]): Promise<void> {
    if (resources.length === 0 || !(resources[0].resourceUri instanceof Uri)) {
      const resource = this.getSCMResource();

      if (!resource) {
        return;
      }

      resources = [resource];
    }

    const selection = resources.filter(
      s => s instanceof Resource
    ) as Resource[];

    const uris = selection.map(resource => resource.resourceUri);
    selection.forEach(resource => {
      if (resource.type === Status.ADDED && resource.renameResourceUri) {
        uris.push(resource.renameResourceUri);
      }
    });

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        const message = await inputCommitMessage();

        if (message === undefined) {
          return;
        }

        const result = await repository.commitFiles(message, paths);
        window.showInformationMessage(result);
      } catch (error) {
        console.error(error);
        window.showErrorMessage("Unable to commit");
      }
    });
  }

  @command("svn.refresh", { repository: true })
  async refresh(repository: Repository) {
    await repository.status();
  }

  @command("svn.openResourceBase")
  async openResourceBase(resource: Resource): Promise<void> {
    await this._openResource(resource, "BASE", undefined, true, false);
  }

  @command("svn.openResourceHead")
  async openResourceHead(resource: Resource): Promise<void> {
    await this._openResource(resource, "HEAD", undefined, true, false);
  }

  @command("svn.openFile")
  async openFile(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const preserveFocus = arg instanceof Resource;

    let uris: Uri[] | undefined;

    if (arg instanceof Uri) {
      if (arg.scheme === "svn") {
        uris = [Uri.file(fromSvnUri(arg).path)];
      } else if (arg.scheme === "file") {
        uris = [arg];
      }
    } else {
      let resource = arg;

      if (!(resource instanceof Resource)) {
        // can happen when called from a keybinding
        resource = this.getSCMResource();
      }

      if (resource) {
        uris = [
          ...resourceStates.map(r => r.resourceUri),
          resource.resourceUri
        ];
      }
    }

    if (!uris) {
      return;
    }

    const preview = uris.length === 1 ? true : false;
    const activeTextEditor = window.activeTextEditor;
    for (const uri of uris) {
      if (fs.statSync(uri.fsPath).isDirectory()) {
        continue;
      }

      const opts: TextDocumentShowOptions = {
        preserveFocus,
        preview: preview,
        viewColumn: ViewColumn.Active
      };

      if (
        activeTextEditor &&
        activeTextEditor.document.uri.toString() === uri.toString()
      ) {
        opts.selection = activeTextEditor.selection;
      }

      const document = await workspace.openTextDocument(uri);
      await window.showTextDocument(document, opts);
    }
  }

  @command("svn.openHEADFile")
  async openHEADFile(arg?: Resource | Uri): Promise<void> {
    let resource: Resource | undefined = undefined;

    if (arg instanceof Resource) {
      resource = arg;
    } else if (arg instanceof Uri) {
      resource = this.getSCMResource(arg);
    } else {
      resource = this.getSCMResource();
    }

    if (!resource) {
      return;
    }

    const HEAD = this.getLeftResource(resource, "HEAD");

    if (!HEAD) {
      const basename = path.basename(resource.resourceUri.fsPath);
      window.showWarningMessage(
        `"HEAD version of '${basename}' is not available."`
      );
      return;
    }

    return await commands.executeCommand<void>("vscode.open", HEAD);
  }

  @command("svn.openChangeBase")
  async openChangeBase(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    return this.openChange(arg, "BASE", resourceStates);
  }

  @command("svn.openChangeHead")
  async openChangeHead(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    return this.openChange(arg, "HEAD", resourceStates);
  }

  async openChange(
    arg?: Resource | Uri,
    against?: string,
    resourceStates?: SourceControlResourceState[]
  ): Promise<void> {
    const preserveFocus = arg instanceof Resource;
    const preserveSelection = arg instanceof Uri || !arg;
    let resources: Resource[] | undefined = undefined;

    if (arg instanceof Uri) {
      const resource = this.getSCMResource(arg);
      if (resource !== undefined) {
        resources = [resource];
      }
    } else {
      let resource: Resource | undefined = undefined;

      if (arg instanceof Resource) {
        resource = arg;
      } else {
        resource = this.getSCMResource();
      }

      if (resource) {
        resources = [...(resourceStates as Resource[]), resource];
      }
    }

    if (!resources) {
      return;
    }

    const preview = resources.length === 1 ? undefined : false;
    for (const resource of resources) {
      await this._openResource(
        resource,
        against,
        preview,
        preserveFocus,
        preserveSelection
      );
    }
  }

  private async _openResource(
    resource: Resource,
    against?: string,
    preview?: boolean,
    preserveFocus?: boolean,
    preserveSelection?: boolean
  ): Promise<void> {
    const left = this.getLeftResource(resource, against);
    const right = this.getRightResource(resource, against);
    const title = this.getTitle(resource, against);

    if (!right) {
      // TODO
      console.error("oh no");
      return;
    }

    if (fs.statSync(right.fsPath).isDirectory()) {
      return;
    }

    const opts: TextDocumentShowOptions = {
      preserveFocus,
      preview,
      viewColumn: ViewColumn.Active
    };

    const activeTextEditor = window.activeTextEditor;

    if (
      preserveSelection &&
      activeTextEditor &&
      activeTextEditor.document.uri.toString() === right.toString()
    ) {
      opts.selection = activeTextEditor.selection;
    }

    if (!left) {
      const document = await workspace.openTextDocument(right);
      await window.showTextDocument(document, opts);
      return;
    }

    return await commands.executeCommand<void>(
      "vscode.diff",
      left,
      right,
      title,
      opts
    );
  }

  private getLeftResource(
    resource: Resource,
    against: string = ""
  ): Uri | undefined {
    if (resource.type === Status.ADDED && resource.renameResourceUri) {
      return toSvnUri(resource.renameResourceUri, against);
    }

    switch (resource.type) {
      case Status.MODIFIED:
      case Status.REPLACED:
        return toSvnUri(resource.resourceUri, against);
    }
  }

  private getRightResource(
    resource: Resource,
    against: string = ""
  ): Uri | undefined {
    switch (resource.type) {
      case Status.ADDED:
      case Status.IGNORED:
      case Status.MODIFIED:
      case Status.UNVERSIONED:
      case Status.REPLACED:
        return resource.resourceUri;
      case Status.DELETED:
      case Status.MISSING:
        return toSvnUri(resource.resourceUri, against);
    }
  }

  private getTitle(resource: Resource, against?: string): string {
    if (resource.type === Status.ADDED && resource.renameResourceUri) {
      const basename = path.basename(resource.renameResourceUri.fsPath);

      const newname = path.relative(
        path.dirname(resource.renameResourceUri.fsPath),
        resource.resourceUri.fsPath
      );
      if (against) {
        return `${basename} -> ${newname} (${against})`;
      }
      return `${basename} -> ${newname}`;
    }
    const basename = path.basename(resource.resourceUri.fsPath);

    if (against) {
      return `${basename} (${against})`;
    }

    return "";
  }

  @command("svn.switchBranch", { repository: true })
  async switchBranch(repository: Repository) {
    const branchesPromise = repository.getBranches();

    window.withProgress(
      { location: ProgressLocation.Window, title: "Checking remote branches" },
      () => branchesPromise
    );

    const branches = await branchesPromise;

    const branchPicks = branches.map(branch => new SwitchBranchItem(branch));
    const placeHolder = "Pick a branch to switch to.";
    const createBranch = new CreateBranchItem(this);
    const picks = [createBranch, ...branchPicks];

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
  async revert(...resourceStates: SourceControlResourceState[]): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
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

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        await repository.revert(paths);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to revert");
      }
    });
  }

  @command("svn.update", { repository: true })
  async update(repository: Repository) {
    try {
      const result = await repository.updateRevision();
      window.showInformationMessage(result);
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to update");
    }
  }

  @command("svn.patch", { repository: true })
  async patch(repository: Repository) {
    try {
      const result = await repository.patch();
      // send the patch results to a new tab
      workspace
        .openTextDocument({ language: "diff", content: result })
        .then(doc => {
          window.showTextDocument(doc);
        });
      window.showInformationMessage("Files Patched");
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to patch");
    }
  }

  @command("svn.remove")
  async remove(...resourceStates: SourceControlResourceState[]): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    let keepLocal: boolean;
    const answer = await window.showWarningMessage(
      "Would you like to keep a local copy of the files?.",
      "Yes",
      "No"
    );

    if (!answer) {
      return;
    }

    if (answer === "Yes") {
      keepLocal = true;
    } else {
      keepLocal = false;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      try {
        const result = await repository.removeFiles(paths, keepLocal);
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to remove files");
      }
    });
  }

  @command("svn.resolve", { repository: true })
  async resolve(repository: Repository) {
    const conflicts = repository.conflicts.resourceStates;

    if (!conflicts.length) {
      window.showInformationMessage("No Conflicts");
    }

    for (const conflict of conflicts) {
      const placeHolder = `Select conflict option for ${
        conflict.resourceUri.path
      }`;
      const picks = getConflictPickOptions();

      const choice = await window.showQuickPick(picks, { placeHolder });

      if (!choice) {
        return;
      }

      try {
        const response = await repository.resolve(
          conflict.resourceUri.path,
          choice.label
        );
        window.showInformationMessage(response);
      } catch (error) {
        window.showErrorMessage(error.stderr);
      }
    }
  }

  @command("svn.log", { repository: true })
  async log(repository: Repository) {
    try {
      const logPromise = repository.log();
      window.withProgress(
        { location: ProgressLocation.Window, title: "Fetching logs" },
        () => logPromise
      );
      const result = await logPromise;
      // send the log results to a new tab
      workspace.openTextDocument({ content: result }).then(doc => {
        window.showTextDocument(doc);
      });
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to log");
    }
  }

  private getSCMResource(uri?: Uri): Resource | undefined {
    uri = uri
      ? uri
      : window.activeTextEditor && window.activeTextEditor.document.uri;

    if (!uri) {
      return undefined;
    }

    if (uri.scheme === "svn") {
      const { path } = fromSvnUri(uri);
      uri = Uri.file(path);
    }

    if (uri.scheme === "file") {
      const repository = this.model.getRepository(uri);

      if (!repository) {
        return undefined;
      }

      return repository.getResourceFromFile(uri);
    }
  }

  private getResourceStates(
    resourceStates: SourceControlResourceState[]
  ): Resource[] {
    if (
      resourceStates.length === 0 ||
      !(resourceStates[0].resourceUri instanceof Uri)
    ) {
      const resource = this.getSCMResource();

      if (!resource) {
        return [];
      }

      resourceStates = [resource];
    }

    return resourceStates.filter(s => s instanceof Resource) as Resource[];
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
          console.warn("Could not find Svn repository for ", resource);
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
