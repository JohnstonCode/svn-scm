import { window, StatusBarItem } from "vscode";
import { Repository } from "./repository";

export class SvnStatusBar {
  private statusBar: StatusBarItem;
  private currentBranch: string;

  constructor(private repository: Repository) {}

  get commands() {
    // const title = `$(git-branch) ${this.repository.headLabel}`;

    return [
      {
        command: "svn.refresh",
        tooltip: "TEST",
        title: "TEST",
        arguments: [this]
      }
    ];
  }
}
