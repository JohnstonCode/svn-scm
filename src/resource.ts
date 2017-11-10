import { Uri, workspace } from "vscode";
import * as path from "path";

export class Resource {
  constructor(
    private rootPath: string,
    public relativePath: string,
    public type: string
  ) {}

  get resourceUri() {
    return this.getResourceUri(this.relativePath);
  }

  get decorations() {
    return this.getDecorations();
  }

  get command() {
    return {
      command: "svn.fileOpen",
      title: "Open",
      arguments: [this.getResourceUri(this.relativePath)]
    };
  }

  private getResourceUri(relativePath: string) {
    const absolutePath = path.join(this.rootPath, relativePath);
    return Uri.file(absolutePath);
  }

  private getDecorations() {
    return {
      dark: { iconPath: this.getIconPath("dark") },
      light: { iconPath: this.getIconPath("light") },
      tooltip: this.getToolTip(),
      strikeThrough: this.getStrikeThrough(),
      faded: this.getFaded()
    };
  }

  private getIconPath(theme: string) {
    const Icons: any = {
      light: {
        Modified: this.getIconUri("modified", "light"),
        Added: this.getIconUri("added", "light"),
        Deleted: this.getIconUri("deleted", "light"),
        Conflicted: this.getIconUri("conflicted", "light"),
        Replaced: this.getIconUri("replaced", "light"),
        Unversioned: this.getIconUri("unversioned", "light"),
        Missing: this.getIconUri("missing", "light")
      },
      dark: {
        Modified: this.getIconUri("modified", "dark"),
        Added: this.getIconUri("added", "dark"),
        Deleted: this.getIconUri("deleted", "dark"),
        Conflicted: this.getIconUri("conflicted", "dark"),
        Replaced: this.getIconUri("replaced", "dark"),
        Unversioned: this.getIconUri("unversioned", "dark"),
        Missing: this.getIconUri("missing", "dark")
      }
    };

    switch (this.type) {
      case "added":
        return Icons[theme].Added;
      case "conflicted":
        return Icons[theme].Conflicted;
      case "deleted":
        return Icons[theme].Deleted;
      case "modified":
        return Icons[theme].Modified;
      case "replaced":
        return Icons[theme].Replaced;
      case "missing":
        return Icons[theme].Missing;
      case "unversioned":
        return Icons[theme].Unversioned;
      default:
        return 0;
    }
  }

  private getToolTip() {
    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }

  private getStrikeThrough() {
    if (this.type == "deleted") {
      return true;
    }

    return false;
  }

  private getFaded() {
    return false;
  }

  private getIconUri(iconName: string, theme: string) {
    const iconsRootPath = path.join(__dirname, "..", "icons");
    return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
  }
}
