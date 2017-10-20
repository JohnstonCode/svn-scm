const { Uri, scm, workspace } = require("vscode");
const Resource = require("./Resource");

function Repository(repository) {
  this.repository = repository;
  this.watcher = workspace.createFileSystemWatcher("**");
  this.sourceControl = scm.createSourceControl(
    "svn",
    "svn",
    Uri.parse(this.repository.root)
  );
  this.sourceControl.acceptInputCommand = {
    command: "svn.commitWithMessage",
    title: "commit",
    arguments: this.sourceControl
  };
  this.sourceControl.quickDiffProvider = this;
  this.inputBox = this.sourceControl.inputBox;

  this.changes = this.sourceControl.createResourceGroup("changes", "Changes");
  this.notTracked = this.sourceControl.createResourceGroup(
    "unversioned",
    "Not Tracked"
  );

  this.changes.hideWhenEmpty = true;
  this.notTracked.hideWhenEmpty = true;

  this.addEventListeners();
  this.update();
}

Repository.prototype.addEventListeners = function() {
  this.watcher.onDidChange(() => {
    this.update();
  });
  this.watcher.onDidCreate(() => {
    this.update();
  });
  this.watcher.onDidDelete(() => {
    this.update();
  });
};

Repository.prototype.provideOriginalResource = uri => {
  if (uri.scheme !== "file") {
    return;
  }

  return new Uri().with({ scheme: "svn", query: uri.path, path: uri.path });
};

Repository.prototype.update = function() {
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
            changes.push(new Resource(this.repository.root, item.$.path, item["wc-status"].$.item));
            break;
          case "unversioned":
            notTracked.push(
              new Resource(this.repository.root, item.$.path, item["wc-status"].$.item)
            );
            break;
        }
      });

      this.changes.resourceStates = changes;
      this.notTracked.resourceStates = notTracked;
    })
    .catch(error => {
      console.log(error);
    });
};

module.exports = Repository;
