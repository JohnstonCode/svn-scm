const SvnSpawn = require("svn-spawn");
const vscode = require("vscode");

function svn() {
  const rootPath = vscode.workspace.rootPath;

  this.client = new SvnSpawn({
    cwd: rootPath,
    noAuthCache: true
  });
}

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

module.exports = svn;
