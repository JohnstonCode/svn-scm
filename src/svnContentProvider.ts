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

    let revision = undefined;

    const config = workspace.getConfiguration("svn");
    const diffWithHead = config.get<boolean>("diff.withHead");

    if (diffWithHead) {
      revision = "HEAD";
    }

    try {
      return await repository.show(uri.fsPath, revision);
    } catch (error) {
      return "";
    }
  }
}
