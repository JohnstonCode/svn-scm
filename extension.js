var vscode = require('vscode');
const SvnSpawn = require('svn-spawn');
const path = require('path');
const svnSCM = require('./src/svnSCM.js');
const svnContentProvider = require('./src/svnContentProvider');

const createStatusBar = () => {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.command = 'vscode-svn.showOutputChannel';

  return statusBarItem;
};

const createClient = (rootPath) => {
  return new SvnSpawn({
    cwd: rootPath,
    noAuthCache: true,
  });
};

const createChannel = () => {
  return vscode.window.createOutputChannel('vscode-svn');
};

const svnStatus = (client) => {
  return new Promise((resolve, reject) => {
    client.getStatus((err, data) => err ? reject(err) : resolve(data));
  });
};

const updateStatusBar = (data, statusBar) => {
  return new Promise((resolve) => {
    statusBar.text = `${data.length} changes`;
    statusBar.show();

    resolve(data);
  });
};

const checkAllFiles = (client) => {
  return new Promise((resolve, reject) => {
    svnStatus(client)
    .then((data) => resolve(data))
    .catch((err) => reject(err));
  });
};

const updateOutputChannel = (data, outputChannel) => {
  outputChannel.clear();

  data.forEach((item) => {
    const document = vscode.Uri.file(path.join(vscode.workspace.rootPath, item.$.path));
    outputChannel.appendLine(document);
  });
};

function createResourceUri(relativePath) {
	const absolutePath = path.join(vscode.workspace.rootPath, relativePath);
	return vscode.Uri.file(absolutePath);
  }

const updateResourceGroup = (data, type) => {
	var matches = [];
  
	data.forEach(item => {
	  if (item['wc-status'].$.item == type) {
		matches.push({resourceUri: createResourceUri(item.$.path)});
	  }
	});
  
	return matches;
}

const updateChangesResourceGroup = (data) => {
	const changes = ['added', 'modified', 'deletion', 'deleted'];
	let matches = [];
	const iconsRootPath = path.join(__dirname, 'icons');

	data.forEach(item => {
		if (changes.indexOf(item['wc-status'].$.item) != -1) {
			matches.push({
				resourceUri: createResourceUri(item.$.path),
				decorations: {
					iconPath: vscode.Uri.file(path.join(iconsRootPath, `${item['wc-status'].$.item}.svg`)),
					tooltip: item['wc-status'].$.item,
				},
			});
		}
	});
	
	return matches;
}

const updateNotTrackedResourceGroup = (data) => {
	let matches = [];
	const iconsRootPath = path.join(__dirname, 'icons');

	data.forEach(item => {
		if (item['wc-status'].$.item == 'unversioned') {
			matches.push({
				resourceUri: createResourceUri(item.$.path),
				decorations: {
					iconPath: vscode.Uri.file(path.join(iconsRootPath, `unversioned.svg`)),
					tooltip: item['wc-status'].$.item,
				},
			});
		}
	});
	
	return matches;
}

function activate(context) {
	console.log('svn-scm is now active!');

	const disposable = [];
	const rootPath = vscode.workspace.rootPath;
	const outputChannel = createChannel();
	vscode.commands.registerCommand('vscode-svn.showOutputChannel', () => outputChannel.show());
	
	const statusBar = createStatusBar();
	const client = createClient(rootPath);
	const watcher = vscode.workspace.createFileSystemWatcher(`${rootPath}/**/*`);

	const sourceControl = svnSCM.init();
	svnContentProvider.init();

	const changes = sourceControl.createResourceGroup('changes', 'Changes');
	const notTracked = sourceControl.createResourceGroup('unversioned', 'Not Tracked');
	
	changes.hideWhenEmpty = true;
	notTracked.hideWhenEmpty = true;
	
	const main = () => {
		return checkAllFiles(client, statusBar)
		.then((data) => {
			changes.resourceStates = updateChangesResourceGroup(data);
			notTracked.resourceStates = updateNotTrackedResourceGroup(data);
		})
		.catch((err) => vscode.window.showErrorMessage(err));
	};
	
	watcher.onDidChange(main);
	watcher.onDidCreate(main);
	watcher.onDidDelete(main);
	
	main();
	
	
	
  context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;