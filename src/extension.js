const vscode = require('vscode');
const path = require('path');
const Svn = require('./svn');
const svnSCM = require('./svnSCM');
const svnContentProvider = require('./svnContentProvider');

const checkAllFiles = (svn) => {
	return new Promise((resolve, reject) => {
		svn.getStatus()
		.then((data) => resolve(data))
		.catch((err) => reject(err));
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
	const changes = ['added', 'modified', 'deleted', 'missing', 'conflicted', 'replaced'];
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
				command: {
					command: 'svn.fileOpen',
					title: 'Open',
					arguments: [createResourceUri(item.$.path)]
				}
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
				command: {
					command: 'svn.fileOpen',
					title: 'Open',
					arguments: [createResourceUri(item.$.path)]
				}
			});
		}
	});
	
	return matches;
}

const registerFileOpenCommand = () => {
	vscode.commands.registerCommand('svn.fileOpen', (resourceUri) => {
		vscode.commands.executeCommand('vscode.open', resourceUri);
	});
}

function activate(context) {
	console.log('svn-scm is now active!');

	const disposable = [];
	const rootPath = vscode.workspace.rootPath;

	const watcher = vscode.workspace.createFileSystemWatcher(`${rootPath}/**/*`);

	registerFileOpenCommand();
	
	const sourceControl = new svnSCM();
	const contentProvider = new svnContentProvider();
	const svn = new Svn();

	const changes = sourceControl.createResourceGroup('changes', 'Changes');
	const notTracked = sourceControl.createResourceGroup('unversioned', 'Not Tracked');
	
	changes.hideWhenEmpty = true;
	notTracked.hideWhenEmpty = true;
	
	const main = () => {
		return checkAllFiles(svn)
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