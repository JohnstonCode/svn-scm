import * as path from "path";
import { commands, Uri, window } from "vscode";
import { Resource } from "../resource";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { Command } from "./command";

export class OpenHeadFile extends Command {
  constructor() {
    super("svn.openHEADFile");
  }

  public async execute(arg?: Resource | Uri | IncomingChangeNode) {
    let resource: Resource | undefined;

    if (arg instanceof Resource) {
      resource = arg;
    } else if (arg instanceof Uri) {
      resource = this.getSCMResource(arg);
    } else if (arg instanceof IncomingChangeNode) {
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
}
