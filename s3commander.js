/*
 * S3 Commander
 *
 * TODO
 *
 */

// configure sha1.js for RFC compliance
b64pad = "=";

// define the jQuery plugin
(function($){
    "use strict";

    function sign(sAccessKey, sData){
        return b64_hmac_sha1(sAccessKey, sData);
    }

    function signRequest(sAccessKey, iExpires, sBucket, sResource){
        var canonical = '/' + sBucket + sResource;
        var req = "GET\n\n\n" + iExpires + "\n" + canonical;
        return sign(sAccessKey, req);
    }

    function createPolicy(options){
        return {
            "expiration": "2020-12-01T12:00:00.000Z",
            "conditions": [
                {"acl": "private"},
                {"bucket": options.sBucket},
                ["starts-with", "$key", options.sPrefix],
                ["starts-with", "$Content-Type", ""],
            ],
        };

        // b64_policy = rstr2b64(JSON.stringify(policy));
    }

    // create an s3commander window
    $.fn.s3commander = function(options){
        var opts = $.extend({}, $.fn.s3commander.defaults, options);
        console.log(opts);

        var url = "/" + opts.sPrefix;
        var expires = new Date().valueOf();
        expires = parseInt(expires / 1000);
        expires += 21600;

        $.ajax({
            url: "http://" + opts.sBucket + ".s3.amazonaws.com" + url,
            data: {
                'AWSAccessKeyId': opts.sAccessKey,
                'Signature': signRequest(opts.sAccessKey, expires, opts.sBucket, url),
                'Expires': expires,
            },
            dataFormat: 'xml',
            cache: false,
            success: function(data){
                console.log("success");
                console.log(data);
            },
            error: function(data){
                console.log("error");
                console.log(data);
            },
        });

        //var container = $("<div />").attr(opts.containerAttrs).appendTo(this);
        //container.append($("<h2>TODO</h2>"));
    };

    // default settings
    $.fn.s3commander.defaults = {
        "sAccessKey": "",
        "sSecretKey": "",
        "sBucket": "",
        "sPrefix": "",
        "containerAttrs": {
            "class": "well well-sm"
        },
    };
}(jQuery));
