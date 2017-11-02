const { workspace, Uri, window } = require("vscode");
const fs = require("fs");
const path = require("path");
const Repository = require("./repository");

function Model(svn) {
  this.svn = svn;
  this.openRepositories = [];
  this.scanWorkspaceFolders();
}

Model.prototype.scanWorkspaceFolders = async function() {
  for (const folder of workspace.workspaceFolders || []) {
    const root = folder.uri.fsPath;
    this.tryOpenRepository(root);
  }
};

Model.prototype.tryOpenRepository = async function(path) {
  if (this.getRepository(path)) {
    return;
  }

  try {
    const repositoryRoot = await this.svn.getRepositoryRoot(path);

    if (this.getRepository(repositoryRoot)) {
      return;
    }

    const repository = new Repository(this.svn.open(repositoryRoot));

    this.open(repository);
  } catch (err) {
    return;
  }
};

Model.prototype.getRepository = function(path) {
  const liveRepository = this.getOpenRepository(path);
  return liveRepository && liveRepository.repository;
};

Model.prototype.getOpenRepository = function(hint) {
  if (!hint) {
    return undefined;
  }

  if (hint instanceof Repository) {
    return this.openRepositories.filter(r => r === hint)[0];
  }

  hint = Uri.file(hint);

  for (const liveRepository of this.openRepositories) {
    const relativePath = path.relative(
      liveRepository.repository.root,
      hint.fsPath
    );

    if (!/^\.\./.test(relativePath)) {
      return liveRepository;
    }

    return undefined;
  }
};

Model.prototype.open = function(repository) {
  this.openRepositories.push(repository);
};

Model.prototype.pickRepository = async function() {
  if (this.openRepositories.length === 0) {
    throw new Error("There are no available repositories");
  }

  const picks = this.openRepositories.map(repo => {
    return {
      label: path.basename(repo.repository.root),
      repository: repo
    };
  });
  const placeholder = "Choose a repository";
  const pick = await window.showQuickPick(picks, { placeholder });

  return pick && pick.repository;
};

module.exports = Model;
