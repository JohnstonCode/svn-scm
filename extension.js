// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require('vscode');
const SvnSpawn = require('svn-spawn');
const path = require('path');

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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "svn-scm" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var disposable = vscode.commands.registerCommand('extension.sayHello', function () {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });

	const rootPath = vscode.workspace.rootPath;
	const outputChannel = createChannel();
	vscode.commands.registerCommand('vscode-svn.showOutputChannel', () => outputChannel.show());
  
	const statusBar = createStatusBar();
	const client = createClient(rootPath);
	const watcher = vscode.workspace.createFileSystemWatcher(`${rootPath}/**/*`);

	const sourceControl = vscode.scm.createSourceControl('svn', 'svn');
	sourceControl.quickDiffProvider = sourceControl;

	const modified = sourceControl.createResourceGroup('modified', 'Modified');
	const removed = sourceControl.createResourceGroup('removed', 'Removed');
	const notTracked = sourceControl.createResourceGroup('unversioned', 'Not Tracked');
	
	const main = () => {
	  return checkAllFiles(client, statusBar)
		.then((data) => {
			modified.resourceStates = updateResourceGroup(data, 'modified');
			removed.resourceStates = updateResourceGroup(data, 'removed');
			notTracked.resourceStates = updateResourceGroup(data, 'unversioned');
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