(function(window, document) {
    var syncObjects = {};
    window.syncObjects = syncObjects; // For debug access.
    //TODO: pull 'root' from app.json
    window['root'] = syncObjects

    var sync = new (function() {
        this.decodeFunction = function(obj) {
            return eval(obj);
        }

        this.decodeObject = function(obj) {
            // Decodes in place.
            for(var f in obj.functions) {
                if(typeof obj.functions[f] == 'object' && typeof obj.functions[f].value == 'string') {
                    obj.data[f] = this.decodeFunction(obj.functions[f].value);
                }
            }
            return obj.data;
        };

        this.receive = function(data) {
            var f = JSON.parse(data);
            switch(f.action) {
            case 'create':
                var newObj = this.decodeObject(f.content);
                syncObjects[f.key] = newObj;
                if(typeof newObj.init === 'function') {
                    newObj.init();
                }
                break;
            case 'update':
                if(typeof syncObjects[f.key] !== 'undefined' &&
                   typeof syncObjects[f.key].destroy === 'function') {
                    syncObjects[f.key].destroy();
                }
                var newObj = this.decodeObject(f.content);
                syncObjects[f.key] = newObj; // TODO: Patch old object
                if(typeof newObj.init == 'function') {
                    newObj.init();
                }
                break;
            case 'command':
                this.decodeFunction(f.command)();
                break;
            default:
                console.log("Unknown action " + f.action);
                break;
            }
        };
    });

    function init() {
        let host = new URL(document.location);
        host.port = 8181
        host.protocol = "ws:"
        var socket = new WebSocket(host);

        socket.onmessage = function(event) {
            sync.receive(event.data);
            socket.send(JSON.stringify({'message': 'received'}));
        };
    }
    window.onload = init;
})(window, document);
