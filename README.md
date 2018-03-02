# s3commander

Web-based S3 file browser.

## Quick Start

Install required tools.

```
npm install -g gulp-cli
```

Install project packages.

```
npm install
```

Serve the development version of the application and reload as necessary.

```
gulp serve
```

## Build

Create a release build.

```
gulp build
```

## Testing

Run the TypeScript linter.

```
gulp tslint
```

## Quirks

* The HTML file upload functionality uses an HTTPS API endpoint based on the bucket name (i.e. `https://<bucket>s3.amazonaws.com`). If the bucket name has dots (`.`) in the name this will fail because you can't use HTTPS with subdomains.

## References

* Tools
  * [Yeoman](http://yeoman.io/)
  * [Yeoman FountainJS Generator](http://fountainjs.io/)
* Frameworks and Libraries
  * [TypeScript](https://www.typescriptlang.org)
  * [AngularJS](https://angularjs.org/)
  * https://github.com/toddmotto/angularjs-styleguide
  * https://ivision.com/wp-content/uploads/AngularJS_v2.pdf
  * https://codepen.io/martinmcwhorter/post/angularjs-1-x-with-typescript-or-es6-best-practices
* Amazon S3
  * [REST API](https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
