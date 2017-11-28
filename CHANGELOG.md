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
