# Subversion source control for VS Code

[![Version](https://vsmarketplacebadge.apphb.com/version-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)

[![Build Status](https://travis-ci.org/JohnstonCode/svn-scm.svg?branch=master)](https://travis-ci.org/JohnstonCode/svn-scm)
[![Build Status](https://ci.appveyor.com/api/projects/status/github/JohnstonCode/svn-scm?branch=master&svg=true)](https://ci.appveyor.com/project/JohnstonCode/svn-scm)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

[![Dependencies Status](https://david-dm.org/JohnstonCode/svn-scm/status.svg)](https://david-dm.org/JohnstonCode/svn-scm)
[![DevDependencies Status](https://david-dm.org/JohnstonCode/svn-scm/dev-status.svg)](https://david-dm.org/JohnstonCode/svn-scm?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/JohnstonCode/svn-scm.svg)](https://greenkeeper.io/)

[![codecov](https://codecov.io/gh/JohnstonCode/svn-scm/branch/master/graph/badge.svg)](https://codecov.io/gh/JohnstonCode/svn-scm)
[![Known Vulnerabilities](https://snyk.io/test/github/JohnstonCode/svn-scm/badge.svg)](https://snyk.io/test/github/JohnstonCode/svn-scm)

[![CodeFactor](https://www.codefactor.io/repository/github/johnstoncode/svn-scm/badge)](https://www.codefactor.io/repository/github/johnstoncode/svn-scm)

[![Average time to resolve an issue](https://isitmaintained.com/badge/resolution/JohnstonCode/svn-scm.svg)](https://isitmaintained.com/project/JohnstonCode/svn-scm "Average time to resolve an issue")
[![Percentage of issues still open](https://isitmaintained.com/badge/open/JohnstonCode/svn-scm.svg)](https://isitmaintained.com/project/JohnstonCode/svn-scm "Percentage of issues still open")

[![Gitter chat](https://badges.gitter.im/gitterHQ/gitter.png)](https://gitter.im/svn-scm/Lobby)

# Prerequisites

> **Note**: This extension leverages your machine's SVN installation,\
> so you need to [install SVN](https://subversion.apache.org) first.

## Windows

If you use [TortoiseSVN](https://tortoisesvn.net/), make sure the option
**Command Line Tools** is checked during installation and
`C:\Program Files\TortoiseSVN\bin` is available in PATH.

## Feedback & Contributing

* Please report any bugs, suggestions or documentation requests via the
  [Issues](https://github.com/JohnstonCode/svn-scm/issues)
* Feel free to submit
  [pull requests](https://github.com/JohnstonCode/svn-scm/pulls)

## [Contributors](https://github.com/JohnstonCode/svn-scm/graphs/contributors)

## Features

* Source Control View
* Quick Diffs in gutter
* Status Bar
* Create changelists
* Add files
* Revert edits
* Remove files
* Create branches
* Switch branches
* Create patches
* Diff changes
* Commit changes/changelists
* See commit messages

## Experimental

### * SVN Status in File Explorer (See #34)
How to enable:
* Open the file: `<vscode path>\resources\app\product.json`
* Find `extensionAllowedProposedApi`
* Append `"johnstoncode.svn-scm"` in the array

Example:
```json
// FROM
{
  "extensionAllowedProposedApi": [
    "ms-vsliveshare.vsliveshare"
  ]
}
// TO
{
  "extensionAllowedProposedApi": [
    "ms-vsliveshare.vsliveshare", "johnstoncode.svn-scm"
  ]
}
```

## Settings

|Config|Description|Default|
|-|-|-|
|`svn.enabled`|Whether svn is enabled|`true`|
|`svn.autorefresh`|Whether auto refreshing is enabled|`true`|
|`svn.decorations.enabled`|Controls if SVN contributes colors and badges to the explorer and the open (VSCode \>= 1.18 with proposed-api)|`true`|
|`svn.path`|Path to the svn executable|`null`|
|`svn.defaultCheckoutDirectory`|The default location to checkout a svn repository.|`null`|
|`svn.ignoreRepositories`|List of SVN repositories to ignore.|`null`|
|`svn.ignoreMissingSvnWarning`|Ignores the warning when SVN is missing|`false`|
|`svn.ignoreWorkingCopyIsTooOld`|Ignores the warning when working copy is too old|`false`|
|`svn.diff.withHead`|Show diff changes using latest revision in the repository. Set false to use latest revision in local folder|`true`|
|`svn.layout.trunkRegex`|Regex to detect path for 'trunk' in SVN URL, 'null' to disable. (Ex.: '(trunk)', '(main)')|`"(trunk)(/.*)?"`|
|`svn.layout.trunkRegexName`|Regex group position for name of trunk|`1`|
|`svn.layout.branchesRegex`|Regex to detect path for 'branches' in SVN URL, 'null' to disable. Subpath use 'branches/[^/]+/([^/]+)(/.\*)?' (Ex.: 'branches/...', 'versions/...')|`"branches/([^/]+)(/.*)?"`|
|`svn.layout.branchesRegexName`|Regex group position for name of branch|`1`|
|`svn.layout.tagsRegex`|Regex to detect path for 'tags' in SVN URL, 'null' to disable. Subpath use 'tags/[^/]+/([^/]+)(/.\*)?'. (Ex.: 'tags/...', 'stamps/...')|`"tags/([^/]+)(/.*)?"`|
|`svn.layout.tagRegexName`|Regex group position for name of tag|`1`|
|`svn.layout.showFullName`|Set true to show 'branches/\<name\>' and false to show only '\<name\>'|`true`|
|`svn.multipleFolders.enabled`|Allow to find subfolders using SVN|`false`|
|`svn.multipleFolders.depth`|Maximum depth to find subfolders using SVN|`4`|
|`svn.multipleFolders.ignore`|Folders to ignore using SVN|`["**/.git","**/.hg","**/vendor","**/node_modules"]`|
|`svn.sourceControl.ignoreOnCommit`|Changelists to ignore on commit|`["ignore-on-commit"]`|
|`svn.sourceControl.ignoreOnStatusCount`|Changelists to ignore on status count|`["ignore-on-commit"]`|
|`svn.detectExternals`|Controls whether to automatically detect svn externals.|`true`|
|`svn.sourceControl.combineExternalIfSameServer`|Combine the svn external in the main if is from the same server.|`false`|
|`svn.sourceControl.countUnversioned`|Allow to count unversioned files in status count|`true`|
|`svn.log.length`|Number of commit messages to log|`50`|
|`svn.showOutput`|Show the output window when the extension starts|`false`|
|`svn.conflicts.autoResolve`|Set file to status resolved after fix conflictss|`false`|
|`svn.update.ignoreExternals`|Set to ignore externals definitions on update (add --ignore-externals)|`true`|
|`svn.delete.actionForDeletedFiles`|When a file is deleted, what SVN should do? `none` - Do nothing, `prompt` - Ask the action, `remove` - automatically remove from SVN|`"prompt"`|
|`svn.delete.ignoredRulesForDeletedFiles`|Ignored files/rules for `svn.delete.actionForDeletedFiles`(Ex.: file.txt or \*\*/\*.txt)|`[]`|
|`svn.default.encoding`|Encoding of svn output if the output is not utf-8. When this parameter is null, the encoding is automatically detected. Example: 'windows-1252'.|`null`|
|`svn.showUpdateMessage`|Show the update message when update is run|`true`|
|`svn.remoteChanges.checkFrequency`|Set the interval in seconds to check changed files on remote repository and show in statusbar. 0 to disable|`300`|
|`svn.sourceControl.hideUnversioned`|Hide unversioned files in Source Control UI|`false`|
|`svn.refresh.remoteChanges`|Refresh remote changes on refresh command|`false`|
