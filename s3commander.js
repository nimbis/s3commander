/**
 * S3 Commander
 */

// configure sha1.js for RFC compliance
b64pad = "=";

// define the jQuery plugin
(function($){
    "use strict";
    var container = null;

    function sign(sSecretKey, sData) {
        return b64_hmac_sha1(sSecretKey, sData);
    }

    function formatAwsDate(dWhen) {
        var iso = dWhen.toISOString();
        return iso.replace(/[:\-]|\.\d{3}/g, '');
    }

    function signRequest(opts, dStamp, sResource) {
        var data = "GET\n\n\n\n";
        data += "x-amz-date:" + formatAwsDate(dStamp) + "\n";
        data += "/" + opts.sBucket;

        if (sResource.length > 0) {
            data += "/" + opts.sPrefix + "/" + normalizeUri(sResource);
        }
        else {
            data += "/";
        }

        return "AWS " + opts.sAccessKey + ":" + sign(opts.sSecretKey, data);
    }

    /**
     * Normalize the forward slashes in a URI.
     */
    function normalizeUri(sUri) {
        return sUri.split("/").filter(function(part){
            return part.length > 0;
        }).join("/");
    }

    /**
     * Retrieve the contents
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    function getContents(sPath) {
        // retrieve options
        var opts = container.data("opts");

        // determine the current prefix
        var currentPrefix = normalizeUri(opts.sPrefix + "/" + sPath) + "/";

        // create the request
        var timestamp = new Date();
        return $.ajax({
            url: "https://" + opts.sBucket + "." + opts.sEndpoint,
            data: {
                "prefix": currentPrefix,
                "delimiter": "/",
            },
            headers: {
                "x-amz-date": formatAwsDate(timestamp),
                "Authorization": signRequest(opts, timestamp, ""),
            },
            dataFormat: "xml",
            cache: false,
            success: function(data){
                var files = $(data).find("ListBucketResult > Contents > Key");
                var folders = $(data).find("ListBucketResult > CommonPrefixes > Prefix");

                function extract(e){
                    return e.innerHTML.substr(currentPrefix.length);
                }

                function keep(e){
                    return e.length > 0;
                }

                container.data("contents", {
                    "path": normalizeUri(sPath),
                    "files": $.map(files, extract).filter(keep),
                    "folders": $.map(folders, extract).filter(keep),
                });
            },
            error: function(data){
                console.log("Error:" + data.responseText);
                container.data("contents", {});
            }
        });
    }

    function updateDisplay() {
        // retrieve options and contents
        var opts = container.data("opts");
        var contents = container.data("contents");

        // empty the container
        container.empty();

        // create the breadcrumbs
        var breadcrumbs = $("<div />").appendTo(container);
        breadcrumbs.addClass(opts.breadcrumbsClasses.join(" "));
        $.each(contents.path.split("/"), function(i, part){
            $("<a />").html(part).appendTo(breadcrumbs);
            $("<span />").html("/").appendTo(breadcrumbs);
        });

        // create folder entries
        $.each(contents.folders, function(i, folder){
            var entry = $("<div />").addClass(opts.entryClasses.join(" "));
            $("<span />").addClass("glyphicon glyphicon-folder-open").appendTo(entry);

            $("<a />").html(folder).click(function(){
                var path = contents.path + "/" + folder;
                getContents(path).then(updateDisplay);
            }).appendTo(entry);

            $("<button />").addClass(opts.buttonClasses.join(" ")).html("Delete").appendTo(entry);
            entry.appendTo(container);
        });

        // create file entries
        $.each(contents.files, function(i, file){
            var entry = $("<div />").addClass(opts.entryClasses.join(" "));
            $("<span />").addClass("glyphicon glyphicon-file").appendTo(entry);
            $("<a />").html(file).appendTo(entry);
            $("<button />").addClass(opts.buttonClasses.join(" ")).html("Delete").appendTo(entry);
            entry.appendTo(container);
        });
    }

    // create an s3commander window
    $.fn.s3commander = function(options){
        // create the container
        container = $(this);

        // determine plugin options
        container.data("opts", $.extend({},
            $.fn.s3commander.defaults,
            options));

        var opts = container.data("opts");
        opts.sPrefix = normalizeUri(opts.sPrefix);

        // style the container
        container.addClass(opts.contentClasses.join(" "));

        // get the contents of the root prefix
        getContents("").then(updateDisplay);

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
        "contentClasses": ["s3contents"],
        "breadcrumbsClasses": ["s3crumbs"],
        "entryClasses": ["s3entry", "clearfix"],
        "buttonClasses": ["btn", "btn-xs", "btn-primary", "pull-right"],
    };
}(jQuery));
