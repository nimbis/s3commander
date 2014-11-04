/**
 * S3 Commander
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
     * .data() method. See getContents() for more information.
     */
    var container = null;

    /**
     * Normalize a URI by removing empty components ('//'), leading,
     * and trailing slashes. If bAbsolute is true then a leading slash is
     * always present in the returned URI.
     */
    function normURI(sUri, bAbsolute) {
        // default parameter values
        bAbsolute = typeof bAbsolute !== 'undefined' ? bAbsolute : false;

        // corner case: empty uri
        if (sUri.length == 0) {
            return bAbsolute ? "/" : "";
        }

        // split the uri and filter out empty components
        var parts = sUri.split("/").filter(function(part){
            return part.length > 0;
        });

        // create the uri from it's components
        var uri = parts.join("/");
        if (bAbsolute == true) {
            return "/" + uri;
        }

        return uri;
    }

    /**
     * Pop the last component from the given URI and return the remaining part.
     */
    function popURI(sUri) {
        // corner case: empty uri
        if (sUri.length == 0) {
            return sUri;
        }

        // remove everything starting from the last '/'
        return sUri.substr(0, sUri.lastIndexOf("/"));
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
        var url = getAPIUrl(opts);
        url += normURI(opts.sPrefix, true);
        url += normURI(sResource, true);

        return url;
    }

    /************************************************************************
     * Plugin Actions                                                       *
     ************************************************************************/

    /**
     * Retrieve the contents at the given path and store them internally.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    function getContents(sPath) {
        var opts = container.data("opts");

        var fullpath = normURI(opts.sPrefix + "/" + sPath) + "/";
        var signdata = signRequest(opts, "GET", "/");

        return $.ajax({
            url: getAPIUrl(opts),
            data: $.extend(signdata, {
                "prefix": fullpath,
                "delimiter": "/",
            }),
            dataFormat: "xml",
            cache: false,
            success: function(data){
                var files = $(data).find("ListBucketResult > Contents > Key");
                var folders = $(data).find("ListBucketResult > CommonPrefixes > Prefix");

                function extract(e){
                    return normURI(e.innerHTML.substr(fullpath.length));
                }

                function keep(e){
                    return e.length > 0;
                }

                container.data("contents", {
                    "path": normURI(sPath),
                    "files": $.map(files, extract).filter(keep),
                    "folders": $.map(folders, extract).filter(keep),
                });

                container.data("error", "");
            },
            error: function(data){
                console.log("Error:" + data.responseText);
                container.data("contents", {});
                container.data("error", data.responseText);
            }
        });
    }

    /**
     * Download the resource at the given path.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectGET.html
     */
    function getObject(sPath) {
        var opts = container.data("opts");

        var signdata = signRequest(opts, "GET", sPath, {
            'response-cache-control': 'No-cache',
            'response-content-disposition': 'attachment'
        });

        var url = getResourceUrl(opts, sPath) + "?" + $.param(signdata);
        window.open(url, "_blank");
    }

    /**
     * Delete the resource at the given path.
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTObjectDELETE.html
     */
    function deleteObject(sPath) {
        var opts = container.data("opts");

        var signdata = signRequest(opts, "DELETE", sPath);
        var url = getResourceUrl(opts, sPath) + "?" + $.param(signdata);

        return $.ajax({
            url: url,
            type: "DELETE",
            error: function(data){
                console.log("Error: " + data.responseText);
            },
        });
    }

    /************************************************************************
     * User Interface                                                       *
     ************************************************************************/

    /**
     * TODO
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
                getContents(contents.path).then(updateDisplay);
            })
            .appendTo(breadcrumbs);

        // parent folder button
        $("<button />")
            .addClass(opts.buttonClasses.join(" "))
            .html("Back")
            .click(function(){
                var path = popURI(contents.path);
                getContents(path).then(updateDisplay);
            })
            .appendTo(breadcrumbs);
    }

    /**
     * TODO
     */
    function createUploadControl() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // create the upload form
        var form = $("<form />")
            .addClass(opts.uploadClasses.join(" "))
            .appendTo(container);

        form.attr("action", getAPIUrl(opts));
        form.attr("method", "POST");
        form.attr("enctype", "multipart/form-data");

        // store amazon parameters in hidden input fields
        function createHidden(name, value) {
            $("<input />")
                .attr("type", "hidden")
                .attr("name", name)
                .attr("value", value)
                .appendTo(form);
        }

        var key = normURI(opts.sPrefix + "/" + contents.path + "/${filename}");
        var policy = {
            "expiration": "2020-12-01T12:00:00.000Z",
            "conditions": [
                {"acl": "private"},
                {"bucket": opts.sBucket},
                ["starts-with", "$key", opts.sPrefix],
                ["starts-with", "$Content-Type", ""],
            ],
        };

        var policy_b64 = rstr2b64(JSON.stringify(policy));

        createHidden("key", key);
        createHidden("AWSAccessKeyId", opts.sAccessKey);
        createHidden("Content-Type", "application/octet-stream");
        createHidden("policy", policy_b64);
        createHidden("acl", "private");
        createHidden("signature", sign(opts.sSecretKey, policy_b64));

        // create the file upload field
        var inputs = $("<div />").addClass("form-group").appendTo(form);
        $("<input />")
            .attr("type", "file")
            .attr("name", "file")
            .appendTo(inputs);

        // create the submit button
        $("<button />")
            .attr("type", "submit")
            .addClass(opts.buttonClasses.join(" "))
            .html("Upload")
            .appendTo(form);
    }

    /**
     * TODO
     *
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html
     * http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html
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
                    getContents(path).then(updateDisplay);
                })
                .appendTo(entry);

            $("<button />")
                .addClass(opts.buttonClasses.join(" "))
                .html("Delete")
                .click(function(){
                    deleteObject(path)
                        .then(function(){
                            return getContents(contents.path);
                        })
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
                    getObject(path);
                })
                .appendTo(entry);

            $("<button />")
                .addClass(opts.buttonClasses.join(" "))
                .html("Delete")
                .click(function(){
                    deleteObject(path)
                        .then(function(){
                            return getContents(contents.path);
                        })
                        .then(updateDisplay);
                })
                .appendTo(entry);

            entry.appendTo(container);
        });

        // create controls
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
        opts.sPrefix = normURI(opts.sPrefix);

        // style the container
        container.addClass(opts.containerClasses.join(" "));

        // get the contents of the root prefix
        getContents("/").then(updateDisplay);

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
        "uploadClasses": ["s3upload", "form-inline"],
        "buttonClasses": ["btn", "btn-xs", "btn-primary", "pull-right"],
    };
}(jQuery));
