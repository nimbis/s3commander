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
