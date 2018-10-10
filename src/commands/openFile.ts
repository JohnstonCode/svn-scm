import * as fs from "fs";
import {
  SourceControlResourceState,
  TextDocumentShowOptions,
  Uri,
  ViewColumn,
  window,
  workspace
} from "vscode";
import { Resource } from "../resource";
import IncomingChangeNode from "../treeView/nodes/incomingChangeNode";
import { fromSvnUri } from "../uri";
import { Command } from "./command";

export class OpenFile extends Command {
  constructor() {
    super("svn.openFile");
  }

  public async execute(
    arg?: Resource | Uri | IncomingChangeNode,
    ...resourceStates: SourceControlResourceState[]
  ) {
    const preserveFocus = arg instanceof Resource;

    let uris: Uri[] | undefined;

    if (arg instanceof Uri) {
      if (arg.scheme === "svn") {
        uris = [Uri.file(fromSvnUri(arg).fsPath)];
      } else if (arg.scheme === "file") {
        uris = [arg];
      }
    } else if (arg instanceof IncomingChangeNode) {
      const resource = new Resource(
        arg.uri,
        arg.type,
        undefined,
        arg.props,
        true
      );

      uris = [resource.resourceUri];
    } else {
      const resource = arg;

      if (!(resource instanceof Resource)) {
        // can happen when called from a keybinding
        // TODO(@JohnstonCode) fix this
        // resource = this.getSCMResource();
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
}
