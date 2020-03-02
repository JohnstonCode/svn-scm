import * as os from "os";
import * as path from "path";
import { commands, ProgressLocation, Uri, window, workspace } from "vscode";
import { IAuth, ICpOptions } from "../common/types";
import { getBranchName } from "../helpers/branch";
import { configuration } from "../helpers/configuration";
import { SourceControlManager } from "../source_control_manager";
import { svnErrorCodes } from "../svn";
import { Command } from "./command";
import * as nls from "vscode-nls";

const localize = nls.loadMessageBundle();

export class Checkout extends Command {
  constructor() {
    super("svn.checkout");
  }

  public async execute(url?: string) {
    if (!url) {
      url = await window.showInputBox({
        prompt: localize("checkout.repo_url", "Repository URL"),
        ignoreFocusOut: true
      });
    }

    if (!url) {
      return;
    }

    let defaultCheckoutDirectory =
      configuration.get<string>("defaultCheckoutDirectory") || os.homedir();
    defaultCheckoutDirectory = defaultCheckoutDirectory.replace(
      /^~/,
      os.homedir()
    );

    const uris = await window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: Uri.file(defaultCheckoutDirectory),
      openLabel: localize(
        "checkout.select_repo_location",
        "Select Repository Location"
      )
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const uri = uris[0];
    const parentPath = uri.fsPath;

    let folderName: string | undefined;

    // Get folder name from branch
    const branch = getBranchName(url);
    if (branch) {
      const baseUrl = url.replace(/\//g, "/").replace(branch.path, "");
      folderName = path.basename(baseUrl);
    }

    folderName = await window.showInputBox({
      prompt: localize("checkout.folder_name", "Folder name"),
      value: folderName,
      ignoreFocusOut: true
    });

    if (!folderName) {
      return;
    }

    const repositoryPath = path.join(parentPath, folderName);

    // Use Notification location if supported
    let location = ProgressLocation.Window;
    if ((ProgressLocation as any).Notification) {
      location = (ProgressLocation as any).Notification;
    }

    const progressOptions = {
      location,
      title: localize(
        "checkout.checkout_repo",
        "Checkout svn repository '{0}'...",
        url
      ),
      cancellable: true
    };

    let attempt = 0;

    const opt: ICpOptions = {};

    while (true) {
      attempt++;
      try {
        await window.withProgress(progressOptions, async () => {
          const sourceControlManager = (await commands.executeCommand(
            "svn.getSourceControlManager",
            ""
          )) as SourceControlManager;
          const args = ["checkout", url, repositoryPath];
          await sourceControlManager.svn.exec(parentPath, args, opt);
        });
        break;
      } catch (err) {
        if (
          err.svnErrorCode === svnErrorCodes.AuthorizationFailed &&
          attempt <= 3
        ) {
          const auth = (await commands.executeCommand(
            "svn.promptAuth",
            opt.username
          )) as IAuth;
          if (auth) {
            opt.username = auth.username;
            opt.password = auth.password;
            continue;
          }
        }
        throw err;
      }
    }

    const choices = [];
    let message = localize(
      "checkout.open_checked_out",
      "Would you like to open the checked out repository?"
    );
    const open = localize("checkout.open_repo", "Open Repository");
    choices.push(open);

    const addToWorkspace = localize(
      "checkout.add_to_workspace",
      "Add to Workspace"
    );
    if (
      workspace.workspaceFolders &&
      (workspace as any).updateWorkspaceFolders // For VSCode >= 1.21
    ) {
      message = localize(
        "checkout.open_or_checkout",
        "Would you like to open the checked out repository, or add it to the current workspace?"
      );
      choices.push(addToWorkspace);
    }

    const result = await window.showInformationMessage(message, ...choices);

    const openFolder = result === open;

    if (openFolder) {
      commands.executeCommand("vscode.openFolder", Uri.file(repositoryPath));
    } else if (result === addToWorkspace) {
      // For VSCode >= 1.21
      (workspace as any).updateWorkspaceFolders(
        workspace.workspaceFolders!.length,
        0,
        {
          uri: Uri.file(repositoryPath)
        }
      );
    }
  }
}
