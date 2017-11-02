const { Uri, scm, workspace } = require("vscode");
const Resource = require("./Resource");
const { throttleAsync } = require("./decorators");

function Repository(repository) {
  this.repository = repository;
  this.root = repository.root;
  this.watcher = workspace.createFileSystemWatcher(this.root + "/**/*");
  this.sourceControl = scm.createSourceControl(
    "svn",
    "svn",
    Uri.parse(this.root)
  );
  this.sourceControl.acceptInputCommand = {
    command: "svn.commitWithMessage",
    title: "commit",
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

    this.changes.resourceStates = [];
    this.notTracked.resourceStates = [];

    this.repository
      .getStatus()
      .then(result => {
        let changes = [];
        let notTracked = [];

        result.forEach(item => {
          switch (item["wc-status"].$.item) {
            case "modified":
            case "deleted":
            case "conflicted":
            case "replaced":
            case "missing":
            case "added":
              changes.push(
                new Resource(
                  this.repository.root,
                  item.$.path,
                  item["wc-status"].$.item
                )
              );
              break;
            case "unversioned":
              notTracked.push(
                new Resource(
                  this.repository.root,
                  item.$.path,
                  item["wc-status"].$.item
                )
              );
              break;
          }
        });

        this.changes.resourceStates = changes;
        this.notTracked.resourceStates = notTracked;

        resolve();
      })
      .catch(error => {
        reject();
      });
  });
};

module.exports = Repository;
