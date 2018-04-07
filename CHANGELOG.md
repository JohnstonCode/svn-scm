# **v1.28.0**

## What's New

* @edgardmessias Added support to ignoring files by ext

## Bug Fixes

* @JohnstonCode svn log revision is now HEAD:1
* @edgardmessias Fixed inconsistent line ending style error

# **v1.27.1**

## Changes

* @JohnstonCode Updated ignore error message and now shows information message on completion

# **v1.27.0**

## What's New

* @JohnstonCode Added menu option to ignore unversioned files

# **v1.26.1**

## Bug Fixes

* @JohnstonCode Fixed issue removing items from changelists.

# **v1.26.0**

## What's New

* @JohnstonCode Added configuration option to disable update message
* @JohnstonCode Added command show patch from changelist

## Bug Fixes

* @edgardmessias Fixed ignoreExternals configuration

# **v1.25.0**

## What's New

* @TheoHegemann Added configuration parameter svn.default.encoding

# **v1.24.0**

## What's New

* @edgardmessias Added option to ignore externals on update

## Bug Fixes

* @edgardmessias Fixed file name with "@"

# **v1.23.2**

## Bug Fixes

* @edgardmessias Fixed commit when message is a existent file
* @edgardmessias Improved Authentications

# **v1.23.1**

## Bug Fixes

* @JohnstonCode Fixed diff patch for selected in title menu

# **v1.23.0**

## What's New

* @edgardmessias Improved Changelists
* @edgardmessias Added support to work with sub branchs
* @johnjacobkenny Added new settings table layout

## Bug Fixes

* @edgardmessias Fixed image asset not opening from vcs sidebar

# **v1.22.0**

## What's New

* @edgardmessias Added svn cleanup and status in status bar

## Bug Fixes

* @edgardmessias Show original file if has conflict marks
* @edgardmessias Hide "Open changes" buttons if no has change
* @edgardmessias Removed locked items in changes lists

# **v1.21.3**

## Bug Fixes

* @edgardmessias Fixed branch switching if not share common ancestry

# **v1.21.2**

## Bug Fixes

* @edgardmessias Fixed branch names in switch menu
* @edgardmessias Fixed svn info for externals if not exists

# **v1.21.1**

## Bug Fixes

* @edgardmessias Fixed HEAD information on UNC path

# **v1.21.0**

## What's New

* @edgardmessias Added suggestion to install SVN when not found
* @JohnstonCode Ability to close repositories when multiple are open
* @edgardmessias Added option for external on same server

## Bug Fixes

* @edgardmessias Hide commands if no svn installed
* @JohnstonCode Fixed repository duplication when updating

# **v1.20.0**

## What's New

* @edgardmessias Improved conflict resolution

## Bug Fixes

* @edgardmessias Disabled commands for non SVN repository
* @edgardmessias Show external folder as a repository
* @edgardmessias Fixed no diff for conflicted files
* @edgardmessias Fixed file paths on different drives on windows

# **v1.19.0**

## What's New

* @edgardmessias Added auth support
* @edgardmessias Added support for show diff patch for selected

# **v1.18.1**

## Changes

* @edgardmessias Can now save patches

# **v1.18.0**

## What's New

* @JohnstonCode Added config option for showing output on startup

# **v1.17.1**

## Bug Fixes

* @JohnstonCode Fixed #149

# **v1.17.0**

## What's New

* @edgardmessias Added config option for status count

## Bug Fixes

* @edgardmessias Fixed tile title for commit log
* @edgardmessias Fixed an issue what would cause SVN SCM to stop working when opening an external file.
* @johnjacobkenny Fixed typos
* @katrinleinweber Fixed typos

# **v1.16.0**

## What's New

* @edgardmessias Made Some under the hood tweaks

# **v1.15.0**

## What's New

* @edgardmessias Added in StatusBar notification of new commits

# **v1.14.1**

## Changes

* @edgardmessias Added changelist icon

# **v1.14.0**

## What's New

* @edgardmessias Added status view decorations

# **v1.13.2**

## Bug Fixes

* @edgardmessias Fixed encoding with xml output

# **v1.13.1**

## Bug Fixes

* @JohnstonCode fixed untracked files showing in changes and unversioned

# **v1.13.0**

## What's New

* @lapo-luchini Added config to set update of branches

# **v1.12.0**

## What's New

* @edgardmessias Added multiple file open options

# **v1.11.1**

## Changes

* @JohnstonCode Updated readme file

# **v1.11.0**

## What's New

* @JohnstonCode Added commit message list

# **v1.10.0**

## What's New

* @JohnstonCode Added conflict support

# **v1.9.0**

## What's New

* @edgardmessias Added changelist support

# **v1.8.0**

## What's New

* @JohnstonCode Added svn remove command with keep local flag

# **v1.7.0**

## What's New

* @edgardmessias Added external folder list in source control

## Bug Fixes

* @edgardmessias Fixed diff changes on UNC path

# **v1.6.0**

## What's New

* @edgardmessias Ignore files defined in "files.exclude"

# **v1.5.1**

## Bug Fixes

* @edgardmessias fixed #83. Fixed multi-project workspace
* @edgardmessias fixed #82, #9. Character encoding issues

# **v1.5.0**

## What's New

* @rwatts3 Added Svn patch command

# **v1.4.6**

## Bug Fixes

* @JohnstonCode fixed #82. Checks encoding guess is above 0.8 confidance

# **v1.4.5**

## Bug Fixes

* @edgardmessias fixed regex to catch all conflict files
* @JohnstonCode fixed right click menu on changes to split the options.

# **v1.4.4**

## Bug Fixes

* @edgardmessias fixed error showing in developer tools
* @edgardmessias Removed conflict files from not tracked files

# **v1.4.3**

## Bug Fixes

* @JohnstonCode fixed #70 branch change not working in none root folders

# **v1.4.2**

## Bug Fixes

* @edgardmessias fixed #69 source control not working in subfolder of project

# **v1.4.1**

## Bug Fixes

* @edgardmessias Not check SVN version if folder not contains ".svn" folder
* @edgardmessias Fixed ignored folder for multifolder svn to work with Windows
* @JohnstonCode Possible fix for #67

# **v1.4.0**

## What's New

* @edgardmessias Added support to configure non-standard layout. To configure,
  edit the options:
  * "svn.layout.trunk" : Relative path for 'trunk' in SVN URL, 'null' to
    disable. (Ex.: 'trunk', 'main')
  * "svn.layout.branches" : Relative path for 'branches' in SVN URL, 'null' to
    disable. (Ex.: 'branches', 'versions')
  * "svn.layout.tags" : Relative path for 'tags' in SVN URL, 'null' to disable.
    (Ex.: 'tags', 'stamps')
* @edgardmessias Added support to configure diff changes. To configure, edit the
  options:
  * "svn.diff.withHead" : Show diff changes using latest revision in the
    repository. Set false to use latest revision in local folder
* @JohnstonCode Commit info message now shows what revision it was
* @JohnstonCode Added svn update to scm title commands
* @JohnstonCode Added confirmation message to revert command
* @edgardmessias Added support for multiple svn folders. To configure, edit the
  options:
  * "svn.multipleFolders.enabled" : Allow to find subfolders using SVN
  * "svn.layout.depth" : Maximum depth to find subfolders using SVN
  * "svn.multipleFolders.ignore" : Folders to ignore using SVN (Ex.:
    '\*\*/vendor', '\*\*/node_modules')
* @edgardmessias Added support for enable/disable without reload window,

## Bug Fixes

* @edgardmessias Fixed config option form svn path
* @JohnstonCode Fixed conflicted files not having an icon
* @edgardmessias Reduced calls to branch listings
* @edgardmessias Fixed SVN revert for multiple svn folders

# **v1.3.2**

## Bug Fixes

* Fixed #44 wrong command attached to input box

# **v1.3.1**

## Bug Fixes

* @edgardmessias fixed #45 failed match

# **v1.3.0**

## What's New

* @edgardmessias improved the way SVN is detected and added svn path to config

# **v1.2.1**

## Bug Fixes

* Added better error logging for failed commits

# **v1.2.0**

## What's New

* @edgardmessias added output channel

# **v1.1.0**

## What's New

* Added file revert command

# **v1.0.3**

## Changes

* Merged @edgardmessias PR Added support to subpath for project, in switching
  branches

# **v1.0.2**

## Bug Fixes

* Diff against head should now work.
* Update debounce was re-added by @edgardmessias

# **v1.0.1**

## What's New

* updated changelog

# **v1.0.0**

## What's New

* Status bar added to see current branch and the ability to create/swap branches
* The extension is now written in typescript
* Error messages should now be more readable
* The ability to view diff against HEAD

## Bug Fixes

* Character encoding should be automatically picked up
* Commiting show work
* should show all repo in multi-root workspaces
* Changes should now update automatically

# **v0.10.0**

## What's New

* Added refresh button to source control view

## Bug Fixes

* Esc now cancels commit rather than committing with undefined message

# **v0.9.0**

## What's New

* Right click option to commit files in "changes"

# **v0.8.10**

## Bug Fixes

* Using the source control commit box should only commit changes listed
* Re-fixed no changes showing.

# **v0.8.9**

## Bug Fixes

* Fixed Missing icons
* Fixed all changes showing as untracked

# **v0.8.8**

## Bug Fixes

* Fixed issue were no changes should show but last change was still present
* Removed SVN 1.9 requirement

# **v0.8.7**

## Bug Fixes

* Fixed source view file click when in nested folder

# **v0.8.6**

## Bug Fixes

* Fixed issue with path not showing correctly when with history

# **v0.8.5**

## Changes

* Removed svn-spawn

# **v0.8.4**

## Bug Fixes

* Fixes issue #13 - Status of files outside of current folder being shown

# **v0.8.3**

## Bug Fixes

* Missing iconv-lite dep

# **v0.8.2**

## Bug Fixes

* Fixed decorator to limit async calls.

# **v0.8.1**

## Changes

* Added throttle decorators to try and limit async requests.
* at 8.1 as i messed versioning up.

## Bug Fixes

* Fixed issues with only one SCM being created in multi-root

# **v0.7.0**

## What's New

* Now multi-root aware for VS code 18

# **v0.6.0**

## What's New

* Can add un-tracked files in source control view

# **v0.5.1**

## Bug Fixes

* Status icons now working again

# **v0.5.0**

## What's New

* Can commit all changes using SCM input box

# **v0.4.0**

## What's New

* Files/Folders can be clicked open from source control view

# **v0.3.1**

## Changes

* Added new status to changes with icons

# **v0.3.0**

## What's New

* Added Icons to Source control view.
* Changed Source control group to 'Changes' from 'Modified'

# **v0.2.0**

## What's New

* Added quick diff editor gutter decorations.

# **v0.1.3**

## Changes

* Removed boilerplate code

# **v0.1.2**

## Bug Fixes

* Updated incorrect information in package.json

# **v0.1.1**

## Bug Fixes

* Incorrect groups in source control view.

# **v0.1.0**

## What's New

* Added Source control view
