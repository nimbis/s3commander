/**
 * S3 Commander
 *
 * Version: 0.2.0
 * Author: Alexandru Barbur
 */

// configure sha1.js for RFC compliance
b64pad = "=";

// define the jQuery plugin
(function($){
    "use strict";

    /************************************************************************
     * Utility                                                              *
     ************************************************************************/

    function Path(sPath, bFolder) {
        sPath = typeof sPath !== 'undefined' ? sPath : "";
        bFolder = typeof bFolder !== 'undefined' ? bFolder : false;

        this.parts = sPath.split("/");
        this.folder = bFolder;
        this.normalize();
    }

    Path.prototype.normalize = function() {
        this.parts = this.parts.filter(function(part){
          return part.length > 0;
        });
    };

    Path.prototype.toString = function() {
        var uri = this.parts.join("/");
        if (this.folder && this.parts.length > 0) {
            uri += "/";
        }

        return uri;
    };

    Path.prototype.clone = function() {
        var other = new Path();
        other.parts = new Array(this.parts);
        other.folder = this.folder;

        return other;
    };

    Path.prototype.empty = function() {
        return this.parts.length == 0;
    };

    Path.prototype.push = function(sPath) {
        var newparts = sPath.split("/");
        Array.prototype.push.apply(this.parts, newparts);

        this.folder = (newparts.length > 0 && sPath.substr(-1) == "/");
        this.normalize();

        return this;
    };

    Path.prototype.pop = function() {
        this.parts.pop();

        return this;
    };

    Path.prototype.extend = function(pOther) {
        this.parts = this.parts.concat(pOther.parts);
        this.folder = pOther.folder;
        this.normalize();

        return this;
    };

    Path.prototype.concat = function(pOther) {
        var result = new Path();
        result.parts = this.parts.concat(pOther.parts);
        result.folder = pOther.folder;

        return result;
    };

    /************************************************************************
     * Internal State                                                       *
     ************************************************************************/

    /**
     * The plugin stores the top-level HTML DOM container element in this
     * variable. This is also used to store plugin state using jQuery's
     * .data() method. See listContents() for more information.
     */
    var container = null;

    /**
     * Breadcrumbs control.
     */
    var uiBreadcrumbs = null;

    /**
     * Create folder control.
     */
    var uiFolderControl = null;

    /**
     * Upload control.
     */
    var uiUploadControl = null;

    /************************************************************************
     * Amazon AWS                                                           *
     ************************************************************************/

    /**
     * Sign a string using an AWS secret key.
     */
    function sign(sSecretKey, sData) {
        return b64_hmac_sha1(sSecretKey, sData);
    }

    /**
     * Sign an Amazon AWS REST request.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/dev/RESTAuthentication.html
     */
    function signRequest(opts, sMethod, pResource, oParams) {
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
        secure += "/" + opts.sBucket + "/";

        if (!pResource.empty()) {
            secure += opts.pPrefix.concat(pResource).toString();
        }

        var params = $.param(oParams);
        if (params.length > 0) {
            secure += "?" + params;
        }

        // return the query parameters required for this request
        return $.extend(oParams, {
            'AWSAccessKeyId': opts.sAccessKey,
            'Signature': sign(opts.sSecretKey, secure),
            'Expires': timestamp,
        });
    }

    /**
     * Retrieve the url for Amazon AWS REST API calls.
     */
    function getAPIUrl(opts) {
        // TODO we can't use https:// if the bucket name contains a '.' (dot)
        return "https://" + opts.sBucket + "." + opts.sEndpoint;
    }

    /**
     * Retrieve a url for the given resource.
     */
    function getResourceUrl(opts, pResource) {
        return getAPIUrl(opts) + "/" + opts.pPrefix.concat(pResource).toString();
    }

    /**
     * Get the encoded policy and it's signature required to upload files.
     */
    function getPolicyData(opts) {
        // create the policy
        var policy = {
            "expiration": "2020-12-01T12:00:00.000Z",
            "conditions": [
                {"acl": "private"},
                {"bucket": opts.sBucket},
                ["starts-with", "$key", opts.pPrefix.toString()],
                ["starts-with", "$Content-Type", ""],
            ],
        };

        // encode the policy as Base64 and sign it
        var policy_b64 = rstr2b64(JSON.stringify(policy));
        var signature = sign(opts.sSecretKey, policy_b64);

        // return the policy and signature
        return {
            "acl": "private",
            "policy": policy_b64,
            "signature": signature,
        };
    }

    /************************************************************************
     * S3 Backend                                                           *
     ************************************************************************/

    /**
     * Retrieve the contents at the given path and store them internally.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    function listContents(pLocation) {
        var opts = container.data("opts");

        // default parameter values
        pLocation = typeof pLocation !== 'undefined' ? pLocation : new Path("", true);

        // determine the full path and sign the request
        if (!pLocation.folder) {
            console.log("listContents(): not a folder: " + pLocation.toString());
            return;
        }

        var fullpath = opts.pPrefix.concat(pLocation).toString();
        var signdata = signRequest(opts, "GET", new Path("", true));

        // request bucket contents with the given prefix and group results
        // into common prefixes using a delimiter
        return $.ajax({
            url: getAPIUrl(opts),
            data: $.extend(signdata, {
                "prefix": fullpath,
                "delimiter": "/",
            }),
            dataFormat: "xml",
            cache: false,
            success: function(data){
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

                container.data("contents", {
                    "path": pLocation,
                    "files": $.map(files, extract).filter(keep),
                    "folders": $.map(folders, extract).filter(keep),
                });
            },
            error: function(data){
                container.data("contents", {});
                console.log("Error:" + data.responseText);
                createAlert("danger", "Failed to get directory contents!");
            }
        });
    }

    /**
     * Create a folder with the given path. Folders are S3 objects where
     * the key ends in a trailing slash.
     */
    function createFolder(pResource) {
        var opts = container.data("opts");
        if (!pResource.folder) {
            console.log("createFolder(): not a folder: " + pResource.toString());
            return;
        }

        var signdata = signRequest(opts, "PUT", pResource);
        var url = getResourceUrl(opts, pResource) + "?" + $.param(signdata);

        return $.ajax({
            url: url,
            type: "PUT",
            data: "",
            error: function(data){
                console.log("Error: " + data.responseText);
                createAlert("danger", "Failed to create the folder!");
            }
        });
    }

    /**
     * Delete the folder at the given path. Folders are S3 objects where
     * the key ends in a trailing slash.
     */
     function deleteFolder(pResource) {
         var opts = container.data("opts");
         if (!pResource.folder) {
           console.log("deleteFolder(): not a folder: " + pResource.toString());
           return;
         }

         var signdata = signRequest(opts, "DELETE", pResource);
         var url = getResourceUrl(opts, pResource) + "?" + $.param(signdata);

         return $.ajax({
             url: url,
             type: "DELETE",
             error: function(data){
                 console.log("Error: " + data.responseText);
                 createAlert("danger", "Failed to delete the folder!");
             },
         });
     }

    /**
     * Download the file at the given path. This creates a link to download
     * the file using the user's AWS credentials then opens it in a new window.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectGET.html
     */
    function downloadFile(pResource) {
        var opts = container.data("opts");
        if (pResource.folder) {
          console.log("downloadFile(): not a file: " + pResource.toString());
          return;
        }

        var signdata = signRequest(opts, "GET", pResource, {
            'response-cache-control': 'No-cache',
            'response-content-disposition': 'attachment'
        });

        var url = getResourceUrl(opts, pResource) + "?" + $.param(signdata);
        window.open(url, "_blank");
    }

    /**
     * Delete the file at the given path.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectDELETE.html
     */
    function deleteFile(pResource) {
        var opts = container.data("opts");
        if (pResource.folder) {
          console.log("deleteFile(): not a file: " + pResource.toString());
          return;
        }

        var signdata = signRequest(opts, "DELETE", pResource);
        var url = getResourceUrl(opts, pResource) + "?" + $.param(signdata);

        return $.ajax({
            url: url,
            type: "DELETE",
            error: function(data){
                console.log("Error: " + data.responseText);
                createAlert("danger", "Failed to delete the file!");
            },
        });
    }

    /************************************************************************
     * User Interface                                                       *
     ************************************************************************/

    /**
     * Create the breadcrumbs control.
     */
    function createBreadcrumbs() {
        // retrieve options
        var opts = container.data("opts");

        // create the breadcrumbs container
        uiBreadcrumbs = $("<div />")
            .addClass(opts.breadcrumbsClasses.join(" "))
            .appendTo(container);

        // disk icon
        $("<span />")
            .attr("role", "s3c-crumb-icon")
            .addClass("glyphicon glyphicon-hdd")
            .appendTo(uiBreadcrumbs);

        // refresh button
        $("<button />")
            .attr("role", "s3c-crumb-refresh")
            .addClass(opts.buttonClasses.join(" "))
            .html("Refresh")
            .click(function(){
                var contents = container.data("contents");
                listContents(contents.path).then(updateDisplay);
            })
            .appendTo(uiBreadcrumbs);

        // parent folder button
        $("<button />")
            .attr("role", "s3c-crumb-up")
            .addClass(opts.buttonClasses.join(" "))
            .html("Up")
            .click(function(){
                var contents = container.data("contents");
                listContents(contents.path.pop()).then(updateDisplay);
            })
            .appendTo(uiBreadcrumbs);
    }

    /**
     * Update the breadcrumbs control.
     */
    function updateBreadcrumbs() {
      // retrieve options and contents
      var opts = container.data("opts");
      var contents = container.data("contents");

      // remove existing crumbs
      uiBreadcrumbs.find("span[role='s3c-crumb']").remove();
      uiBreadcrumbs.find("span[role='s3c-crumb-sep']").remove();

      // create crumbs
      var uiButton = uiBreadcrumbs.find("button[role='s3c-crumb-refresh']");
      $.each(contents.path.parts, function(i, crumb){
          $("<span />")
              .attr("role", "s3c-crumb-sep")
              .html("/")
              .insertBefore(uiButton);

          $("<span />")
            .attr("role", "s3c-crumb")
            .html(crumb)
            .insertBefore(uiButton);
      });
    }

    /**
     * Create an alert and display it to the user.
     */
    function createAlert(sType, sMessage) {
        var alert = $("<div />")
            .attr("role", "alert")
            .addClass("alert alert-dismissable")
            .addClass("alert-" + sType)
            .insertBefore(uiBreadcrumbs);

        $("<button />")
            .attr("type", "button")
            .attr("data-dismiss", "alert")
            .addClass("close")
            .append($("<span />").attr("aria-hidden", "true").html("&times;"))
            .append($("<span />").addClass("sr-only").html("Close"))
            .appendTo(alert);

        $("<p />")
            .html(sMessage)
            .appendTo(alert);
    }

    /**
     * Create the folder control.
     */
    function createFolderControl() {
        // retrieve options
        var opts = container.data("opts");

        // create the form
        uiFolderControl = $("<form />")
            .addClass(opts.formClasses.join(" "))
            .submit(function(){
                // don't do anything if the name contains forward slashes
                var name = $("#txtFolderName").val();
                if (name.indexOf("/") > -1) {
                    createAlert(
                        "warning",
                        "Folder name must not contain forward slashes!");

                    // don't submit the form
                    return false;
                }

                // clear the inputs
                $("#txtFolderName").val("");

                // create the folder
                var contents = container.data("contents");
                createFolder(contents.path.clone().push(name + "/"))
                    .then(function(){ return listContents(contents.path); })
                    .then(updateDisplay);

                // don't submit the form
                return false;
            })
            .appendTo(container);

        var controls = $("<div />")
            .addClass("form-group")
            .appendTo(uiFolderControl);

        // create controls
        $("<input />")
            .addClass("form-control")
            .attr("type", "text")
            .attr("id", "txtFolderName")
            .attr("placeholder", "Folder Name")
            .appendTo(controls);

        // submit button
        $("<button />")
            .addClass(opts.buttonClasses.join(" "))
            .attr("type", "submit")
            .html("Create")
            .appendTo(uiFolderControl);
    }

    /**
     * Create the file upload control.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html
     */
    function createUploadControl() {
        // retrieve options
        var opts = container.data("opts");

        // create the upload form
        uiUploadControl = $("<form />")
            .attr("method", "POST")
            .attr("enctype", "multipart/form-data")
            .addClass(opts.formClasses.join(" "))
            .appendTo(container);

        // create the file upload field
        var inputs = $("<div />")
            .addClass("form-group fallback")
            .appendTo(uiUploadControl);

        $("<input />")
            .attr("type", "file")
            .attr("name", "file")
            .appendTo(inputs);

        // create the submit button
        var btSubmit = $("<button />")
            .attr("type", "submit")
            .html("Upload")
            .addClass(opts.buttonClasses.join(" "))
            .appendTo(uiUploadControl);

        // enable drag-and-drop uploads if Dropzone is available
        if(typeof window.Dropzone !== 'undefined') {
            // style the form and remove the submit button
            uiUploadControl.addClass("dropzone");
            btSubmit.remove();

            // create the dropzone object
            uiUploadControl.dropzone({
                'url': '/notreal',
                'init': function() {
                    this.on('processing', function(file){
                        // set the post url from the upload control
                        this.options.url = uiUploadControl.attr("action");
                    })
                },
                'error': function(file, error) {
                    // uh oh
                    console.log("dropzone error: " + error);
                    createAlert("danger", "Failed to upload the file!")
                },
                'complete': function(file) {
                    // remove the file from the dropzone
                    this.removeFile(file);

                    // refresh the screen
                    var contents = container.data("contents");
                    listContents(contents.path).then(updateDisplay);
                },
            });
        }
    }

    /**
     * Update the file upload control.
     */
    function updateUploadControl() {
      // retrieve options and contents
      var opts = container.data("opts");
      var contents = container.data("contents");

      // update the form url
      uiUploadControl.attr("action", getAPIUrl(opts));

      // update amazon aws upload parameters
      var amazondata = $.extend(getPolicyData(opts), {
          "AWSAccessKeyId": opts.sAccessKey,
          "Content-Type": "application/octet-stream",
          "key": opts.pPrefix.concat(contents.path).push("${filename}").toString(),
      });

      uiUploadControl.find("input[role='s3c-upload-setting']").remove();
      $.each(amazondata, function(name, value){
          $("<input />")
              .attr("role", "s3c-upload-setting")
              .attr("type", "hidden")
              .attr("name", name)
              .attr("value", value)
              .appendTo(uiUploadControl);
      });
    }

    /**
     * Create the display.
     */
    function createDisplay() {
      // style the container
      var opts = container.data("opts");
      container.addClass(opts.containerClasses.join(" "));

      // clear the container
      container.empty();

      // create controls
      createBreadcrumbs();
      createFolderControl();
      createUploadControl();
    }

    /**
     * Update the display.
     */
    function updateDisplay() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // update controls
        updateBreadcrumbs();
        updateUploadControl();

        // create folder entries
        container.find("div[role='s3c-folder']").remove();
        $.each(contents.folders, function(i, folder){
            var path = contents.path.clone().push(folder + "/");
            var entry = $("<div />")
                .attr("role", "s3c-folder")
                .addClass(opts.entryClasses.join(" "));

            $("<span />")
                .addClass("glyphicon glyphicon-folder-open")
                .appendTo(entry);

            $("<a />")
                .html(folder)
                .click(function(){
                    listContents(path).then(updateDisplay);
                })
                .appendTo(entry);

            $("<button />")
                .addClass(opts.buttonClasses.join(" "))
                .html("Delete")
                .click(function(){
                    deleteFolder(path)
                        .then(function(){ return listContents(contents.path); })
                        .then(updateDisplay);
                })
                .appendTo(entry);

            entry.insertBefore(uiFolderControl);
        });

        // create file entries
        container.find("div[role='s3c-file']").remove();
        $.each(contents.files, function(i, file){
            var path = contents.path.clone().push(file);
            var entry = $("<div />")
                .attr("role", "s3c-file")
                .addClass(opts.entryClasses.join(" "));

            $("<span />")
                .addClass("glyphicon glyphicon-file")
                .appendTo(entry);

            $("<a />")
                .html(file)
                .click(function(){
                    downloadFile(path);
                })
                .appendTo(entry);

            $("<button />")
                .addClass(opts.buttonClasses.join(" "))
                .html("Delete")
                .click(function(){
                    deleteFile(path)
                        .then(function(){ return listContents(contents.path); })
                        .then(updateDisplay);
                })
                .appendTo(entry);

            entry.insertBefore(uiFolderControl);
        });
    }

    /************************************************************************
     * jQuery Plugin                                                        *
     ************************************************************************/

    // create an s3commander window
    $.fn.s3commander = function(options) {
        // create the container
        container = $(this);

        // determine plugin options
        container.data("opts", $.extend({},
            $.fn.s3commander.defaults,
            options));

        var opts = container.data("opts");
        opts.pPrefix = new Path(opts.sPrefix, true);

        // create the display
        createDisplay();

        // get the contents of the top-level folder
        container.data("contents", {});
        listContents().then(updateDisplay);

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
        "containerClasses": ["s3contents"],
        "breadcrumbsClasses": ["s3crumbs"],
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
