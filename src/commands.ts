import * as fs from "fs";
import * as path from "path";
import {
  commands,
  Disposable,
  LineChange,
  Position,
  Range,
  SourceControlResourceState,
  TextDocumentShowOptions,
  TextEditor,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit
} from "vscode";
import {
  getPatchChangelist,
  inputCommitChangelist,
  inputSwitchChangelist
} from "./changelistItems";
import {
  ICommand,
  ICommandOptions,
  Status,
  SvnUriAction
} from "./common/types";
import { getConflictPickOptions } from "./conflictItems";
import { selectBranch } from "./helpers/branch";
import { configuration } from "./helpers/configuration";
import { inputIgnoreList } from "./ignoreitems";
import { applyLineChanges } from "./lineChanges";
import { inputCommitMessage } from "./messages";
import { Model } from "./model";
import { Repository } from "./repository";
import { Resource } from "./resource";
import IncommingChangeNode from "./treeView/nodes/incomingChangeNode";
import IncomingChangeNode from "./treeView/nodes/incomingChangeNode";
import { fromSvnUri, toSvnUri } from "./uri";
import {
  fixPathSeparator,
  hasSupportToRegisterDiffCommand,
  IDisposable
} from "./util";

const svnCommands: ICommand[] = [];

function command(
  commandId: string,
  options: ICommandOptions = {}
): (target: any, key: string, descriptor: any) => void {
  return (target: any, key: string, descriptor: any) => {
    if (!(typeof descriptor.value === "function")) {
      throw new Error("not supported");
    }

    svnCommands.push({ commandId, key, method: descriptor.value, options });
  };
}

export class SvnCommands implements IDisposable {
  private disposables: Disposable[];

  constructor(private model: Model) {
    this.disposables = svnCommands.map(({ commandId, method, options }) => {
      const command = this.createCommand(method, options);
      if (options.diff && hasSupportToRegisterDiffCommand()) {
        return commands.registerDiffInformationCommand(commandId, command);
      } else {
        return commands.registerCommand(commandId, command);
      }
    });
  }

  private createCommand(
    method: Function,
    options: ICommandOptions
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

  @command("svn._getModel")
  public getModel() {
    return this.model;
  }

  @command("svn.fileOpen")
  public async fileOpen(resourceUri: Uri) {
    await commands.executeCommand("vscode.open", resourceUri);
  }

  @command("svn.promptAuth", { repository: true })
  public async promptAuth(repository: Repository): Promise<boolean> {
    const username = await window.showInputBox({
      placeHolder: "Svn repository username",
      prompt: "Please enter your username",
      value: repository.username
    });

    if (username === undefined) {
      return false;
    }

    const password = await window.showInputBox({
      placeHolder: "Svn repository password",
      prompt: "Please enter your password",
      password: true
    });

    if (username === undefined) {
      return false;
    }

    repository.username = username;
    repository.password = password;

    return true;
  }

  @command("svn.commitWithMessage", { repository: true })
  public async commitWithMessage(repository: Repository) {
    const choice = await inputCommitChangelist(repository);
    if (!choice) {
      return;
    }

    const message = await inputCommitMessage(repository.inputBox.value, false);
    if (message === undefined) {
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

        let dir = path.dirname(state.resourceUri.fsPath);
        let parent = repository.getResourceFromFile(dir);

        while (parent) {
          if (parent.type === Status.ADDED) {
            filePaths.push(dir);
          }
          dir = path.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }
    });

    try {
      const result = await repository.commitFiles(message, filePaths);
      window.showInformationMessage(result);
      repository.inputBox.value = "";
    } catch (error) {
      console.error(error);
      window.showErrorMessage(error.stderrFormated);
    }
  }

  @command("svn.add")
  public async addFile(
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

  @command("svn.changelist")
  public async changelist(
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

      let canRemove = false;

      repository.changelists.forEach((group, changelist) => {
        if (
          group.resourceStates.some(state => {
            return resources.some(resource => {
              return resource.path === state.resourceUri.path;
            });
          })
        ) {
          console.log("canRemove true");
          canRemove = true;
          return false;
        }
      });

      const changelistName = await inputSwitchChangelist(repository, canRemove);

      if (!changelistName && changelistName !== false) {
        return;
      }

      const paths = resources.map(resource => resource.fsPath);

      if (changelistName === false) {
        try {
          await repository.removeChangelist(paths);
        } catch (error) {
          console.log(error);
          window.showErrorMessage(
            `Unable to remove file "${paths.join(",")}" from changelist`
          );
        }
      } else {
        try {
          await repository.addChangelist(paths, changelistName);
        } catch (error) {
          console.log(error);
          window.showErrorMessage(
            `Unable to add file "${paths.join(
              ","
            )}" to changelist "${changelistName}"`
          );
        }
      }
    });
  }

  @command("svn.commit")
  public async commit(
    ...resources: SourceControlResourceState[]
  ): Promise<void> {
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

      for (const resource of resources) {
        let dir = path.dirname(resource.fsPath);
        let parent = repository.getResourceFromFile(dir);

        while (parent) {
          if (parent.type === Status.ADDED) {
            paths.push(dir);
          }
          dir = path.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }

      try {
        const message = await inputCommitMessage(repository.inputBox.value);

        if (message === undefined) {
          return;
        }

        repository.inputBox.value = message;

        const result = await repository.commitFiles(message, paths);
        window.showInformationMessage(result);
        repository.inputBox.value = "";
      } catch (error) {
        console.error(error);
        window.showErrorMessage(error.stderrFormated);
      }
    });
  }

  @command("svn.refresh", { repository: true })
  public async refresh(repository: Repository) {
    await repository.status();
  }

  @command("svn.openResourceBase")
  public async openResourceBase(resource: Resource): Promise<void> {
    await this._openResource(resource, "BASE", undefined, true, false);
  }

  @command("svn.openResourceHead")
  public async openResourceHead(resource: Resource): Promise<void> {
    await this._openResource(resource, "HEAD", undefined, true, false);
  }

  @command("svn.openFile")
  public async openFile(
    arg?: Resource | Uri | IncommingChangeNode,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const preserveFocus = arg instanceof Resource;

    let uris: Uri[] | undefined;

    if (arg instanceof Uri) {
      if (arg.scheme === "svn") {
        uris = [Uri.file(fromSvnUri(arg).fsPath)];
      } else if (arg.scheme === "file") {
        uris = [arg];
      }
    } else if (arg instanceof IncommingChangeNode) {
      const resource = new Resource(
        arg.uri,
        arg.type,
        undefined,
        arg.props,
        true
      );

      uris = [resource.resourceUri];
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
      if (fs.existsSync(uri.fsPath) && fs.statSync(uri.fsPath).isDirectory()) {
        continue;
      }

      const opts: TextDocumentShowOptions = {
        preserveFocus,
        preview,
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
  public async openHEADFile(
    arg?: Resource | Uri | IncommingChangeNode
  ): Promise<void> {
    let resource: Resource | undefined;

    if (arg instanceof Resource) {
      resource = arg;
    } else if (arg instanceof Uri) {
      resource = this.getSCMResource(arg);
    } else if (arg instanceof IncommingChangeNode) {
      resource = new Resource(arg.uri, arg.type, undefined, arg.props, true);
    } else {
      resource = this.getSCMResource();
    }

    if (!resource) {
      return;
    }

    const HEAD = this.getLeftResource(resource, "HEAD");

    const basename = path.basename(resource.resourceUri.fsPath);
    if (!HEAD) {
      window.showWarningMessage(
        `"HEAD version of '${basename}' is not available."`
      );
      return;
    }

    const basedir = path.dirname(resource.resourceUri.fsPath);

    const uri = HEAD.with({
      path: path.join(basedir, `(HEAD) ${basename}`) // change document title
    });

    return commands.executeCommand<void>("vscode.open", uri, {
      preview: true
    });
  }

  @command("svn.openChangeBase")
  public async openChangeBase(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    return this.openChange(arg, "BASE", resourceStates);
  }

  @command("svn.openChangeHead")
  public async openChangeHead(
    arg?: Resource | Uri,
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    return this.openChange(arg, "HEAD", resourceStates);
  }

  public async openChange(
    arg?: Resource | Uri,
    against?: string,
    resourceStates?: SourceControlResourceState[]
  ): Promise<void> {
    const preserveFocus = arg instanceof Resource;
    const preserveSelection = arg instanceof Uri || !arg;
    let resources: Resource[] | undefined;

    if (arg instanceof Uri) {
      const resource = this.getSCMResource(arg);
      if (resource !== undefined) {
        resources = [resource];
      }
    } else {
      let resource: Resource | undefined;

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
    let left = this.getLeftResource(resource, against);
    let right = this.getRightResource(resource, against);
    const title = this.getTitle(resource, against);

    if (resource.remote && left) {
      [left, right] = [right, left];
    }

    if (!right) {
      // TODO
      console.error("oh no");
      return;
    }

    if (
      fs.existsSync(right.fsPath) &&
      fs.statSync(right.fsPath).isDirectory()
    ) {
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
      return commands.executeCommand<void>("vscode.open", right, opts);
    }

    return commands.executeCommand<void>(
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
    if (resource.remote) {
      if (resource.type !== Status.DELETED) {
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
      }
      return;
    }

    if (resource.type === Status.ADDED && resource.renameResourceUri) {
      return toSvnUri(resource.renameResourceUri, SvnUriAction.SHOW, {
        ref: against
      });
    }

    // Show file if has conflicts marks
    if (
      resource.type === Status.CONFLICTED &&
      fs.existsSync(resource.resourceUri.fsPath)
    ) {
      const text = fs.readFileSync(resource.resourceUri.fsPath, {
        encoding: "utf8"
      });

      // Check for lines begin with "<<<<<<", "=======", ">>>>>>>"
      if (/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
        return undefined;
      }
    }

    switch (resource.type) {
      case Status.CONFLICTED:
      case Status.MODIFIED:
      case Status.REPLACED:
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
    }
  }

  private getRightResource(
    resource: Resource,
    against: string = ""
  ): Uri | undefined {
    if (resource.remote) {
      if (resource.type !== Status.ADDED) {
        return resource.resourceUri;
      }
      return;
    }
    switch (resource.type) {
      case Status.ADDED:
      case Status.CONFLICTED:
      case Status.IGNORED:
      case Status.MODIFIED:
      case Status.UNVERSIONED:
      case Status.REPLACED:
        return resource.resourceUri;
      case Status.DELETED:
      case Status.MISSING:
        return toSvnUri(resource.resourceUri, SvnUriAction.SHOW, {
          ref: against
        });
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
  public async switchBranch(repository: Repository) {
    const branch = await selectBranch(repository, true);

    if (!branch) {
      return;
    }

    try {
      if (branch.isNew) {
        await repository.branch(branch.path);
      } else {
        await repository.switchBranch(branch.path);
      }
    } catch (error) {
      console.log(error);
      if (branch.isNew) {
        window.showErrorMessage("Unable to create new branch");
      } else {
        window.showErrorMessage("Unable to switch branch");
      }
    }
  }

  @command("svn.revert")
  public async revert(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const yes = "Yes I'm sure";
    const answer = await window.showWarningMessage(
      "Are you sure? This will wipe all local changes.",
      { modal: true },
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
  public async update(repository: Repository) {
    try {
      const ignoreExternals = configuration.get<boolean>(
        "update.ignoreExternals",
        false
      );
      const showUpdateMessage = configuration.get<boolean>(
        "showUpdateMessage",
        true
      );

      const result = await repository.updateRevision(ignoreExternals);

      if (showUpdateMessage) {
        window.showInformationMessage(result);
      }
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to update");
    }
  }

  @command("svn.treeview.pullIncomingChange")
  public async pullIncomingChange(
    incomingChange: IncomingChangeNode
  ): Promise<void> {
    try {
      const showUpdateMessage = configuration.get<boolean>(
        "showUpdateMessage",
        true
      );

      const result = await incomingChange.repository.pullIncomingChange(
        incomingChange.uri.fsPath
      );

      if (showUpdateMessage) {
        window.showInformationMessage(result);
      }
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to update");
    }
  }

  private async showDiffPath(repository: Repository, content: string) {
    try {
      const tempFile = path.join(repository.root, ".svn", "tmp", "svn.patch");

      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      const uri = Uri.file(tempFile).with({
        scheme: "untitled"
      });

      const document = await workspace.openTextDocument(uri);
      const textEditor = await window.showTextDocument(document);

      await textEditor.edit(e => {
        // if is opened, clear content
        e.delete(
          new Range(
            new Position(0, 0),
            new Position(Number.MAX_SAFE_INTEGER, 0)
          )
        );
        e.insert(new Position(0, 0), content);
      });
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to patch");
    }
  }

  @command("svn.patchAll", { repository: true })
  public async patchAll(repository: Repository): Promise<void> {
    const content = await repository.patch([]);
    await this.showDiffPath(repository, content);
  }

  @command("svn.patch")
  public async patch(
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

      const files = resources.map(resource => resource.fsPath);
      const content = await repository.patch(files);
      await this.showDiffPath(repository, content);
    });
  }

  @command("svn.patchChangeList", { repository: true })
  public async patchChangeList(repository: Repository): Promise<void> {
    const changelistName = await getPatchChangelist(repository);

    if (!changelistName) {
      return;
    }

    const content = await repository.patchChangelist(changelistName);
    await this.showDiffPath(repository, content);
  }

  @command("svn.remove")
  public async remove(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    let keepLocal: boolean;
    const answer = await window.showWarningMessage(
      "Would you like to keep a local copy of the files?.",
      { modal: true },
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

  @command("svn.resolveAll", { repository: true })
  public async resolveAll(repository: Repository) {
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
          [conflict.resourceUri.path],
          choice.label
        );
        window.showInformationMessage(response);
      } catch (error) {
        window.showErrorMessage(error.stderr);
      }
    }
  }

  @command("svn.resolve")
  public async resolve(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }
    const picks = getConflictPickOptions();

    const choice = await window.showQuickPick(picks, {
      placeHolder: "Select conflict option"
    });

    if (!choice) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const files = resources.map(resource => resource.fsPath);

      await repository.resolve(files, choice.label);
    });
  }

  @command("svn.resolved")
  public async resolved(uri: Uri): Promise<void> {
    if (!uri) {
      return;
    }

    const autoResolve = configuration.get<boolean>("conflict.autoResolve");

    if (!autoResolve) {
      const basename = path.basename(uri.fsPath);
      const pick = await window.showWarningMessage(
        `Mark the conflict as resolved for "${basename}"?`,
        { modal: true },
        "Yes",
        "No"
      );

      if (pick !== "Yes") {
        return;
      }
    }

    const uris = [uri];

    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      const files = resources.map(resource => resource.fsPath);

      await repository.resolve(files, "working");
    });
  }

  @command("svn.log", { repository: true })
  public async log(repository: Repository) {
    try {
      const resource = toSvnUri(
        Uri.file(repository.workspaceRoot),
        SvnUriAction.LOG
      );
      const uri = resource.with({
        path: path.join(resource.path, "svn.log") // change document title
      });

      await commands.executeCommand<void>("vscode.open", uri);
    } catch (error) {
      console.error(error);
      window.showErrorMessage("Unable to log");
    }
  }

  private async _revertChanges(
    textEditor: TextEditor,
    changes: LineChange[]
  ): Promise<void> {
    const modifiedDocument = textEditor.document;
    const modifiedUri = modifiedDocument.uri;

    if (modifiedUri.scheme !== "file") {
      return;
    }

    const originalUri = toSvnUri(modifiedUri, SvnUriAction.SHOW, {
      ref: "BASE"
    });
    const originalDocument = await workspace.openTextDocument(originalUri);
    const basename = path.basename(modifiedUri.fsPath);
    const message = `Are you sure you want to revert the selected changes in ${basename}?`;
    const yes = "Revert Changes";
    const pick = await window.showWarningMessage(message, { modal: true }, yes);

    if (pick !== yes) {
      return;
    }

    const result = applyLineChanges(
      originalDocument,
      modifiedDocument,
      changes
    );
    const edit = new WorkspaceEdit();
    edit.replace(
      modifiedUri,
      new Range(
        new Position(0, 0),
        modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end
      ),
      result
    );
    workspace.applyEdit(edit);
    await modifiedDocument.save();
  }

  @command("svn.revertChange")
  public async revertChange(
    uri: Uri,
    changes: LineChange[],
    index: number
  ): Promise<void> {
    const textEditor = window.visibleTextEditors.filter(
      e => e.document.uri.toString() === uri.toString()
    )[0];

    if (!textEditor) {
      return;
    }

    await this._revertChanges(textEditor, [
      ...changes.slice(0, index),
      ...changes.slice(index + 1)
    ]);
  }

  @command("svn.revertSelectedRanges", { diff: true })
  public async revertSelectedRanges(changes: LineChange[]): Promise<void> {
    const textEditor = window.activeTextEditor;

    if (!textEditor) {
      return;
    }

    const modifiedDocument = textEditor.document;
    const selections = textEditor.selections;
    const selectedChanges = changes.filter(change => {
      const modifiedRange =
        change.modifiedEndLineNumber === 0
          ? new Range(
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber - 1
              ).range.end,
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber
              ).range.start
            )
          : new Range(
              modifiedDocument.lineAt(
                change.modifiedStartLineNumber - 1
              ).range.start,
              modifiedDocument.lineAt(
                change.modifiedEndLineNumber - 1
              ).range.end
            );

      return selections.every(
        selection => !selection.intersection(modifiedRange)
      );
    });

    if (selectedChanges.length === changes.length) {
      return;
    }

    await this._revertChanges(textEditor, selectedChanges);
  }

  @command("svn.close", { repository: true })
  public async close(repository: Repository): Promise<void> {
    this.model.close(repository);
  }

  @command("svn.cleanup", { repository: true })
  public async cleanup(repository: Repository) {
    await repository.cleanup();
  }

  @command("svn.finishCheckout", { repository: true })
  public async finishCheckout(repository: Repository) {
    await repository.finishCheckout();
  }

  @command("svn.addToIgnoreSCM")
  public async addFileToIgnore(
    ...resourceStates: SourceControlResourceState[]
  ): Promise<void> {
    const selection = this.getResourceStates(resourceStates);

    if (selection.length === 0) {
      return;
    }

    const uris = selection.map(resource => resource.resourceUri);

    return this.addToIgnore(uris);
  }

  @command("svn.addToIgnoreExplorer")
  public async addToIgnoreExplorer(
    mainUri?: Uri,
    allUris?: Uri[]
  ): Promise<void> {
    if (!allUris || allUris.length === 0) {
      return;
    }

    return this.addToIgnore(allUris);
  }

  public async addToIgnore(uris: Uri[]): Promise<void> {
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }

      try {
        const ignored = await inputIgnoreList(repository, resources);

        if (ignored) {
          window.showInformationMessage(`File(s) is now being ignored`);
        }
      } catch (error) {
        console.log(error);
        window.showErrorMessage("Unable to set property ignore");
      }
    });
  }

  @command("svn.renameExplorer", { repository: true })
  public async renameExplorer(
    repository: Repository,
    mainUri?: Uri,
    allUris?: Uri[]
  ) {
    if (!mainUri) {
      return;
    }

    const oldName = mainUri.fsPath;

    return this.rename(repository, oldName);
  }

  @command("svn.rename", { repository: true })
  public async rename(
    repository: Repository,
    oldFile: string,
    newName?: string
  ) {
    oldFile = fixPathSeparator(oldFile);

    if (!newName) {
      const root = fixPathSeparator(repository.workspaceRoot);
      const oldName = path.relative(root, oldFile);
      newName = await window.showInputBox({
        value: path.basename(oldFile),
        prompt: `New name name for ${oldName}`
      });
    }
    if (!newName) {
      return;
    }

    const basepath = path.dirname(oldFile);
    newName = path.join(basepath, newName);

    await repository.rename(oldFile, newName);
  }

  @command("svn.upgrade")
  public async upgrade(folderPath: string): Promise<void> {
    if (!folderPath) {
      return;
    }

    if (configuration.get("ignoreWorkingCopyIsTooOld", false)) {
      return;
    }

    folderPath = fixPathSeparator(folderPath);

    const yes = "Yes";
    const no = "No";
    const neverShowAgain = "Don't Show Again";
    const choice = await window.showWarningMessage(
      "You want upgrade the working copy (svn upgrade)?",
      yes,
      no,
      neverShowAgain
    );

    if (choice === yes) {
      const upgraded = await this.model.upgradeWorkingCopy(folderPath);

      if (upgraded) {
        window.showInformationMessage(`Working copy "${folderPath}" upgraded`);
        this.model.tryOpenRepository(folderPath);
      } else {
        window.showErrorMessage(
          `Error on upgrading working copy "${folderPath}". See log for more detail`
        );
      }
    } else if (choice === neverShowAgain) {
      return configuration.update("ignoreWorkingCopyIsTooOld", true);
    }

    return;
  }

  private getSCMResource(uri?: Uri): Resource | undefined {
    uri = uri
      ? uri
      : window.activeTextEditor && window.activeTextEditor.document.uri;

    if (!uri) {
      return undefined;
    }

    if (uri.scheme === "svn") {
      const { fsPath } = fromSvnUri(uri);
      uri = Uri.file(fsPath);
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
      [] as Array<{ repository: Repository; resources: Uri[] }>
    );

    const promises = groups.map(({ repository, resources }) =>
      fn(repository as Repository, isSingleResource ? resources[0] : resources)
    );

    return Promise.all(promises);
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
