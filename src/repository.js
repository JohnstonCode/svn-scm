const Svn = require('./svn');

function repository() {
	this.svn = new Svn();
	this.filePaths = [];
	this.update();
}

repository.prototype.update = function() {
	this.svn.getStatus().then(result => {
		result.forEach(item => {
			this.filePaths.push(item.$.path);
		});
	});
}

repository.prototype.getRepositoryFilePath = function(relativePath) {
	let repositoryFilePath = false;

	this.filePaths.forEach(filePath => {
		const fileName = relativePath.split('/').pop();

		let regex = new RegExp(fileName, 'g');
		let matches = filePath.match(regex);

		if (matches) {
			repositoryFilePath = filePath;
		}
	});
	
	return repositoryFilePath;
}

module.exports = repository;