const path = require('path');
const gulp = require('gulp');
const gutil = require('gulp-util');

const tslint = require('gulp-tslint');
const gulpConf = require('../conf/gulp.conf');

gulp.task('tslint', done => {
  return gulp.src([path.join(gulpConf.paths.src, '/**/*.ts')])
    .pipe(tslint({
      formatter: "verbose"
    }))
    .pipe(tslint.report());
});
