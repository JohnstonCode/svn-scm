const SvnSpawn = require("svn-spawn");
const vscode = require("vscode");
const cp = require("child_process");
const iconv = require("iconv-lite");

function svn(cwd = null) {
  this.client = new SvnSpawn({
    noAuthCache: true,
    cwd: cwd
  });
  this.canRun = true;

  this.isSVNAvailable().catch(() => {
    this.canRun = false;
    vscode.window.showErrorMessage(
      "SVN is not available in your PATH. svn-scm is unable to run!"
    );
  });
}

svn.prototype.exec = function(cwd, args, options = {}) {
  return new Promise((resolve, reject) => {
    options.cwd = cwd;
    const result = cp.spawn("svn", args, options);
    let buffers = [];

    result.stdout.on("data", b => {
      buffers.push(b);
    });
    result.stderr.on("data", data => {
      reject();
    });
    result.on("error", data => {
      reject();
    });
    result.on("close", () => {
      resolve(
        Buffer.concat(buffers)
          .toString()
          .trim()
      );
    });
  });
};

svn.prototype.getRepositoryRoot = async function(path) {
  try {
    let result = await this.cmd(["info", path, "--show-item", "wc-root"]);
    return result;
  } catch (error) {
    throw new Error("Not a SVN repo");
  }
};

svn.prototype.isSVNAvailable = function() {
  return new Promise((resolve, reject) => {
    this.exec("", ["--version"])
      .then(result => {
        resolve();
      })
      .catch(result => {
        reject();
      });
  });
};

svn.prototype.open = function(repositoryRoot, workspaceRoot) {
  return new Repository(this, repositoryRoot, workspaceRoot);
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

function Repository(svn, repositoryRoot, workspaceRoot) {
  this.svn = svn;
  this.root = repositoryRoot;
  this.workspaceRoot = workspaceRoot;

  this.svn.client.option({
    cwd: this.workspaceRoot,
    noAuthCache: true
  });
}

Repository.prototype.getStatus = function() {
  return new Promise((resolve, reject) => {
    this.svn
      .exec(this.workspaceRoot, ["stat"])
      .then(result => {
        let items = result.split("\n");
        let status = [];

        for (item of items) {
          let state = item.charAt(0);
          let path = item.substr(1).trim();

          if (path !== ".") {
            status.push([state, path]);
          }
        }

        resolve(status);
      })
      .catch(() => {
        reject();
      });
  });
};
