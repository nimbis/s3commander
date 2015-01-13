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

  // TODO
  Path.prototype.basename = function(){
    if (this.parts.length == 0) {
      return undefined;
    }

    return this.parts[this.parts.length - 1];
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
      "bShowVersions": false,
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

    var delimiter = "?";
    if (this.opts.bShowVersions && sMethod == "GET" && pResource.folder) {
      secure += "?versions";
      delimiter = "&";
    }

    var params = $.param(oParams);
    if (params.length > 0) {
      secure += delimiter + params;
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
    // we can't use https:// if the bucket name contains a '.' (dot)
    // because the SSL certificates won't work
    var protocol = "https";
    if (this.opts.sBucket.indexOf(".") !== -1) {
      protocol = "http";
      console.log("WARNING: Using clear-text transport protocol http:// !");
    }

    // construct the url
    return protocol + "://" + this.opts.sBucket + "." + this.opts.sEndpoint;
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
      url: this.getBucketURL() + (this.opts.bShowVersions ? "?versions" : ""),
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
      // TODO
      if (this.opts.bShowVersions) {
        var query = {
          "folder": "ListVersionsResult > CommonPrefixes > Prefix",
          "file": "ListVersionsResult > Version",
          "delete": "ListVersionsResult > DeleteMarker"
        };
      }
      else {
        var query = {
          "folder": "ListBucketResult > CommonPrefixes > Prefix",
          "file": "ListBucketResult > Contents"
        };
      }

      // extract folders
      var folders = new Object();
      $.each(
        $(data).find(query.folder),
        function(i, item){
          // we treat common prefixes as folders even though technically they
          // are a side effect of the keys that actually represent folders
          var path = new Path($(item).text(), true);
          folders[path] = {
            "path": path,
            "name": path.basename(),
          };
        });

      // extract files
      var files = new Object();
      $.each(
        $(data).find(query.file),
        function(i, item){
          // this could be a file or a folder depending on the key
          var path = new Path().push($(item).find("Key").text());
          if (path.folder) {
            // ignore folders
            return;
          }

          // get or create the file entry
          var entry = path in files ? files[path] : {
            "path": path,
            "name": path.basename(),
            "versions": new Array(),
          };

          // store the version information
          if (this.opts.bShowVersions) {
            entry.versions.push({
              "version": $(item).find("VersionId").text(),
              "modified": $(item).find("LastModified").text(),
            });
          }

          // store the file entry
          files[path] = entry;
        }.bind(this));

      // delete markers
      if (this.opts.bShowVersions) {
        $.each(
          $(data).find(query.delete),
          function(i, item){
            // this could be a file or a folder depending on the key name
            var path = new Path().push($(item).find("Key").text());
            if (path.folder) {
              // ignore folders
              return;
            }

            // update the file's version information
            files[path].versions.push({
              "deleted": true,
              "version": $(item).find("VersionId").text(),
              "modified": $(item).find("LastModified").text(),
            });
          });
      }

      // return directory contents
      return {
        "path": pFolder,
        "files": files,
        "folders": folders,
      };
    }.bind(this));
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
    "render": function(){
      var crumbs = $.map(this.props.data.parts, function(part, i){
        return (
          <span key="crumb-{i}">{part} /</span>
        );
      });

      return (
        <div className={this.props.style.crumbs}>
          <span className="glyphicon glyphicon-hdd"></span>
          <span>/</span>
          {crumbs}
          <button
            className={this.props.style.button}
            onClick={this.props.onRefresh}>Refresh</button>
          <button
            className={this.props.style.button}
            onClick={this.props.onNavUp}>Up</button>
        </div>
      );
    },
  });

  var S3CFolder = React.createClass({
    "onNav": function(e){
      this.props.onNavFolder(this.props.data);
    },
    "onDelete": function(e){
      this.props.onDeleteFolder(this.props.data);
    },
    "render": function(){
      return (
        <div className={this.props.style.entry}>
          <span className="glyphicon glyphicon-folder-open"></span>
          <a onClick={this.onNav}>{this.props.data.name}</a>
          <button
            className={this.props.style.button}
            onClick={this.onDelete}>Delete</button>
        </div>
      );
    },
  });

  var S3CFile = React.createClass({
    "onDownload": function(e){
      this.props.onDownloadFile(this.props.data);
    },
    "onDelete": function(e){
      this.props.onDeleteFile(this.props.data);
    },
    "render": function(){
      return (
        <div className={this.props.style.entry}>
          <span className="glyphicon glyphicon-file"></span>
          <a onClick={this.onDownload}>{this.props.data.name}</a>
          <button
            className={this.props.style.button}
            onClick={this.onDelete}>Delete</button>
        </div>
      );
    },
  });

  var S3CFolderForm = React.createClass({
    "onCreate": function(e){
      e.preventDefault();
      var name = this.refs.name.getDOMNode().value;
      this.props.onCreateFolder(name);
    },
    "render": function(){
      return (
        <form className={this.props.style.form}>
          <div className="form-group">
            <input type="text" className="form-control" ref="name" />
          </div>

          <button
            type="submit"
            className={this.props.style.button}
            onClick={this.onCreate}>Create</button>
        </form>
      );
    },
  });

  var S3CUploadForm = React.createClass({
    "componentWillMount": function(){
      // detect if we have dropzone support
      this.useDropzone = (typeof window.Dropzone !== 'undefined');
    },
    "componentDidMount": function(){
      // check if we're using dropzone
      if (!this.useDropzone) {
        // do nothing
        return;
      }

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
      // check if we're using dropzone
      if (!this.useDropzone) {
        // do nothing
        return;
      }

      // destroy the dropzone
      this.dropzone.destroy();
      this.dropzone = null;
    },
    "render": function(){
      // amazon upload parameters
      var params = $.map(this.props.params, function(value, name){
        var key = "param-" + name;
        return (
          <input type="hidden" name={name} value={value} key={key} />
        );
      });

      // form properties
      var formprops = {
        "className": this.props.style.form,
        "encType": "multipart/form-data",
        "action": this.props.url,
        "method": "post"
      };

      if (this.useDropzone) {
        formprops["className"] += " dropzone";
      }

      // create components
      return (
        <form {...formprops}>
          {params}

          {this.useDropzone ? undefined : (
          <div className="form-group">
            <input type="file" name="file" />
          </div>
          )}

          {this.useDropzone ? undefined : (
          <button type="submit" className={this.props.style.button}>
            Upload
          </button>
          )}
        </form>
      );
    },
  });

  var S3Commander = React.createClass({
    "getInitialState": function(){
      return {
        "path": new Path("", true),
        "files": new Object(),
        "folders": new Object(),
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

      // folders
      var folders = $.map(this.state.folders, function(folder){
        var key = "folder-" + folder.name;
        return (
          <S3CFolder {...props} data={folder} key={key} />
        );
      });

      // files
      var files = $.map(this.state.files, function(file){
        var key = "file-" + file.name;
        return (
          <S3CFile {...props} data={file} key={key} />
        );
      });

      // upload control properties
      var uploadprops = $.extend({}, props, {
        "url": this.props.backend.getBucketURL(),
        "params": this.props.backend.getUploadParams(this.state.path)
      });

      // create the root element
      return (
        <div className={this.props.style.container}>
          <S3CBreadcrumbs {...props} data={this.state.path} />
          {folders}
          {files}
          <S3CFolderForm {...props} />
          <S3CUploadForm {...uploadprops} />
        </div>
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
      "bShowVersions": opts.bShowVersions,
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
    "bShowVersions": false,
  };

  /************************************************************************
  * Debug                                                                *
  ************************************************************************/

  // export objects
  window.Path = Path;

}(jQuery));
