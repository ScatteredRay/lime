var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var WebSockets = require('ws');
const sync = require('./sync.js');

function typeFromPath(filePath) {
    var ext = path.extname(filePath);
    var typeMap = {
        ".html": "text/html",
        ".js": "application/javascript",
    };
    return typeMap[ext.toLowerCase()];
}

function responseHeaders(type) {
    return {'Content-Type': type,
            // Just for JS?
            'Access-Control-Allow-Origin' : '*'};
}

function fileResponse(filename, type, headers) {
    if(headers == null) {
        headers = {'Content-Type': type};
    }
    return function(res) {
        fs.readFile(filename,
                    function(e, data) {
                        if(!e) {
                            res.writeHead(200, responseHeaders(type));
                            res.end(data);
                        }
                        else {
                            res.writeHead(404, headers);
                            res.end("Error reading file");
                        }
                    });
    }
}

const server = http.createServer(function(req, res) {
    var query = url.parse(req.url, true).query;
    if(req.url.match(/^\/client\.js/)) {
        fileResponse("lib/client/client.js", "application/javascript")(res);
    }
    else if(req.url.match(/^\/js\/[^.\\\/]*\.js/)) {
        fileResponse("app/res/" + req.url.replace(/^\//g, ""), "application/javascript")(res);
    }
    else if(req.url.match(/^\/content\/.*$/)) {
        var contentFile = sync.contentMap[req.url.replace(/^\/content\//g, "")];
        if(typeof contentFile !== 'undefined') {
            fileResponse(contentFile, "application/javascript")(res);
        }
        else {
            res.writeHead(404, "text/plain");
            res.end("Error reading file");
        }
    }
    else {
        fileResponse("lib/client/index.html", "text/html")(res);
    }
});

server.listen(8080, null);

console.log(`Listening on http port ${server.address().port}`);

var wss = new WebSockets.Server({port: 8181});

wss.on('connection', function(ws) {
    function send(data) {
        ws.send(data,
                function(e) {
                    if(e) {
                        console.log(e);
                    }
                });
    }

    ws.on('message', function(data) {
        console.log(data);
    });

    var clientId = '1'; //TEMP
    ws.on('close', function() {
        sync.closeClient(clientId);
    });
    sync.initClient(clientId, send);
});

exports.close = () => {
    wss.close();
    server.close();
};
exports.sync = sync;
