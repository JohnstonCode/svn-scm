const { Uri, scm, workspace } = require("vscode");
const Resource = require("./resource");
const { throttleAsync } = require("./decorators");

function Repository(repository) {
  this.repository = repository;
  this.root = repository.root;
  this.watcher = workspace.createFileSystemWatcher("**");
  this.sourceControl = scm.createSourceControl(
    "svn",
    "SVN",
    Uri.parse(this.root)
  );
  this.sourceControl.acceptInputCommand = {
    command: "svn.commitWithMessage",
    title: "Commit",
    arguments: [this]
  };
  this.sourceControl.quickDiffProvider = this;
  this.repository.inputBox = this.sourceControl.inputBox;

  this.changes = this.sourceControl.createResourceGroup("changes", "Changes");
  this.notTracked = this.sourceControl.createResourceGroup(
    "unversioned",
    "Not Tracked"
  );

  this.changes.hideWhenEmpty = true;
  this.notTracked.hideWhenEmpty = true;

  this.update();
  this.addEventListeners();
}

Repository.prototype.addEventListeners = function() {
  this.watcher.onDidChange(throttleAsync(this.update, "update", this));
  this.watcher.onDidCreate(throttleAsync(this.update, "update", this));
  this.watcher.onDidDelete(throttleAsync(this.update, "update", this));
};

Repository.prototype.provideOriginalResource = uri => {
  if (uri.scheme !== "file") {
    return;
  }

  return new Uri().with({ scheme: "svn", query: uri.path, path: uri.path });
};

Repository.prototype.update = function() {
  return new Promise((resolve, reject) => {
    let changes = [];
    let notTracked = [];

    this.repository
      .getStatus()
      .then(result => {
        result.forEach(item => {
          switch (item[0]) {
            case "A":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "added")
              );
              break;
            case "D":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "deleted")
              );
              break;
            case "M":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "modified")
              );
              break;
            case "R":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "replaced")
              );
              break;
            case "!":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "missing")
              );
              break;
            case "C":
              changes.push(
                new Resource(this.repository.workspaceRoot, item[1], "conflict")
              );
              break;
            case "?":
              notTracked.push(
                new Resource(
                  this.repository.workspaceRoot,
                  item[1],
                  "unversioned"
                )
              );
              break;
          }
        });

        this.changes.resourceStates = changes;
        this.notTracked.resourceStates = notTracked;

        resolve();
      })
      .catch(() => {
        reject();
      });
  });
};

module.exports = Repository;
