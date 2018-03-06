# s3commander

Web-based S3 file browser.

## Local Development

Install required tools.

```
npm install -g gulp-cli
```

Install project packages.

```
npm install
```

Run the development server.

```
gulp serve
```

## Vagrant Development

Spin up the Vagrant development box and SSH into it.

```
vagrant up
vagrant ssh
```

Navigate to the shared project folder and install project packages.

```
cd /vagrant
npm install
```

Run the development server.

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
