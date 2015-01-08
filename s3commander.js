/**
* S3 Commander
*
* Version: 0.2.0
* Author: Alexandru Barbur
*/

// configure sha1.js for RFC compliance
b64pad = "=";

// isolate the jQuery API
(function($){
  "use strict";

  /************************************************************************
   * Utility                                                              *
   ************************************************************************/

  // Create a Path object.
  function Path(sPath, bFolder) {
    sPath = typeof sPath !== 'undefined' ? sPath : "";
    bFolder = typeof bFolder !== 'undefined' ? bFolder : false;

    this.parts = sPath.split("/");
    this.folder = bFolder;
    this.normalize();
  }

  // Normalize the path components.
  Path.prototype.normalize = function() {
    this.parts = this.parts.filter(function(part){
      return part.length > 0;
    });
  };

  // Get the string representation of the path.
  Path.prototype.toString = function() {
    var uri = this.parts.join("/");
    if (this.folder && this.parts.length > 0) {
      uri += "/";
    }

    return uri;
  };

  // Create a deep copy of this object and return it.
  Path.prototype.clone = function() {
    var other = new Path();
    other.parts = new Array(this.parts);
    other.folder = this.folder;

    return other;
  };

  // Check if the path has no components.
  Path.prototype.empty = function() {
    return this.parts.length == 0;
  };

  // Push one or more components to the end of the path.
  Path.prototype.push = function(sPath) {
    var newparts = sPath.split("/");
    Array.prototype.push.apply(this.parts, newparts);

    this.folder = (newparts.length > 0 && sPath.substr(-1) == "/");
    this.normalize();

    return this;
  };

  // Pop one component from the end of the path.
  Path.prototype.pop = function() {
    this.parts.pop();

    return this;
  };

  // Extend this path with another path.
  Path.prototype.extend = function(pOther) {
    this.parts = this.parts.concat(pOther.parts);
    this.folder = pOther.folder;
    this.normalize();

    return this;
  };

  // Get a copy of this path extended with the other path.
  Path.prototype.concat = function(pOther) {
    var result = new Path();
    result.parts = this.parts.concat(pOther.parts);
    result.folder = pOther.folder;

    return result;
  };

  /************************************************************************
   * Amazon S3 Backend                                                    *
   ************************************************************************/

  function S3Backend(options) {
    // resolve backend options
    this.opts = $.extend({
      "sAccessKey": "",
      "sSecretKey": "",
      "sBucket": "",
      "pPrefix": new Path("", true),
      "sEndpoint": "s3.amazonaws.com",
    }, options);
  }

  // Sign a string using an AWS secret key.
  S3Backend.prototype.sign = function(sSecretKey, sData) {
    return b64_hmac_sha1(sSecretKey, sData);
  };

  // Sign an Amazon AWS REST request.
  // http://docs.aws.amazon.com/AmazonS3/latest/dev/RESTAuthentication.html
  S3Backend.prototype.signRequest = function(sMethod, pResource, oParams) {
    // default parameter values
    sMethod = typeof sMethod !== 'undefined' ? sMethod : "GET";
    pResource = typeof pResource !== 'undefined' ? pResource : new Path();
    oParams = typeof oParams !== 'undefined' ? oParams : new Object();

    // this is used as the request and signature expiration timestamp
    // for convenince. the request timestamp must be within 15
    // minutes of the time on amazon's aws servers and the expiration
    // timestamp must be in the future so we add (XXX 6 hours ???)
    var timestamp = parseInt(new Date().valueOf() / 1000) + 21600;

    // create the signature plaintext
    var secure = sMethod + "\n\n\n";
    secure += timestamp + "\n";
    secure += "/" + this.opts.sBucket + "/";

    if (!pResource.empty()) {
      secure += this.opts.pPrefix.concat(pResource).toString();
    }

    var params = $.param(oParams);
    if (params.length > 0) {
      secure += "?" + params;
    }

    // return the query parameters required for this request
    return $.extend(oParams, {
      'AWSAccessKeyId': this.opts.sAccessKey,
      'Signature': sign(this.opts.sSecretKey, secure),
      'Expires': timestamp,
    });
  };

  // Retrieve the REST API URL for a bucket.
  S3Backend.prototype.getBucketURL = function() {
    // TODO we can't use https:// if the bucket name contains a '.' (dot)
    return "https://" + this.opts.sBucket + "." + this.opts.sEndpoint;
  };

  // Retrieve the REST API URL for the given resource.
  function getResourceURL(pResource) {
    var abspath = this.opts.pPrefix.concat(pResource);
    return this.getBucketURL() + "/" + abspath.toString();
  };

  // Get the encoded policy and it's signature required to upload files.
  S3Backend.prototype.getPolicyData = function() {
    // create the policy
    var policy = {
      "expiration": "2020-12-01T12:00:00.000Z",
      "conditions": [
        {"acl": "private"},
        {"bucket": this.opts.sBucket},
        ["starts-with", "$key", this.opts.pPrefix.toString()],
        ["starts-with", "$Content-Type", ""],
      ],
    };

    // encode the policy as Base64 and sign it
    var policy_b64 = rstr2b64(JSON.stringify(policy));
    var signature = this.sign(this.opts.sSecretKey, policy_b64);

    // return the policy and signature
    return {
      "acl": "private",
      "policy": policy_b64,
      "signature": signature,
    };
  };

  // Retrieve the contents of the given folder.
  // http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
  S3Backend.prototype.list = function(pFolder) {
    // default parameter values
    pFolder = typeof pFolder !== 'undefined' ? pFolder : new Path("", true);

    if (!pFolder.folder) {
      console.log("listContents(): not a folder: " + pFolder.toString());
      return;
    }

    // sign the request
    var signdata = signRequest("GET", new Path("", true));

    // determine the absolute folder path
    var abspath = this.opts.pPrefix.concat(pFolder);

    // request bucket contents with the absolute folder path as a prefix
    // and group results into common prefixes using a delimiter
    return $.ajax({
      url: this.getBucketURL(),
      data: $.extend(signdata, {
        "prefix": abspath.toString(),
        "delimiter": "/",
      }),
      dataFormat: "xml",
      cache: false,
      error: function(data){
        console.log("S3Backend error:" + data.responseText);
      },
    }).then(function(data){
      // XXX ugh, how can we make this cleaner?
      var files = $(data).find("ListBucketResult > Contents > Key");
      var folders = $(data).find("ListBucketResult > CommonPrefixes > Prefix");

      function extract(e){
        var relpath = e.innerHTML.substr(fullpath.length);
        return new Path(relpath).toString();
      }

      function keep(e){
        return e.length > 0;
      }

      return {
        "path": pLocation,
        "files": $.map(files, extract).filter(keep),
        "folders": $.map(folders, extract).filter(keep),
      };
    });
  };

  // Create a folder with the given path. Folders are S3 objects where
  // the key ends in a trailing slash.
  S3Backend.prototype.createFolder = function(pResource) {
    if (!pResource.folder) {
      console.log("createFolder(): not a folder: " + pResource.toString());
      return;
    }

    var signdata = this.signRequest("PUT", pResource);
    var url = this.getResourceURL(pResource) + "?" + $.param(signdata);

    return $.ajax({
      url: url,
      type: "PUT",
      data: "",
      error: function(data){
        console.log("S3Backend error: " + data.responseText);
      }
    });
  };

  // Delete the folder at the given path. Folders are S3 objects where
  // the key ends in a trailing slash.
  S3Backend.prototype.deleteFolder = function(pResource) {
    if (!pResource.folder) {
      console.log("deleteFolder(): not a folder: " + pResource.toString());
      return;
    }

    var signdata = this.signRequest("DELETE", pResource);
    var url = this.getResourceURL(pResource) + "?" + $.param(signdata);

    return $.ajax({
      url: url,
      type: "DELETE",
      error: function(data){
        console.log("S3Backend error: " + data.responseText);
      },
    });
  };

  // Download the file at the given path. This creates a link to download
  // the file using the user's AWS credentials then opens it in a new window.
  // http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectGET.html
  S3Backend.prototype.downloadFile = function(pResource) {
    if (pResource.folder) {
      console.log("downloadFile(): not a file: " + pResource.toString());
      return;
    }

    var signdata = this.signRequest("GET", pResource, {
      'response-cache-control': 'No-cache',
      'response-content-disposition': 'attachment'
    });

    var url = this.getResourceUrl(pResource) + "?" + $.param(signdata);
    window.open(url, "_blank");
  };

  // Delete the file at the given path.
  // http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectDELETE.html
  S3Backend.prototype.deleteFile = function(pResource) {
    if (pResource.folder) {
      console.log("deleteFile(): not a file: " + pResource.toString());
      return;
    }

    var signdata = this.signRequest("DELETE", pResource);
    var url = this.getResourceUrl(pResource) + "?" + $.param(signdata);

    return $.ajax({
      url: url,
      type: "DELETE",
      error: function(data){
        console.log("S3Backend error: " + data.responseText);
      },
    });
  };

  /************************************************************************
   * User Interface                                                       *
   ************************************************************************/

  var S3CBreadcrumbs = React.createClass({
    "displayName": "S3CBreadcrumbs",
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.crumbs},
        React.createElement("span", {"className": "glyphicon glyphicon-hdd"}),
        $.map(this.props.data.parts, function(part, i){
            return [
              React.createElement("span", {"key": "sep-" + i}, "/"),
              React.createElement("span", {"key": "crumb-" + i}, part),
            ];
        }),
        React.createElement(
          "button",
          {"className": this.props.style.button},
          "Refresh"),
        React.createElement(
          "button",
          {"className": this.props.style.button},
          "Up")
      );
    },
  });

  var S3CFolder = React.createClass({
    "displayName": "S3CFolder",
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.entry},
        React.createElement(
          "span",
          {"className": "glyphicon glyphicon-folder-open"}),
        React.createElement("a", {}, this.props.data.name),
        React.createElement(
          "button",
          {"className": this.props.style.button},
          "Delete")
      );
    },
  });

  var S3CFile = React.createClass({
    "displayName": "S3CFile",
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.entry},
        React.createElement(
          "span",
          {"className": "glyphicon glyphicon-file"}),
        React.createElement("a", {}, this.props.data.name),
        React.createElement(
          "button",
          {"className": this.props.style.button},
          "Delete")
      );
    },
  });

  var S3CFolderForm = React.createClass({
    "displayName": "S3CFolderForm",
    "render": function(){
      return React.createElement(
        "form",
        {
          "className": this.props.style.form,
          "method": "post",
          "encType": "multipart/form-data"
        },
        React.createElement(
          "div",
          {"className": "form-group"},
          React.createElement(
            "input",
            {"type": "text", "className": "form-control"})),
        React.createElement(
          "button",
          {"type": "submit", "className": this.props.style.button},
          "Create")
      );
    },
  });

  var S3Commander = React.createClass({
    "displayName": "S3Commander",
    "getInitialState": function(){
      return {
        "path": new Path("a/b/c", true),
        "files": new Array({"name": "foo"}, {"name": "bar"}),
        "folders": new Array({"name": "test"}),
      };
    },
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.container},
        React.createElement(
          S3CBreadcrumbs,
          {"data": this.state.path, "style": this.props.style}),
        $.map(this.state.folders, function(folder){
          return React.createElement(
            S3CFolder,
            {"data": folder, "key": folder.name, "style": this.props.style});
        }.bind(this)),
        $.map(this.state.files, function(file){
          return React.createElement(
            S3CFile,
            {"data": file, "key": file.name, "style": this.props.style});
        }.bind(this)),
        React.createElement(S3CFolderForm, {"style": this.props.style})
      );
    },
  });

  /************************************************************************
   * jQuery Integration                                                   *
   ************************************************************************/

  // create an s3commander window
  $.fn.s3commander = function(options) {
    // resolve component options
    var opts = $.extend({}, $.fn.s3commander.defaults, options)

    // create the backend
    var backend = new S3Backend({
      "sAccessKey": opts.sAccessKey,
      "sSecretKey": opts.sSecretKey,
      "sBucket": opts.sBucket,
      "pPrefix": new Path(opts.sPrefix, true),
      "sEndpoint": opts.sEndpoint,
    });

    // create the react element
    var container = $(this);
    React.render(
      React.createElement(S3Commander, {
        "backend": backend,
        "style": {
          "container": opts.containerClasses.join(" "),
          "crumbs": opts.breadcrumbClasses.join(" "),
          "entry": opts.entryClasses.join(" "),
          "form": opts.formClasses.join(" "),
          "button": opts.buttonClasses.join(" "),
        },
      }),
      container.get(0));

    // return the container
    return $(this);
  };

  // default settings
  $.fn.s3commander.defaults = {
    "sAccessKey": "",
    "sSecretKey": "",
    "sBucket": "",
    "sPrefix": "",
    "sEndpoint": "s3.amazonaws.com",
    "containerClasses": ["s3contents"],
    "breadcrumbClasses": ["s3crumbs"],
    "entryClasses": ["s3entry"],
    "formClasses": ["s3form", "form-inline"],
    "buttonClasses": ["btn", "btn-xs", "btn-primary", "pull-right"],
  };

  /************************************************************************
  * Debug                                                                *
  ************************************************************************/

  // export objects
  window.Path = Path;

}(jQuery));
