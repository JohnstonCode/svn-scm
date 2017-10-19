var { Uri, scm, workspace } = require("vscode");
const Svn = require("./svn");
const Resource = require("./Resource");

function svnSCM() {
  this.svn = new Svn();
  this.watcher = workspace.createFileSystemWatcher("**");
  this.sourceControl = scm.createSourceControl("svn", "svn");
  this.sourceControl.acceptInputCommand = {
    command: "svn.commitWithMessage",
    title: "commit"
  };
  this.sourceControl.quickDiffProvider = this;

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

svnSCM.prototype.addEventListeners = function() {
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

svnSCM.prototype.provideOriginalResource = uri => {
  if (uri.scheme !== "file") {
    return;
  }

  return new Uri().with({ scheme: "svn", query: uri.path, path: uri.path });
};

svnSCM.prototype.update = function() {
  let changes = [];
  let notTracked = [];

  this.changes.resourceStates = [];
  this.notTracked.resourceStates = [];

  this.svn
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
            changes.push(new Resource(item.$.path, item["wc-status"].$.item));
            break;
          case "unversioned":
            notTracked.push(
              new Resource(item.$.path, item["wc-status"].$.item)
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

module.exports = svnSCM;
