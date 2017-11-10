import { workspace, Uri } from "vscode";
import { Model } from "./model";

export class SvnContentProvider {
  constructor(private model: Model) {
    workspace.registerTextDocumentContentProvider("svn", this);
  }

  async provideTextDocumentContent(uri: Uri): Promise<string> {
    const repository = this.model.getRepository(uri.fsPath);

    if (!repository) {
      return "";
    }

    try {
      return await repository.repository.show(uri.fsPath);
    } catch (error) {
      return "";
    }
  }
}
