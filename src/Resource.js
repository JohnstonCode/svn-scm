const { Uri, workspace } = require("vscode");
const path = require("path");

function Resource(relativePath, type) {
  this.type = type;

  return {
    resourceUri: this.getResourceUri(relativePath),
    decorations: this.getDecorations(),
    command: this.getCommand(relativePath)
  };
}

Resource.prototype.getCommand = function(relativePath) {
  return {
    command: "svn.fileOpen",
    title: "Open",
    arguments: [this.getResourceUri(relativePath)]
  };
};

Resource.prototype.getResourceUri = function(relativePath) {
  const absolutePath = path.join(workspace.rootPath, relativePath);
  return Uri.file(absolutePath);
};

Resource.prototype.getDecorations = function() {
  return {
    dark: { iconPath: this.getIconPath("dark") },
    light: { iconPath: this.getIconPath("light") },
    tooltip: this.getToolTip(),
    strikeThrough: this.getStrikeThrough(),
    faded: this.getFaded()
  };
};

Resource.prototype.getIconPath = function(theme) {
  const Icons = {
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
};

Resource.prototype.getToolTip = function() {
  return this.type;
};

Resource.prototype.getStrikeThrough = function() {
  if (this.type == "deleted") {
    return true;
  }

  return false;
};

Resource.prototype.getFaded = function() {
  return false;
};

Resource.prototype.getIconUri = function(iconName, theme) {
  const iconsRootPath = path.join(__dirname, "..", "icons");
  return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
};

module.exports = Resource;
