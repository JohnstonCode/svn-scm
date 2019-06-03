## [1.50.2](https://github.com/JohnstonCode/svn-scm/compare/v1.50.1...v1.50.2) (2019-06-03)


### Bug Fixes

* Fixed diff for files with "@" (close [#223](https://github.com/JohnstonCode/svn-scm/issues/223)) ([#595](https://github.com/JohnstonCode/svn-scm/issues/595)) ([ee41f49](https://github.com/JohnstonCode/svn-scm/commit/ee41f49))

## [1.50.1](https://github.com/JohnstonCode/svn-scm/compare/v1.50.0...v1.50.1) (2019-06-01)


### Bug Fixes

* Fixed encoding detection for gutter (close [#526](https://github.com/JohnstonCode/svn-scm/issues/526)) ([#590](https://github.com/JohnstonCode/svn-scm/issues/590)) ([22e40f9](https://github.com/JohnstonCode/svn-scm/commit/22e40f9))

# [1.50.0](https://github.com/JohnstonCode/svn-scm/compare/v1.49.0...v1.50.0) (2019-05-29)


### Features

* Automatic close repository when folder not exists ([#587](https://github.com/JohnstonCode/svn-scm/issues/587)) ([83d81d2](https://github.com/JohnstonCode/svn-scm/commit/83d81d2))

# [1.49.0](https://github.com/JohnstonCode/svn-scm/compare/v1.48.6...v1.49.0) (2019-05-29)


### Features

* Allow to scan repository on ignored folders (close [#570](https://github.com/JohnstonCode/svn-scm/issues/570)) ([#586](https://github.com/JohnstonCode/svn-scm/issues/586)) ([be7069d](https://github.com/JohnstonCode/svn-scm/commit/be7069d))

## [1.48.6](https://github.com/JohnstonCode/svn-scm/compare/v1.48.5...v1.48.6) (2019-05-24)


### Bug Fixes

* Able to revert folders with children ([#577](https://github.com/JohnstonCode/svn-scm/issues/577)) ([9bf7683](https://github.com/JohnstonCode/svn-scm/commit/9bf7683))

## [1.48.5](https://github.com/JohnstonCode/svn-scm/compare/v1.48.4...v1.48.5) (2019-05-21)


### Bug Fixes

* Show alert to work with code-server ([#579](https://github.com/JohnstonCode/svn-scm/issues/579)) ([605b321](https://github.com/JohnstonCode/svn-scm/commit/605b321))

## [1.48.4](https://github.com/JohnstonCode/svn-scm/compare/v1.48.3...v1.48.4) (2019-05-13)


### Bug Fixes

* Diffs now use internal diff flag ([#572](https://github.com/JohnstonCode/svn-scm/issues/572)) ([42e514c](https://github.com/JohnstonCode/svn-scm/commit/42e514c)), closes [#558](https://github.com/JohnstonCode/svn-scm/issues/558)

## [1.48.3](https://github.com/JohnstonCode/svn-scm/compare/v1.48.2...v1.48.3) (2019-05-13)


### Bug Fixes

* Added origional-fs polyfil for remote vs code ([#571](https://github.com/JohnstonCode/svn-scm/issues/571)) ([9da6001](https://github.com/JohnstonCode/svn-scm/commit/9da6001)), closes [#561](https://github.com/JohnstonCode/svn-scm/issues/561)

## [1.48.2](https://github.com/JohnstonCode/svn-scm/compare/v1.48.1...v1.48.2) (2019-05-10)


### Bug Fixes

* Fixed inline commands for remote changes group ([#568](https://github.com/JohnstonCode/svn-scm/issues/568)) ([8940f6f](https://github.com/JohnstonCode/svn-scm/commit/8940f6f))

## [1.48.1](https://github.com/JohnstonCode/svn-scm/compare/v1.48.0...v1.48.1) (2019-04-24)


### Bug Fixes

* Fixed deleting unversioned folders with nested files [#554](https://github.com/JohnstonCode/svn-scm/issues/554) ([#555](https://github.com/JohnstonCode/svn-scm/issues/555)) ([6cf322c](https://github.com/JohnstonCode/svn-scm/commit/6cf322c))

# [1.48.0](https://github.com/JohnstonCode/svn-scm/compare/v1.47.13...v1.48.0) (2019-04-10)


### Features

* Added revert and revert all command icons to SCM view ([#549](https://github.com/JohnstonCode/svn-scm/issues/549)) ([56a66d0](https://github.com/JohnstonCode/svn-scm/commit/56a66d0))

## [1.47.13](https://github.com/JohnstonCode/svn-scm/compare/v1.47.12...v1.47.13) (2019-04-09)


### Bug Fixes

* Fixed bug when svn path contains @ ([#548](https://github.com/JohnstonCode/svn-scm/issues/548)) ([523d46b](https://github.com/JohnstonCode/svn-scm/commit/523d46b))

## [1.47.12](https://github.com/JohnstonCode/svn-scm/compare/v1.47.11...v1.47.12) (2019-03-29)


### Performance Improvements

* All fs is done async ([#540](https://github.com/JohnstonCode/svn-scm/issues/540)) ([b26602f](https://github.com/JohnstonCode/svn-scm/commit/b26602f))

## [1.47.11](https://github.com/JohnstonCode/svn-scm/compare/v1.47.10...v1.47.11) (2019-03-28)


### Bug Fixes

* Fixed .asar file locking (close [#437](https://github.com/JohnstonCode/svn-scm/issues/437)) ([#539](https://github.com/JohnstonCode/svn-scm/issues/539)) ([66af99b](https://github.com/JohnstonCode/svn-scm/commit/66af99b))

## [1.47.10](https://github.com/JohnstonCode/svn-scm/compare/v1.47.9...v1.47.10) (2019-03-27)


### Bug Fixes

* Fixed watch files changes with external ([#538](https://github.com/JohnstonCode/svn-scm/issues/538)) ([2899a60](https://github.com/JohnstonCode/svn-scm/commit/2899a60))

## [1.47.9](https://github.com/JohnstonCode/svn-scm/compare/v1.47.8...v1.47.9) (2019-03-27)


### Bug Fixes

* Fixed ignore folder context on explorer (close [#438](https://github.com/JohnstonCode/svn-scm/issues/438)) ([#533](https://github.com/JohnstonCode/svn-scm/issues/533)) ([3354958](https://github.com/JohnstonCode/svn-scm/commit/3354958))

## [1.47.8](https://github.com/JohnstonCode/svn-scm/compare/v1.47.7...v1.47.8) (2019-03-27)


### Bug Fixes

* Fixed set changelist from command palette (close [#460](https://github.com/JohnstonCode/svn-scm/issues/460)) ([#532](https://github.com/JohnstonCode/svn-scm/issues/532)) ([93f1030](https://github.com/JohnstonCode/svn-scm/commit/93f1030))

## [1.47.7](https://github.com/JohnstonCode/svn-scm/compare/v1.47.6...v1.47.7) (2019-03-26)


### Bug Fixes

* Fixed high cpu usage by parallel svn processes (close [#463](https://github.com/JohnstonCode/svn-scm/issues/463)) ([#531](https://github.com/JohnstonCode/svn-scm/issues/531)) ([e70872c](https://github.com/JohnstonCode/svn-scm/commit/e70872c))

## [1.47.6](https://github.com/JohnstonCode/svn-scm/compare/v1.47.5...v1.47.6) (2019-03-26)


### Bug Fixes

* Fixed unable to commit (close [#515](https://github.com/JohnstonCode/svn-scm/issues/515)) ([#530](https://github.com/JohnstonCode/svn-scm/issues/530)) ([72d9bd8](https://github.com/JohnstonCode/svn-scm/commit/72d9bd8))

## [1.47.5](https://github.com/JohnstonCode/svn-scm/compare/v1.47.4...v1.47.5) (2019-03-16)


### Bug Fixes

* Removed sync fs calls from model ([#505](https://github.com/JohnstonCode/svn-scm/issues/505)) ([516dc22](https://github.com/JohnstonCode/svn-scm/commit/516dc22))

## [1.47.4](https://github.com/JohnstonCode/svn-scm/compare/v1.47.3...v1.47.4) (2019-03-15)


### Bug Fixes

* If encoding is passed to svn.ts it uses that rather than guessing ([#499](https://github.com/JohnstonCode/svn-scm/issues/499)) ([17c5438](https://github.com/JohnstonCode/svn-scm/commit/17c5438)), closes [#483](https://github.com/JohnstonCode/svn-scm/issues/483)

## [1.47.3](https://github.com/JohnstonCode/svn-scm/compare/v1.47.2...v1.47.3) (2019-03-15)


### Bug Fixes

* Make deletion modal less intrusive ([#498](https://github.com/JohnstonCode/svn-scm/issues/498)) ([1585771](https://github.com/JohnstonCode/svn-scm/commit/1585771)), closes [#487](https://github.com/JohnstonCode/svn-scm/issues/487)

## [1.47.2](https://github.com/JohnstonCode/svn-scm/compare/v1.47.1...v1.47.2) (2019-03-15)


### Bug Fixes

* Fixed windows network drive issues ([#497](https://github.com/JohnstonCode/svn-scm/issues/497)) ([6a6c846](https://github.com/JohnstonCode/svn-scm/commit/6a6c846)), closes [#466](https://github.com/JohnstonCode/svn-scm/issues/466) [#451](https://github.com/JohnstonCode/svn-scm/issues/451) [#494](https://github.com/JohnstonCode/svn-scm/issues/494)

## [1.47.1](https://github.com/JohnstonCode/svn-scm/compare/v1.47.0...v1.47.1) (2019-02-12)


### Bug Fixes

* path normalizer ([#477](https://github.com/JohnstonCode/svn-scm/issues/477)) ([db214dd](https://github.com/JohnstonCode/svn-scm/commit/db214dd))

# [1.47.0](https://github.com/JohnstonCode/svn-scm/compare/v1.46.4...v1.47.0) (2018-12-21)


### Bug Fixes

* Created matchAll function wrapper for minimatch so dir globs are properly ignored ([#432](https://github.com/JohnstonCode/svn-scm/issues/432)) ([dda6f13](https://github.com/JohnstonCode/svn-scm/commit/dda6f13))


### Features

* Added History lens ([#440](https://github.com/JohnstonCode/svn-scm/issues/440)) ([35988d1](https://github.com/JohnstonCode/svn-scm/commit/35988d1))

## [1.46.4](https://github.com/JohnstonCode/svn-scm/compare/v1.46.3...v1.46.4) (2018-12-05)


### Bug Fixes

* Fixed searching nested repositories ([#430](https://github.com/JohnstonCode/svn-scm/issues/430)) ([c82fa33](https://github.com/JohnstonCode/svn-scm/commit/c82fa33))

## [1.46.3](https://github.com/JohnstonCode/svn-scm/compare/v1.46.2...v1.46.3) (2018-11-28)


### Bug Fixes

* Fix ignore SCM context menu ([#425](https://github.com/JohnstonCode/svn-scm/issues/425)) ([8f55f24](https://github.com/JohnstonCode/svn-scm/commit/8f55f24))

## [1.46.2](https://github.com/JohnstonCode/svn-scm/compare/v1.46.1...v1.46.2) (2018-11-19)


### Bug Fixes

* Fixed svn status letter in file explorer ([#419](https://github.com/JohnstonCode/svn-scm/issues/419)) ([da656c2](https://github.com/JohnstonCode/svn-scm/commit/da656c2))

## [1.46.1](https://github.com/JohnstonCode/svn-scm/compare/v1.46.0...v1.46.1) (2018-11-19)


### Bug Fixes

* Changed "Pull selected changes" to "Update selected" to better reflect svn command name ([#416](https://github.com/JohnstonCode/svn-scm/issues/416)) ([4719239](https://github.com/JohnstonCode/svn-scm/commit/4719239))

# [1.46.0](https://github.com/JohnstonCode/svn-scm/compare/v1.45.4...v1.46.0) (2018-11-19)


### Features

* Added config option to choose changes left click command ([#417](https://github.com/JohnstonCode/svn-scm/issues/417)) ([dc661cc](https://github.com/JohnstonCode/svn-scm/commit/dc661cc))

## [1.45.4](https://github.com/JohnstonCode/svn-scm/compare/v1.45.3...v1.45.4) (2018-11-17)


### Bug Fixes

* Fixed credentials for remote changes (Close [#401](https://github.com/JohnstonCode/svn-scm/issues/401)) ([#413](https://github.com/JohnstonCode/svn-scm/issues/413)) ([75600e5](https://github.com/JohnstonCode/svn-scm/commit/75600e5))

## [1.45.3](https://github.com/JohnstonCode/svn-scm/compare/v1.45.2...v1.45.3) (2018-11-17)


### Bug Fixes

* Fixed set changelist context menu ([#404](https://github.com/JohnstonCode/svn-scm/issues/404)) ([7c0886c](https://github.com/JohnstonCode/svn-scm/commit/7c0886c))

## [1.45.2](https://github.com/JohnstonCode/svn-scm/compare/v1.45.1...v1.45.2) (2018-11-13)


### Bug Fixes

* Removed jschardet and iconv-lite from vsix ([#409](https://github.com/JohnstonCode/svn-scm/issues/409)) ([710090a](https://github.com/JohnstonCode/svn-scm/commit/710090a))

## [1.45.1](https://github.com/JohnstonCode/svn-scm/compare/v1.45.0...v1.45.1) (2018-11-09)


### Bug Fixes

* Removed no open repositories message ([#407](https://github.com/JohnstonCode/svn-scm/issues/407)) ([7618332](https://github.com/JohnstonCode/svn-scm/commit/7618332))

# [1.45.0](https://github.com/JohnstonCode/svn-scm/compare/v1.44.4...v1.45.0) (2018-10-30)


### Features

* Added set change list to explorer context ([#399](https://github.com/JohnstonCode/svn-scm/issues/399)) ([9a90fa7](https://github.com/JohnstonCode/svn-scm/commit/9a90fa7)), closes [#252](https://github.com/JohnstonCode/svn-scm/issues/252)

## [1.44.4](https://github.com/JohnstonCode/svn-scm/compare/v1.44.3...v1.44.4) (2018-10-26)


### Bug Fixes

* Fixed compatibility with SlikSVN ([#397](https://github.com/JohnstonCode/svn-scm/issues/397)) ([21b4f6d](https://github.com/JohnstonCode/svn-scm/commit/21b4f6d))

## [1.44.3](https://github.com/JohnstonCode/svn-scm/compare/v1.44.2...v1.44.3) (2018-10-25)


### Bug Fixes

* Removed revert confirmation alert (close [#395](https://github.com/JohnstonCode/svn-scm/issues/395)) ([#396](https://github.com/JohnstonCode/svn-scm/issues/396)) ([4dce3c9](https://github.com/JohnstonCode/svn-scm/commit/4dce3c9))

## [1.44.2](https://github.com/JohnstonCode/svn-scm/compare/v1.44.1...v1.44.2) (2018-10-23)


### Bug Fixes

* Improved svn detection (close [#389](https://github.com/JohnstonCode/svn-scm/issues/389)) ([#391](https://github.com/JohnstonCode/svn-scm/issues/391)) ([dabb916](https://github.com/JohnstonCode/svn-scm/commit/dabb916))

## [1.44.1](https://github.com/JohnstonCode/svn-scm/compare/v1.44.0...v1.44.1) (2018-10-17)


### Bug Fixes

* Fix Svn not found on vs code reload ([a167caf](https://github.com/JohnstonCode/svn-scm/commit/a167caf))

# [1.44.0](https://github.com/JohnstonCode/svn-scm/compare/v1.43.0...v1.44.0) (2018-10-16)

### Features

- Added command Open Changes with PREV ([#378](https://github.com/JohnstonCode/svn-scm/issues/378)) ([9353d14](https://github.com/JohnstonCode/svn-scm/commit/9353d14))
