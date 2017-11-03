const SvnSpawn = require("svn-spawn");
const vscode = require("vscode");
const cp = require("child_process");
const iconv = require("iconv-lite");

function cpErrorHandler(cb) {
  return err => {
    if (/ENOENT/.test(err.message)) {
      err = "Failed to execute svn (ENOENT)";
    }

    cb(err);
  };
}

async function exec(child, options = {}) {
  if (!child.stdout || !child.stderr) {
    throw new Error("Failed to get stdout or stderr from svn process");
  }

  let encoding = options.encoding || "utf8";
  encoding = iconv.encodingExists(encoding) ? encoding : "utf8";

  const [exitCode, stdout, stderr] = await Promise.all([
    new Promise((c, e) => {
      const buffers = [];
      child.once("error", cpErrorHandler(e));
      child.once("exit", c);
    }),
    new Promise(c => {
      const buffers = [];
      child.stdout.on("data", b => buffers.push(b));
      child.stdout.once("close", () =>
        c(iconv.decode(Buffer.concat(buffers), encoding))
      );
    }),
    new Promise(c => {
      const buffers = [];
      child.stderr.on("data", b => buffers.push(b));
      child.stderr.once("close", () =>
        c(Buffer.concat(buffers).toString("utf8"))
      );
    })
  ]);

  return { exitCode, stdout, stderr };
}

function svn(cwd = null) {
  this.client = new SvnSpawn({
    noAuthCache: true,
    cwd: cwd
  });
  this.canRun = true;

  this.isSVNAvailable().catch(() => {
    this.canRun = false;
    vscode.window.showErrorMessage(
      "SVN is not availabe in your $PATH. svn-scm is unable to run!"
    );
  });
}

svn.prototype.exec = async function(cwd, args, options) {
  options.cwd = cwd;
  return await this._exec(args, options);
};

svn.prototype._exec = async function(args, options) {
  const child = this.spawn(args, options);
  const result = await exec(child, options);

  return result;
};

svn.prototype.spawn = function(args, options = {}) {
  if (!this.canRun) {
    throw new Error(
      "SVN is not available in your $PATH. svn-scm is unable to run!"
    );
  }

  return cp.spawn("svn", args, options);
};

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
  return this.svn.getStatus();
};
