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
    other.parts = this.parts.slice();
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

  // Make this path relative to the given one.
  // Ex: new Path("foo/bar/xyz").rebase(new Path("foo")).toString() -> "bar/xyz"
  Path.prototype.rebase = function(pOther) {
    var index = 0;
    while(index < pOther.parts.length) {
      if(this.parts[0] == pOther.parts[index]) {
        this.parts.shift();
        index++;
      }
      else {
        break;
      }
    }

    return this;
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
    return $.extend({}, oParams, {
      'AWSAccessKeyId': this.opts.sAccessKey,
      'Signature': this.sign(this.opts.sSecretKey, secure),
      'Expires': timestamp,
    });
  };

  // Retrieve the REST API URL for a bucket.
  S3Backend.prototype.getBucketURL = function() {
    // TODO we can't use https:// if the bucket name contains a '.' (dot)
    return "https://" + this.opts.sBucket + "." + this.opts.sEndpoint;
  };

  // Retrieve the REST API URL for the given resource.
  S3Backend.prototype.getResourceURL = function(pResource) {
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

  // Get form parameters for uploading a file to the given folder.
  // The paramters returned by this function should be stored in a <form />
  // element using <input type="hidden" name="..." value="..." /> elements.
  S3Backend.prototype.getUploadParams = function(pFolder) {
    var uploadpath = this.opts.pPrefix.concat(pFolder).push("${filename}");
    return $.extend(this.getPolicyData(), {
      "AWSAccessKeyId": this.opts.sAccessKey,
      "Content-Type": "application/octet-stream",
      "key": uploadpath.toString()
    });
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
    var signdata = this.signRequest("GET", new Path("", true));

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
      // extract folders
      var folders = $.map(
        $(data).find("ListBucketResult > CommonPrefixes > Prefix"),
        function(d){
          // we always treat common prefixes as folders so force it in the path
          var path = new Path(d.innerHTML, true);
          var name = path.clone().rebase(pFolder).toString();
          return {"name": name, "path": path};
        });

      // extract files
      var files = $.map(
        $(data).find("ListBucketResult > Contents > Key"),
        function(d){
          // this could be a folder or a file depending on whether the key
          // has a trailing slash at the end, detect it using push() and
          // ignore folder keys
          var path = new Path().push(d.innerHTML);
          if (path.folder) {
            return;
          }

          var name = path.clone().rebase(pFolder).toString();
          return {"name": name, "path": path};
        });

      // return directory contents
      return {"path": pFolder, "files": files, "folders": folders};
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

    var url = this.getResourceURL(pResource) + "?" + $.param(signdata);
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
    var url = this.getResourceURL(pResource) + "?" + $.param(signdata);

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

        // disk icon
        React.createElement("span", {"className": "glyphicon glyphicon-hdd"}),

        // bread crumbs
        React.createElement("span", {"key": "sep-root"}, "/"),
        $.map(this.props.data.parts, function(part, i){
            return [
              React.createElement("span", {"key": "crumb-" + i}, part),
              React.createElement("span", {"key": "sep-" + i}, "/"),
            ];
        }),

        // buttons
        React.createElement(
          "button",
          {
            "className": this.props.style.button,
            "onClick": this.props.onRefresh
          },
          "Refresh"),
        React.createElement(
          "button",
          {
            "className": this.props.style.button,
            "onClick": this.props.onNavUp
          },
          "Up")
      );
    },
  });

  var S3CFolder = React.createClass({
    "displayName": "S3CFolder",
    "onNav": function(e){
      this.props.onNavFolder(this.props.data);
    },
    "onDelete": function(e){
      this.props.onDeleteFolder(this.props.data);
    },
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.entry},
        React.createElement(
          "span",
          {"className": "glyphicon glyphicon-folder-open"}),
        React.createElement(
          "a",
          {"onClick": this.onNav},
          this.props.data.name),
        React.createElement(
          "button",
          {
            "className": this.props.style.button,
            "onClick": this.onDelete
          },
          "Delete")
      );
    },
  });

  var S3CFile = React.createClass({
    "displayName": "S3CFile",
    "onDownload": function(e){
      this.props.onDownloadFile(this.props.data);
    },
    "onDelete": function(e){
      this.props.onDeleteFile(this.props.data);
    },
    "render": function(){
      return React.createElement(
        "div",
        {"className": this.props.style.entry},
        React.createElement(
          "span",
          {"className": "glyphicon glyphicon-file"}),
        React.createElement(
          "a",
          {"onClick": this.onDownload},
          this.props.data.name),
        React.createElement(
          "button",
          {
            "className": this.props.style.button,
            "onClick": this.onDelete
          },
          "Delete")
      );
    },
  });

  var S3CFolderForm = React.createClass({
    "displayName": "S3CFolderForm",
    "onCreate": function(e){
      e.preventDefault();
      var name = this.refs.name.getDOMNode().value;
      this.props.onCreateFolder(name);
    },
    "render": function(){
      return React.createElement(
        // form
        "form",
        {
          "className": this.props.style.form,
          "method": "post",
          "encType": "multipart/form-data"
        },

        // inputs
        React.createElement(
          "div",
          {"className": "form-group"},
          React.createElement(
            "input",
            {
              "type": "text",
              "className": "form-control",
              "ref": "name"
            })),

        // controls
        React.createElement(
          "button",
          {
            "type": "submit",
            "className": this.props.style.button,
            "onClick": this.onCreate
          },
          "Create")
      );
    },
  });

  var S3CUploadForm = React.createClass({
    "displayName": "S3CUploadForm",
    "render": function(){
      return React.createElement(
        // form
        "form",
        {
          "className": this.props.style.form,
          "method": "post",
          "encType": "multipart/form-data",
          "action": this.props.url
        },

        // backend parameters
        $.map(this.props.params, function(value, name){
          return React.createElement(
            "input",
            {
              "type": "hidden",
              "name": name,
              "value": value,
              "key": "param-" + name
            });
        }),

        // inputs
        React.createElement(
          "div",
          {"className": "form-group"},
          React.createElement(
            "input",
            {
              "type": "file",
              "name": "file"
            })),

        // controls
        React.createElement(
          "button",
          {
            "type": "submit",
            "className": this.props.style.button
          },
          "Upload")
      );
    },
  });

  var S3CUploadDropzone = React.createClass({
    "displayName": "S3CUploadDropzone",
    "componentDidMount": function(){
      // create the dropzone object
      var component = this;
      this.dropzone = new Dropzone(this.getDOMNode(), {
        "url": this.props.url,
        "error": function(file, error){
          alert("uh-oh");
        },
        "complete": function(file){
          // remove the file from dropzone
          this.removeFile(file);

          // refresh the screen
          component.props.onRefresh();
        }
      });
    },
    "componentWillUnmount": function(){
      // destroy the dropzone
      this.dropzone.destroy();
      this.dropzone = null;
    },
    "render": function(){
      return React.createElement(
        // form
        "form",
        {
          "className": this.props.style.form + " dropzone",
          "method": "post",
          "encType": "multipart/form-data",
          "action": this.props.url
        },

        // backend parameters
        $.map(this.props.params, function(value, name){
          return React.createElement(
            "input",
            {
              "type": "hidden",
              "name": name,
              "value": value,
              "key": "param-" + name
            });
        })
      );
    },
  });

  var S3Commander = React.createClass({
    "displayName": "S3Commander",
    "getInitialState": function(){
      return {
        "path": new Path("", true),
        "files": new Array(),
        "folders": new Array(),
      };
    },
    "getDefaultProps": function(){
      return {
        "style": {
          "container": "s3contents",
          "crumbs": "s3crumbs",
          "entry": "s3entry",
          "form": "s3form form-inline",
          "button": "btn btn-xs btn-primary pull-right",
        },
      };
    },
    "componentDidMount": function(){
      this.props.backend.list()
        .done(function(contents){
          this.setState(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onNavUp": function(){
      var path = this.state.path.pop();
      this.props.backend.list(path)
        .done(function(contents){
          this.setState(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onRefresh": function(){
      var path = this.state.path;
      this.props.backend.list(path)
        .done(function(contents){
          this.setState(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onNavFolder": function(folder){
      var path = this.state.path.push(folder.name + "/");
      this.props.backend.list(path)
        .done(function(contents){
          this.setState(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onCreateFolder": function(name){
      // TODO valdiate name

      var folder = this.state.path.clone().push(name + "/");
      this.props.backend.createFolder(folder)
        .done(function(){
          this.onRefresh();
        }.bind(this))
        .fail(function(){
          alert("failed to create folder");
        }.bind(this));
    },
    "onDeleteFolder": function(folder){
      this.props.backend.deleteFolder(folder.path)
        .done(function(){
          this.onRefresh();
        }.bind(this))
        .fail(function(){
          alert("failed to delete folder");
        }.bind(this));
    },
    "onDownloadFile": function(file){
      this.props.backend.downloadFile(file.path);
    },
    "onDeleteFile": function(file){
      this.props.backend.deleteFile(file.path)
        .done(function(){
          this.onRefresh();
        }.bind(this))
        .fail(function(){
          alert("failed to delete file");
        }.bind(this));
    },
    "render": function(){
      // determine common properties
      var props = {
        "style": this.props.style,
        "onNavUp": this.onNavUp,
        "onRefresh": this.onRefresh,
        "onNavFolder": this.onNavFolder,
        "onCreateFolder": this.onCreateFolder,
        "onDeleteFolder": this.onDeleteFolder,
        "onDownloadFile": this.onDownloadFile,
        "onDeleteFile": this.onDeleteFile,
      };

      // create and return elements
      return React.createElement(
        "div",
        {"className": this.props.style.container},

        // breadcrumbs
        React.createElement(
          S3CBreadcrumbs,
          $.extend({
            "data": this.state.path
          }, props)),

        // folders
        $.map(this.state.folders, function(folder){
          return React.createElement(
            S3CFolder,
            $.extend({
              "data": folder,
              "key": "folder-" + folder.name
            }, props));
        }),

        // files
        $.map(this.state.files, function(file){
          return React.createElement(
            S3CFile,
            $.extend({
              "data": file,
              "key": "file-" + file.name
            }, props));
        }),

        // controls
        React.createElement(S3CFolderForm, props),
        React.createElement(
          typeof window.Dropzone === 'undefined' ? S3CUploadForm : S3CUploadDropzone,
          $.extend({
            "url": this.props.backend.getBucketURL(),
            "params": this.props.backend.getUploadParams(this.state.path),
          }, props))
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
    opts["backend"] = new S3Backend({
      "sAccessKey": opts.sAccessKey,
      "sSecretKey": opts.sSecretKey,
      "sBucket": opts.sBucket,
      "pPrefix": new Path(opts.sPrefix, true),
      "sEndpoint": opts.sEndpoint,
    });

    // create the react element and attach it to the container
    var container = $(this);
    React.render(
      React.createElement(S3Commander, opts),
      container.get(0));

    // return the container
    return container;
  };

  // default settings
  $.fn.s3commander.defaults = {
    "sAccessKey": "",
    "sSecretKey": "",
    "sBucket": "",
    "sPrefix": "",
    "sEndpoint": "s3.amazonaws.com",
  };

  /************************************************************************
  * Debug                                                                *
  ************************************************************************/

  // export objects
  window.Path = Path;

}(jQuery));
