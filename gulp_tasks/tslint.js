const path = require('path');
const gulp = require('gulp');
const gutil = require('gulp-util');

const tslint = require('tslint');
const gtslint = require('gulp-tslint');

const conf = require('../conf/gulp.conf');

gulp.task('tslint', done => {
  // https://palantir.github.io/tslint/usage/type-checking/
  let program = tslint.Linter.createProgram('./tslint.json', conf.paths.src);
  return gulp.src(path.join(conf.paths.src, '/**/*.ts'))
    .pipe(gtslint({
      configuration: "tslint.json",
      formatter: "stylish",
      program: program
    }))
    .pipe(gtslint.report({
      allowWarnings: true,
      emitError: false
    }));
});
