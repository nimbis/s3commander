/**
 * S3 Commander
 *
 * Version: 0.1.0
 * Author: Alexandru Barbur
 */

// configure sha1.js for RFC compliance
b64pad = "=";

// define the jQuery plugin
(function($){
    "use strict";

    /************************************************************************
     * General / Utility                                                    *
     ************************************************************************/

    /**
     * The plugin stores the top-level HTML DOM container element in this
     * variable. This is also used to store plugin state using jQuery's
     * .data() method. See listContents() for more information.
     */
    var container = null;

    /**
     * Normalize a URI by removing empty components ('//') and leading slashes.
     * If bTrim is true then it will also remove trailing slashes otherwise it
     * keeps a single trailing slash if the original URI had one.
     */
    function normURI(sURI, bTrim) {
        // default parameter values
        bTrim = typeof bTrim !== 'undefined' ? bTrim : false;

        // corner case: empty uri
        if (sURI.length == 0) {
            return "";
        }

        // split the uri and filter out empty components
        var folder = (sURI.substr(-1) == "/");
        var parts = sURI.split("/").filter(function(part){
            return part.length > 0;
        });

        // create the uri from it's components
        var uri = parts.join("/");
        if (folder && !bTrim) {
            return uri + "/";
        }

        return uri;
    }

    /**
     * Create a normalized URI from components.
     */
    function joinURI(aParts, bTrim) {
        // default parameter values
        bTrim = typeof bTrim !== 'undefined' ? bTrim : false;

        // join the parts and normalize the result
        return normURI(aParts.join("/"), bTrim);
    }

    /**
     * Pop the last component from the given URI and return the remaining part.
     */
    function popURI(sURI) {
        // corner case: empty uri
        if (sURI.length == 0) {
            return sURI;
        }

        // remove everything starting from the last '/'
        return sURI.substr(0, sURI.lastIndexOf("/"));
    }

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
    function signRequest(opts, sMethod, sResource, oParams) {
        // default parameter values
        sMethod = typeof sMethod !== 'undefined' ? sMethod : "GET";
        sResource = typeof sResource !== 'undefined' ? sResource : "";
        oParams = typeof oParams !== 'undefined' ? oParams : new Object();

        // normalize the resource
        sResource = normURI(sResource);

        // this is used as the request and signature expiration timestamp
        // for convenince. the request timestamp must be within 15
        // minutes of the time on amazon's aws servers and the expiration
        // timestamp must be in the future so we add (XXX 6 hours ???)
        var timestamp = parseInt(new Date().valueOf() / 1000) + 21600;

        // create the signature plaintext
        var secure = sMethod + "\n\n\n";
        secure += timestamp + "\n";
        secure += "/" + opts.sBucket + "/";

        if (sResource.length > 0) {
            secure += opts.sPrefix + "/" + sResource;
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
    function getResourceUrl(opts, sResource) {
        return getAPIUrl(opts) + "/" + joinURI([opts.sPrefix, sResource]);
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
                ["starts-with", "$key", opts.sPrefix],
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
     * Plugin Actions                                                       *
     ************************************************************************/

    /**
     * Retrieve the contents at the given path and store them internally.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    function listContents(sPath) {
        var opts = container.data("opts");

        // default parameter values
        sPath = typeof sPath !== 'undefined' ? sPath : "";

        // determine the full path and sign the request
        var fullpath = joinURI([opts.sPrefix, sPath], true) + "/";
        var signdata = signRequest(opts, "GET", "");

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
                    return normURI(e.innerHTML.substr(fullpath.length), true);
                }

                function keep(e){
                    return e.length > 0;
                }

                container.data("contents", {
                    "path": normURI(sPath, true),
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
    function createFolder(sPath) {
        var opts = container.data("opts");
        sPath = normURI(sPath, true) + "/";
        var signdata = signRequest(opts, "PUT", sPath);

        return $.ajax({
            url: getResourceUrl(opts, sPath) + "?" + $.param(signdata),
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
     function deleteFolder(sPath) {
         var opts = container.data("opts");
         sPath = normURI(sPath, true) + "/";
         var signdata = signRequest(opts, "DELETE", sPath);

         return $.ajax({
             url: getResourceUrl(opts, sPath) + "?" + $.param(signdata),
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
    function downloadFile(sPath) {
        var opts = container.data("opts");
        var signdata = signRequest(opts, "GET", sPath, {
            'response-cache-control': 'No-cache',
            'response-content-disposition': 'attachment'
        });

        var url = getResourceUrl(opts, sPath) + "?" + $.param(signdata);
        window.open(url, "_blank");
    }

    /**
     * Delete the file at the given path.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectDELETE.html
     */
    function deleteFile(sPath) {
        var opts = container.data("opts");

        var signdata = signRequest(opts, "DELETE", sPath);
        var url = getResourceUrl(opts, sPath) + "?" + $.param(signdata);

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
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // create the breadcrumbs container
        var breadcrumbs = $("<div />")
            .addClass(opts.breadcrumbsClasses.join(" "))
            .appendTo(container);

        // disk icon
        $("<span />")
            .addClass("glyphicon glyphicon-hdd")
            .appendTo(breadcrumbs);

        // path crumbs
        $.each(contents.path.split("/"), function(i, crumb){
            $("<span />").html("/").appendTo(breadcrumbs);
            $("<span />").html(crumb).appendTo(breadcrumbs);
        });

        // refresh button
        $("<button />")
            .addClass(opts.buttonClasses.join(" "))
            .html("Refresh")
            .click(function(){
                listContents(contents.path).then(updateDisplay);
            })
            .appendTo(breadcrumbs);

        // parent folder button
        $("<button />")
            .addClass(opts.buttonClasses.join(" "))
            .html("Up")
            .click(function(){
                var path = popURI(contents.path);
                listContents(path).then(updateDisplay);
            })
            .appendTo(breadcrumbs);
    }

    /**
     * Create an alert and display it to the user.
     */
    function createAlert(sType, sMessage) {
        var alert = $("<div />")
            .attr("role", "alert")
            .addClass("alert alert-dismissable")
            .addClass("alert-" + sType)
            .insertBefore(container.find(".s3crumbs"));

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
     * Create the new folder control.
     */
    function createFolderControl() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // create the form
        var form = $("<form />")
            .addClass(opts.formClasses.join(" "))
            .appendTo(container);

        var controls = $("<div />")
            .addClass("form-group")
            .appendTo(form);

        // folder name textbox
        $("<input />")
            .addClass("form-control")
            .attr("type", "text")
            .attr("id", "txtFolderName")
            .attr("placeholder", "Folder Name")
            .appendTo(controls);

        // button
        $("<button />")
            .addClass(opts.buttonClasses.join(" "))
            .attr("type", "submit")
            .html("Create")
            .click(function(){
                // don't do anything if the name contains forward slashes
                var name = $("#txtFolderName").val();
                if (name.indexOf("/") > -1) {
                    createAlert(
                        "warning",
                        "Folder name must not contain forward slashes!");

                    // don't submit the form
                    return false;
                }

                // create the folder
                createFolder(joinURI([contents.path, name]))
                    .then(function(){ return listContents(contents.path); })
                    .then(updateDisplay);

                // don't submit the form
                return false;
            })
            .appendTo(form);
    }

    /**
     * Create the file upload control.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html
     */
    function createUploadControl() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // create the upload form
        var form = $("<form />")
            .attr("method", "POST")
            .attr("action", getAPIUrl(opts))
            .attr("enctype", "multipart/form-data")
            .addClass(opts.formClasses.join(" "))
            .appendTo(container);

        // store amazon parameters in hidden input fields
        var amazondata = $.extend(getPolicyData(opts), {
            "AWSAccessKeyId": opts.sAccessKey,
            "Content-Type": "application/octet-stream",
            "key": joinURI([opts.sPrefix, contents.path, "${filename}"], true),
        });

        $.each(amazondata, function(name, value){
            $("<input />")
                .attr("type", "hidden")
                .attr("name", name)
                .attr("value", value)
                .appendTo(form);
        });

        // create the file upload field
        var inputs = $("<div />")
            .addClass("form-group fallback")
            .appendTo(form);

        $("<input />")
            .attr("type", "file")
            .attr("name", "file")
            .appendTo(inputs);

        // create the submit button
        $("<button />")
            .attr("type", "submit")
            .html("Upload")
            .addClass(opts.buttonClasses.join(" "))
            .appendTo(form);

        // enable drag-and-drop uploads if Dropzone is available
        if(typeof window.Dropzone !== 'undefined') {
            // style the form and remove the submit button
            form.addClass("dropzone");
            $(form).find("button").remove();

            // create the dropzone object
            form.dropzone({
                'error': function(file, error) {
                    // uh oh
                    console.log("dropzone error: " + error);
                    createAlert("danger", "Failed to upload the file!")
                },
                'complete': function(file) {
                    // remove the file from the dropzone
                    this.removeFile(file);

                    // refresh the screen
                    listContents(contents.path).then(updateDisplay);
                },
            });
        }
    }

    /**
     * Update the display with the internal contents.
     */
    function updateDisplay() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // clear the container
        container.empty();

        // create controls
        createBreadcrumbs();

        // create folder entries
        $.each(contents.folders, function(i, folder){
            var path = contents.path + "/" + folder;
            var entry = $("<div />").addClass(opts.entryClasses.join(" "));

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

            entry.appendTo(container);
        });

        // create file entries
        $.each(contents.files, function(i, file){
            var path = contents.path + "/" + file;
            var entry = $("<div />").addClass(opts.entryClasses.join(" "));

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

            entry.appendTo(container);
        });

        // create controls
        createFolderControl();
        createUploadControl();
    }

    /************************************************************************
     * jQuery                                                               *
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
        opts.sPrefix = normURI(opts.sPrefix, true);

        // style the container
        container.addClass(opts.containerClasses.join(" "));

        // get the contents of the top-level folder
        container.data("contents", {"path": ""});
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
}(jQuery));
