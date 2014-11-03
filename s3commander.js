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

    function signRequest(opts, iTimestamp, sResource) {
        var data = "GET\n\n\n";
        data += iTimestamp + "\n";
        data += "/" + opts.sBucket;

        if (sResource.length > 0) {
            data += "/" + opts.sPrefix + "/" + normalizeUri(sResource);
        }
        else {
            data += "/";
        }

        return sign(opts.sSecretKey, data);
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
     * TODO
     * http://docs.aws.amazon.com/AmazonS3/latest/API/RESTBucketGET.html
     */
    function getContents(sResource) {
        // retrieve options
        var opts = container.data("opts");

        // create the request
        var timestamp = new Date().valueOf();
        timestamp = parseInt(timestamp / 1000) + 21600;

        return $.ajax({
            url: "https://" + opts.sBucket + "." + opts.sEndpoint,
            data: {
                "prefix": opts.sPrefix + "/" + normalizeUri(sResource),
                "delimiter": "/",
                "AWSAccessKeyId": opts.sAccessKey,
                "Signature": signRequest(opts, timestamp, sResource),
                "Expires": timestamp,
            },
            dataFormat: "xml",
            cache: false,
            success: function(data){
                //var path = $(data).find("ListBucketResult > Prefix")[0];
                //var files = $(data).find("ListBucketResult > Contents > Key");
                //var folders = $(data).find("ListBucketResult > CommonPrefixes > Prefix");
                container.data("raw", data);
                console.log(data);
            },
            error: function(data){
                console.log("Error:" + data.responseText);
            }
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

        // get the contents of the root prefix
        getContents("");

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
}(jQuery));
