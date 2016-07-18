/**
* S3 Commander
*
* Version: 0.3.10
* Authors: Alexandru Barbur, Eric Amador, Shaun Brady, Dean Kiourtsis,
*          Mike Liu, Brian Schott
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

  // Get the last component of the path if available.
  Path.prototype.basename = function(){
    if (this.parts.length == 0) {
      return undefined;
    }

    return this.parts[this.parts.length - 1];
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

  // Get the URI encoded string representation of the path.
  Path.prototype.getURIEncoded = function() {
    // We want to encode the parts, but not the whole
    var enc_parts = this.parts.map(function(val) {
        return encodeURIComponent(val);
    });

    var uri = enc_parts.join("/");
    if (this.folder && this.parts.length > 0) {
      uri += "/";
    }

    return uri;
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
      "iMaxFilesizeMB": 1024
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
      secure += this.opts.pPrefix.concat(pResource).getURIEncoded();
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
    return this.getBucketURL() + "/" + abspath.getURIEncoded();
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
      // store prefix so we can rebase paths further down
      var prefix = this.opts.pPrefix;

      // decide how to parse the results
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
            "path": path.rebase(prefix),
            "name": path.basename(),
          };
        });

      // extract files
      var files = new Object();
      $.each(
        $(data).find(query.file),
        function(i, item){
          // this could be a file or a folder depending on the key
          var path = new Path().push(
            $(item).find("Key").text()
          ).rebase(prefix);

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
              "deleted": false,
              "version": $(item).find("VersionId").text(),
              "modified": new Date($(item).find("LastModified").text()),
            });
          }

          // store the file entry
          files[path] = entry;
        }.bind(this));

      // delete markers
      if (this.opts.bShowVersions) {
        $.each(
          $(data).find(query["delete"]),
          function(i, item){
            // this could be a file or a folder depending on the key name
            var path = new Path().push(
              $(item).find("Key").text()
            ).rebase(prefix);

            if (path.folder) {
              // ignore folders
              return;
            }

            // update the file's version information
            files[path].versions.push({
              "deleted": true,
              "version": $(item).find("VersionId").text(),
              "modified": new Date($(item).find("LastModified").text()),
            });
          });
      }

      // sort file versions
      if (this.opts.bShowVersions) {
        $.each(files, function(path, entry){
          entry.versions.sort(function(a, b){
            var am = a.modified;
            var bm = b.modified;

            if (am < bm){
              return -1;
            }
            else if (am > bm) {
              return 1;
            }
            else {
              return 0;
            }
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
  S3Backend.prototype.downloadFile = function(pResource, sVersion) {
    sVersion = typeof sVersion !== 'undefined' ? sVersion : "";
    if (pResource.folder) {
      console.log("downloadFile(): not a file: " + pResource.toString());
      return;
    }

    var params = {
      'response-cache-control': 'No-cache',
      'response-content-disposition': 'attachment',
    };

    if (sVersion.length > 0) {
      params["versionId"] = sVersion;
      // params["response-content-disposition"] += "; filename=FOO_VERSION"
    }

    var signdata = this.signRequest("GET", pResource, params);
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
        var key = "crumb-" + i;
        return (
          <span key={key}>{part} /</span>
        );
      });

      return (
        <div className={this.props.style.control}>
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

  var S3COptionsControl = React.createClass({
    "componentDidMount": function(){
      $(this.getDOMNode())
        .find("#chkShowDeleted")
        .bootstrapToggle({
          "size": "mini",
          "on": "On <span class='glyphicon glyphicon-asterisk'></span>&nbsp;",
        })
        .on('change', this.onShowDeletedChange);
    },
    "onShowDeletedChange": function(e){
      this.props.setStateOptions({
        "showDeletedFiles": $("#chkShowDeleted").prop("checked"),
      });
    },
    "render": function(){
      return (
        <div className={this.props.style.control}>
          <span>Show Deleted Files</span>
          <input
            type="checkbox"
            id="chkShowDeleted"
            defaultChecked={this.props.options.showDeletedFiles ? "checked" : ""} />
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

  var S3CFileVersion = React.createClass({
    "onDownload": function(e){
      this.props.onDownloadVersion(this.props.data);
    },
    "render": function(){
      var data = this.props.data;
      var props = {
        "className": this.props.style.entry,
        "key": this.props.key
      };

      return data.deleted ? (
        <div {...props}>
          <span className="glyphicon glyphicon-trash"></span>
          <span>{data.modified.toString()}</span>
        </div>
      ) : (
        <div {...props}>
          <span className="glyphicon glyphicon-time"></span>
          <a onClick={this.onDownload}>{data.modified.toString()}</a>
        </div>
      );
    },
  });

  var S3CFile = React.createClass({
    "getInitialState": function(){
      return {
        "showVersions": false
      };
    },
    "getLatestVersion": function(){
      var versions = this.props.data.versions;
      if (versions.length == 0) {
        return undefined;
      }

      return versions[versions.length - 1];
    },
    "onDownload": function(e){
      this.props.onDownloadFile(this.props.data);
    },
    "onDelete": function(e){
      this.props.onDeleteFile(this.props.data);
    },
    "onToggleVersions": function(e){
      this.setState({
        "showVersions": !this.state.showVersions
      });
    },
    "onDownloadVersion": function(entry){
      this.props.onDownloadFileVersion(this.props.data, entry.version);
    },
    "render": function(){
      var file = this.props.data;

      // file versions
      var versions = $.map(file.versions, function(entry){
        var props = {
          "data": entry,
          "style": this.props.style,
          "onDownloadVersion": this.onDownloadVersion,
          "key": "file-" + file.name + "-" + entry.version
        };

        return (
          <S3CFileVersion {...props} />
        );
      }.bind(this));

      // file control
      return (
        <div className={this.props.style.entry}>
          <span
            onClick={this.onDownload}
            className="s3icon glyphicon glyphicon-file">
          </span>
          <a
            className={this.props.style.link}
            onClick={this.onDownload}>{file.name}
          </a>

          {versions.length > 0 && this.getLatestVersion().deleted ? (
          <span className="glyphicon glyphicon-asterisk"></span>
          ) : (
          <button
            className={this.props.style.button}
            onClick={this.onDelete}>Delete</button>
          )}

          {versions.length > 0 ? (
          <button
            className={this.props.style.button}
            onClick={this.onToggleVersions}>Versions</button>
          ) : undefined}

          {this.state.showVersions ? versions : undefined}
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
        "init": function(){
          // enable uploading to folders by manipulating the S3 object key
          // TODO this is S3 specific and violates the backend/frontend barrier
          this.on("sending", function(file, xhr, formData){
            if(file.hasOwnProperty("fullPath")) {
              formData.append("key", new Path(component.props.params.key)
                .pop()                  // pop original ${filename} token
                .push(file.fullPath)    // push full path to the file
                .pop()                  // pop filename component
                .push("${filename}")    // push the S3 ${filename} token
                .toString());
            }
            else {
              formData.append("key", component.props.params.key);
            }
          });
        },
        "error": function(file, error){
          alert(error);
        },
        "complete": function(file){
          // remove the file from dropzone
          this.removeFile(file);

          // refresh the screen
          component.props.onRefresh();
        },
        "clickable": ".fileinput-button",
        "maxFilesize": this.props.iMaxFilesizeMB
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
      // upload form parameters
      var params = $.map(this.props.params, function(value, name){
        // let dropzone manipulate the upload key
        // TODO this is S3 specific and violates the frontend/backend barrier
        if (this.useDropzone && name == "key") {
          return;
        }

        var key = "param-" + name;
        return (
          <input type="hidden" name={name} value={value} key={key} />
        );
      }.bind(this));

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

          <span className="btn btn-primary fileinput-button dz-clickable">
            <i className="glyphicon glyphicon-plus"></i> Add files...
          </span>

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
        "options": {
          "confirmDelete": this.props.bConfirmDelete,
          "showDeletedFiles": false,
        }
      };
    },
    "getDefaultProps": function(){
      return {
        "style": {
          "container": "s3contents",
          "control": "s3control",
          "entry": "s3entry",
          "form": "s3form form-inline",
          "button": "btn btn-xs btn-primary pull-right",
          "link" : "s3link",
        },
      };
    },
    "setStateContents": function(contents){
      this.setState($.extend({}, this.state, contents));
    },
    "setStateOptions": function(options){
      this.setState({
        "path": this.state.path,
        "files": this.state.files,
        "folders": this.state.folders,
        "options": $.extend({}, this.state.options, options),
      });
    },
    "componentDidMount": function(){
      this.props.backend.list()
        .done(function(contents){
          this.setStateContents(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onNavUp": function(){
      var path = this.state.path.pop();
      this.props.backend.list(path)
        .done(function(contents){
          this.setStateContents(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onRefresh": function(){
      var path = this.state.path;
      this.props.backend.list(path)
        .done(function(contents){
          this.setStateContents(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onNavFolder": function(folder){
      var path = this.state.path.push(folder.name + "/");
      this.props.backend.list(path)
        .done(function(contents){
          this.setStateContents(contents);
        }.bind(this))
        .fail(function(){
          alert("failed to list contents");
        }.bind(this));
    },
    "onCreateFolder": function(name){
      // validate name
      if (name.match("^[a-zA-Z0-9 _\-]+$") == null) {
        alert("Folder name is invalid!");
        return;
      }

      // create the folder
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
      if(this.state.options.confirmDelete){
        var msg = "Do you want to delete the " + folder.name + " folder?";
        if (!window.confirm(msg)){
          return;
        }
      }

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
    "onDownloadFileVersion": function(file, version){
      this.props.backend.downloadFile(file.path, version);
    },
    "onDeleteFile": function(file){
      if(this.state.options.confirmDelete){
        var msg = "Do you want to delete the " + file.name + " file?";
        if (!window.confirm(msg)){
          return;
        }
      }

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
        "options": this.state.options,
        "setStateOptions": this.setStateOptions,
        "onNavUp": this.onNavUp,
        "onRefresh": this.onRefresh,
        "onNavFolder": this.onNavFolder,
        "onCreateFolder": this.onCreateFolder,
        "onDeleteFolder": this.onDeleteFolder,
        "onDownloadFile": this.onDownloadFile,
        "onDownloadFileVersion": this.onDownloadFileVersion,
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
        // check if we should render hidden files
        if (file.versions.length > 0) {
          var options = this.state.options;
          var latest = file.versions[file.versions.length - 1];

          if (!options.showDeletedFiles && latest.deleted) {
            return;
          }
        }

        // render the file
        var key = "file-" + file.name;
        return (
          <S3CFile {...props} data={file} key={key} />
        );
      }.bind(this));

      // upload control properties
      var uploadprops = $.extend({}, props, {
        "url": this.props.backend.getBucketURL(),
        "params": this.props.backend.getUploadParams(this.state.path),
        "iMaxFilesizeMB": this.props.iMaxFilesizeMB
      });

      // create the root element
      return (
        <div className={this.props.style.container}>
          <S3CBreadcrumbs {...props} data={this.state.path} />
          <S3COptionsControl {...props} />
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
      "iMaxFilesizeMB": opts.iMaxFilesizeMB
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
    "bConfirmDelete": false,
    "iMaxFilesizeMB": 1024
  };

  /************************************************************************
  * Debug                                                                *
  ************************************************************************/

  // export objects
  window.Path = Path;

}(jQuery));
