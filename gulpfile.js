const gulp = require('gulp');
const path = require('path');
const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const es = require('event-stream');
const vsce = require('vsce');
const nls = require('vscode-nls-dev');

const tsProject = ts.createProject('./tsconfig.json', {typescript});

const inlineMap = true;
const inlineSource = false;
const outDest = 'out';

const languages = [
    { folderName: 'zh-CN', id: 'zh-CN' },
    { folderNasme: 'pt-br', id: 'pt-br' }
];

const cleanTask = function() {
    return del(['out/**', 'package.nls.*.json', '*.vsix']);
}

const internalCompileTask = function() {
    return doCompile(false);
}

const internalNlsCompileTask = function() {
    return doCompile(true);
}

const addI18nTask = function() {
    return gulp.src(['package.nls.json'])
        .pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
        .pipe(gulp.dest('.'));
}

const buildTask = gulp.series(cleanTask, internalNlsCompileTask, addI18nTask);

const doCompile = function(buildNls) {
    var r = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject()).js
        .pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
        .pipe(buildNls ? nls.createAdditionalLanguageFiles(languages, 'i18n', 'out') : es.through());

    if (inlineMap && inlineSource) {
        r = r.pipe(sourcemaps.write());
    } else {
        r = r.pipe(sourcemaps.write("../out", {
            includeContent: inlineSource,
            sourceRoot: "../src"
        }));
    }

    return r.pipe(gulp.dest(outDest));
}

const vscePublishTask = function() {
    return vsce.publish();
}

const vscePackageTask = function() {
    return vsce.createVSIX();
}

gulp.task('default', buildTask);
gulp.task('clean', cleanTask);
gulp.task('compile', gulp.series(cleanTask, internalCompileTask));
gulp.task('build', buildTask);
gulp.task('publish', gulp.series(buildTask, vscePublishTask));
gulp.task('package', gulp.series(buildTask, vscePackageTask));
