const vscode = require("vscode");
const cp = require("child_process");
const iconv = require("iconv-lite");

function svn() {
  this.isSVNAvailable().catch(() => {
    vscode.window.showErrorMessage(
      "SVN is not available in your PATH. svn-scm is unable to run!"
    );
  });
}

svn.prototype.exec = function(cwd, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (cwd) {
      options.cwd = cwd;
    }
    const result = cp.spawn("svn", args, options);
    let outBuffers = [];
    let errBuffers = [];

    result.stdout.on("data", b => {
      outBuffers.push(b);
    });
    result.stderr.on("data", b => {
      errBuffers.push(b);
    });
    result.on("error", data => {
      reject();
    });
    result.on("close", () => {
      if (outBuffers.length > 0) {
        resolve(
          Buffer.concat(outBuffers)
            .toString()
            .trim()
        );
      }

      reject(
        Buffer.concat(errBuffers)
          .toString()
          .trim()
      );
    });
  });
};

svn.prototype.getRepositoryRoot = async function(path) {
  try {
    let result = await this.exec(path, ["info", "--show-item", "wc-root"]);
    return result;
  } catch (error) {
    throw new Error("not a SVN repo");
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

svn.prototype.add = function(filePath) {
  filePath = filePath.replace(/\\/g, "/");
  return this.exec("", ["add", filePath]);
};

svn.prototype.show = async function(filePath) {
  return this.exec("", ["cat", "-r", "HEAD", filePath]);
};

svn.prototype.list = async function(filePath) {
  return this.exec("", ["ls", filePath]);
};

module.exports = svn;

function Repository(svn, repositoryRoot, workspaceRoot) {
  this.svn = svn;
  this.root = repositoryRoot;
  this.workspaceRoot = workspaceRoot;
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
          let path = item.substr(8).trim();

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

Repository.prototype.commit = async function(message) {
  try {
    let result = await this.svn.exec(this.root, ["commit", "-m", message]);
    return result;
  } catch (error) {
    throw new Error("unable to commit files");
  }
};

Repository.prototype.show = function(path) {
  return this.svn.show(path);
};
