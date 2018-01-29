import {
  Uri,
  workspace,
  SourceControlResourceState,
  SourceControlResourceDecorations,
  Command
} from "vscode";
import * as path from "path";
import { Status, PropStatus } from "./svn";
import { memoize } from "./decorators";

const iconsRootPath = path.join(__dirname, "..", "icons");

function getIconUri(iconName: string, theme: string): Uri {
  return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}

export class Resource implements SourceControlResourceState {
  private static Icons: any = {
    light: {
      Added: getIconUri("status-added", "light"),
      Conflicted: getIconUri("status-conflicted", "light"),
      Deleted: getIconUri("status-deleted", "light"),
      Ignored: getIconUri("status-ignored", "light"),
      Missing: getIconUri("status-missing", "light"),
      Modified: getIconUri("status-modified", "light"),
      Renamed: getIconUri("status-renamed", "light"),
      Replaced: getIconUri("status-replaced", "light"),
      Unversioned: getIconUri("status-unversioned", "light")
    },
    dark: {
      Added: getIconUri("status-added", "dark"),
      Conflicted: getIconUri("status-conflicted", "dark"),
      Deleted: getIconUri("status-deleted", "dark"),
      Ignored: getIconUri("status-ignored", "dark"),
      Missing: getIconUri("status-missing", "dark"),
      Modified: getIconUri("status-modified", "dark"),
      Renamed: getIconUri("status-renamed", "dark"),
      Replaced: getIconUri("status-replaced", "dark"),
      Unversioned: getIconUri("status-unversioned", "dark")
    }
  };

  constructor(
    private _resourceUri: Uri,
    private _type: String,
    private _renameResourceUri?: Uri,
    private _props?: String
  ) {}

  @memoize
  get resourceUri(): Uri {
    return this._resourceUri;
  }

  get type(): String {
    return this._type;
  }
  get renameResourceUri(): Uri | undefined {
    return this._renameResourceUri;
  }
  get props(): String | undefined {
    return this._props;
  }

  get decorations(): SourceControlResourceDecorations {
    const light = { iconPath: this.getIconPath("light") };
    const dark = { iconPath: this.getIconPath("dark") };
    const tooltip = this.tooltip;
    const strikeThrough = this.strikeThrough;
    const faded = this.faded;

    return { strikeThrough, faded, tooltip, light, dark };
  }

  @memoize
  get command(): Command {
    return {
      command: "svn.fileOpen",
      title: "Open",
      arguments: [this.resourceUri]
    };
  }

  private getIconPath(theme: string): Uri | undefined {
    if (this.type === Status.ADDED && this.renameResourceUri) {
      return Resource.Icons[theme]["Renamed"];
    }

    const type = this.type.charAt(0).toUpperCase() + this.type.slice(1);

    if (typeof Resource.Icons[theme][type] !== "undefined") {
      return Resource.Icons[theme][type];
    }

    return void 0;
  }

  private get tooltip(): string {
    if (this.type === Status.ADDED && this.renameResourceUri) {
      return "Renamed from " + this.renameResourceUri.fsPath;
    }

    if (
      this.type === Status.NORMAL &&
      this.props &&
      this.props !== PropStatus.NONE
    ) {
      return (
        "Property " + this.props.charAt(0).toUpperCase() + this.props.slice(1)
      );
    }

    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }

  private get strikeThrough(): boolean {
    if (this.type == Status.DELETED) {
      return true;
    }

    return false;
  }

  private get faded(): boolean {
    return false;
  }
}
