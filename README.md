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

## Backends

* AWS S3
* (Planned) Backblaze B2

### AWS S3

When you're working with AWS S3 buckets you need to configure an appropriate CORS policy. The one provided below is useful for development because it allows all requests from anywhere but you will want to use something different in production.

```
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
<CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
    <ExposeHeader>ETag</ExposeHeader>
    <AllowedHeader>*</AllowedHeader>
</CORSRule>
</CORSConfiguration>
```

AWS recommends configuring the bucket with a lifecycle rule to abort incomplete multipart uploads.  This will minimize your storage costs by removing the data for incomplete multipart uploads that may have been interrupted.

The HTML file upload functionality uses an HTTPS API endpoint based on the bucket name (i.e. `https://<bucket>s3.amazonaws.com`). If the bucket name has dots (`.`) in the name this will fail because you can't use HTTPS with subdomains.

## Styling

The following HTML classes are made available alongside file types if you wish
to style them in your own application with a library like
[FontAwesome](https://fontawesome.com/):

* Folders: `s3c-folder-icon`
* Delete markers: `s3c-delete-icon`
* Version markers: `s3c-version-icon`

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
