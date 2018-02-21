import {
  Uri,
  workspace,
  SourceControlResourceState,
  SourceControlResourceDecorations,
  Command,
  SourceControlResourceGroup,
  DecorationData,
  ThemeColor
} from "vscode";
import * as path from "path";
import { Status, PropStatus } from "./svn";
import { memoize } from "./decorators";
import { hasSupportToDecorationProvider } from "./util";
import { configuration } from "./helpers/configuration";

const iconsRootPath = path.join(__dirname, "..", "icons");

function getIconUri(iconName: string, theme: string): Uri {
  return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}

export interface SvnResourceGroup extends SourceControlResourceGroup {
  resourceStates: Resource[];
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

  @memoize
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
    // TODO@joh, still requires restart/redraw in the SCM viewlet
    const decorations =
      hasSupportToDecorationProvider() &&
      configuration.get<boolean>("decorations.enabled");
    const light = !decorations
      ? { iconPath: this.getIconPath("light") }
      : undefined;
    const dark = !decorations
      ? { iconPath: this.getIconPath("dark") }
      : undefined;
    const tooltip = this.tooltip;
    const strikeThrough = this.strikeThrough;
    const faded = this.faded;
    const letter = this.letter;
    const color = this.color;

    return {
      strikeThrough,
      faded,
      tooltip,
      light,
      dark,
      letter,
      color,
      source: "svn.resource"
    };
  }

  @memoize
  get command(): Command {
    const diffHead = configuration.get<boolean>("diff.withHead", true);

    if (diffHead) {
      return {
        command: "svn.openResourceHead",
        title: "Open Diff With Head",
        arguments: [this]
      };
    }

    return {
      command: "svn.openResourceBase",
      title: "Open Diff With Base",
      arguments: [this]
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
    if (this.type === Status.DELETED) {
      return true;
    }

    return false;
  }

  private get faded(): boolean {
    return false;
  }

  get letter(): string | undefined {
    switch (this.type) {
      case Status.ADDED:
        if (this.renameResourceUri) {
          return "R";
        }
        return "A";
      case Status.CONFLICTED:
        return "C";
      case Status.DELETED:
        return "D";
      case Status.EXTERNAL:
        return "E";
      case Status.IGNORED:
        return "I";
      case Status.MODIFIED:
        return "M";
      case Status.REPLACED:
        return "R";
      case Status.UNVERSIONED:
        return "U";
      default:
        return undefined;
    }
  }

  get color(): ThemeColor | undefined {
    switch (this.type) {
      case Status.MODIFIED:
      case Status.REPLACED:
        return new ThemeColor("gitDecoration.modifiedResourceForeground");
      case Status.DELETED:
        return new ThemeColor("gitDecoration.deletedResourceForeground");
      case Status.ADDED:
      case Status.UNVERSIONED:
        return new ThemeColor("gitDecoration.untrackedResourceForeground");
      case Status.EXTERNAL:
      case Status.IGNORED:
        return new ThemeColor("gitDecoration.ignoredResourceForeground");
      case Status.CONFLICTED:
        return new ThemeColor("gitDecoration.conflictingResourceForeground");
      default:
        return undefined;
    }
  }

  get priority(): number {
    switch (this.type) {
      case Status.MODIFIED:
        return 2;
      case Status.IGNORED:
        return 3;
      case Status.DELETED:
      case Status.ADDED:
      case Status.REPLACED:
        return 4;
      default:
        return 1;
    }
  }

  get resourceDecoration(): DecorationData | undefined {
    const title = this.tooltip;
    const abbreviation = this.letter;
    const color = this.color;
    const priority = this.priority;
    return {
      bubble: true,
      source: "svn.resource",
      title,
      abbreviation,
      color,
      priority
    };
  }
}
