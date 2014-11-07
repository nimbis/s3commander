s3commander
===========

Web-based S3 file browser.

Requirements
------------

* Bootstrap 3.0.0+
* jQuery 2.0.0+

Quick Setup
-----------

Include the necessary scripts and stylesheets.

```html
<link rel="stylesheet" href="s3commander.css" />
<script src="sha1.js"></script>
<script src="s3commander.js"></script>
```

Create a ```<div />``` element to display the browser.

```html
<div id="s3commander"></div>
```

Initialize the browser.

```javascript
$(document).ready(function(){
    $("#s3commander").s3commander({
        sAccessKey: "...",
        sSecretKey: "...",
        sBucket: "bucketname",
        sPrefix: "/super/secure/stuff",
    });
})
```

Take a look at the included ```index.html``` file for a more complete example.

Quirks
------

* Folders are just S3 objects where the key ends in a trailing slash.
* Deleting a folder does not delete its contents. It will still appear in the
  browser as a folder until its contents are deleted.
* When not using Dropzone for drag-and-drop uploads, the directory contents will
  not automatically refresh after a file is uploaded. The user needs to click
  the refresh button manually.
