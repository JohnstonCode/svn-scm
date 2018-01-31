# Subversion source control for VS Code

[![Version](https://vsmarketplacebadge.apphb.com/version-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)
[![Installs](https://vsmarketplacebadge.apphb.com/installs-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)
[![Ratings](https://vsmarketplacebadge.apphb.com/rating-short/johnstoncode.svn-scm.svg)](https://marketplace.visualstudio.com/items?itemName=johnstoncode.svn-scm)

[![Build Status](https://travis-ci.org/JohnstonCode/svn-scm.svg?branch=master)](https://travis-ci.org/JohnstonCode/svn-scm)
[![Build Status](https://ci.appveyor.com/api/projects/status/github/JohnstonCode/svn-scm?branch=master&svg=true)](https://ci.appveyor.com/project/JohnstonCode/svn-scm)

[![Dependencies Status](https://david-dm.org/JohnstonCode/svn-scm/status.svg)](https://david-dm.org/JohnstonCode/svn-scm)
[![DevDependencies Status](https://david-dm.org/JohnstonCode/svn-scm/dev-status.svg)](https://david-dm.org/JohnstonCode/svn-scm?type=dev)
[![Greenkeeper badge](https://badges.greenkeeper.io/JohnstonCode/svn-scm.svg)](https://greenkeeper.io/)

[![codecov](https://codecov.io/gh/JohnstonCode/svn-scm/branch/master/graph/badge.svg)](https://codecov.io/gh/JohnstonCode/svn-scm)
[![Known Vulnerabilities](https://snyk.io/test/github/JohnstonCode/svn-scm/badge.svg)](https://snyk.io/test/github/JohnstonCode/svn-scm)

[![bitHound Overall Score](https://www.bithound.io/github/JohnstonCode/svn-scm/badges/score.svg)](https://www.bithound.io/github/JohnstonCode/svn-scm)
[![bitHound Dependencies](https://www.bithound.io/github/JohnstonCode/svn-scm/badges/dependencies.svg)](https://www.bithound.io/github/JohnstonCode/svn-scm/master/dependencies/npm)
[![bitHound Dev Dependencies](https://www.bithound.io/github/JohnstonCode/svn-scm/badges/devDependencies.svg)](https://www.bithound.io/github/JohnstonCode/svn-scm/master/dependencies/npm)
[![bitHound Code](https://www.bithound.io/github/JohnstonCode/svn-scm/badges/code.svg)](https://www.bithound.io/github/JohnstonCode/svn-scm)

[![Average time to resolve an issue](https://isitmaintained.com/badge/resolution/JohnstonCode/svn-scm.svg)](https://isitmaintained.com/project/JohnstonCode/svn-scm "Average time to resolve an issue")
[![Percentage of issues still open](https://isitmaintained.com/badge/open/JohnstonCode/svn-scm.svg)](https://isitmaintained.com/project/JohnstonCode/svn-scm "Percentage of issues still open")

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

## Contributors

* @JohnstonCode
* @edgardmessias
* @csholmq
* @rwatts3

## Features

* [x] Source Control View
* [x] Quick Diffs in gutter
* [x] Status Bar
* [ ] SVN Commands

## Settings

`svn.enabled`
  * Enables Svn as a SCM in VS Code.  
  `"default"` &mdash; true

`svn.path`
  * Path to the svn executable  
  `"default"` &mdash; null

`svn.diff.withHead`
  * Show diff changes using latest revision in the repository. Set false to use latest revision in local folder  
  `"default"` &mdash; true

`svn.layout.trunk`
  * Relative path for 'trunk' in SVN URL, 'null' to disable. (Ex.: 'trunk', 'main')  
  `"default"` &mdash; trunk

`svn.layout.branches`
  * Relative path for 'branches' in SVN URL, 'null' to disable. (Ex.: 'branches', 'versions')  
  `"default"` &mdash; branches

`svn.layout.tags`
  * Relative path for 'tags' in SVN URL, 'null' to disable. (Ex.: 'tags', 'stamps')  
  `"default"` &mdash; tags

`svn.multipleFolders.enabled`
  * Allow to find subfolders using SVN  
  `"default"` &mdash; false

`svn.multipleFolders.depth`
  * Maximum depth to find subfolders using SVN  
  `"default"` &mdash; 4

`svn.multipleFolders.ignore`
  * Folders to ignore using SVN  
  `"default"` &mdash; `["**/.git", "**/.hg", "**/vendor", "**/node_modules"]`

`svn.sourceControl.ignoreOnCommit`
  * Changelists to ignore on commit  
  `"default"` &mdash; `["ignore-on-commit"]`

`svn.sourceControl.showExternal`
  * Allow to show in source control the list the external folders  
  `"default"` &mdash; false

`svn.log.length`
  * Number of commit messages to log  
  `"default"` &mdash; 50
