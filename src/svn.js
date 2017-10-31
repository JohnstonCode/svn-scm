const SvnSpawn = require("svn-spawn");
const vscode = require("vscode");
const cp = require("child_process");

function svn(cwd = null) {
  this.client = new SvnSpawn({
    noAuthCache: true,
    cwd: cwd
  });

  this.isSVNAvailable().catch(() => {
    vscode.window.showErrorMessage(
      "SVN is not avaialbe in your $PATH. svn-scm is unable to run!"
    );
  });
}

svn.prototype.getRepositoryRoot = async function(path) {
  try {
    let result = await this.cmd(["info", path]);
    let match = result
      .match(/(?=Working Copy Root Path:)(.*)/i)[0]
      .replace("Working Copy Root Path:", "")
      .trim();
    return match;
  } catch (error) {
    throw new Error("Not a SVN repo");
  }
};

svn.prototype.isSVNAvailable = function() {
  return new Promise((resolve, reject) => {
    const result = cp.exec("svn --version");

    result.stdout.on("data", data => {
      resolve();
    });
    result.stderr.on("data", data => {
      reject();
    });
  });
};

svn.prototype.open = function(repositoryRoot) {
  return new Repository(this, repositoryRoot);
};

svn.prototype.cmd = function(args) {
  return new Promise((resolve, reject) => {
    this.client.cmd(args, (err, data) => (err ? reject(err) : resolve(data)));
  });
};

svn.prototype.getStatus = function() {
  return new Promise((resolve, reject) => {
    this.client.getStatus((err, data) => (err ? reject(err) : resolve(data)));
  });
};

svn.prototype.commit = function(params) {
  return new Promise((resolve, reject) => {
    this.client.commit(
      params,
      (err, data) => (err ? reject(err) : resolve(data))
    );
  });
};

svn.prototype.add = function(filePath) {
  return new Promise((resolve, reject) => {
    this.client.add(
      filePath,
      (err, data) => (err ? reject(err) : resolve(data))
    );
  });
};

module.exports = svn;

function Repository(svn, repositoryRoot) {
  this.svn = svn;
  this.root = repositoryRoot;

  this.svn.client.option({
    cwd: this.root,
    noAuthCache: true
  });
}

Repository.prototype.getStatus = function() {
  return this.svn.getStatus();
};
