(function(window, document) {
    var syncObjects = {};

    var sync = new (function() {
        this.decodeObject = function(obj) {
            // Decodes in place.
            for(var f in obj.functions) {
                if(typeof obj.functions[f] == 'object' && typeof obj.functions[f].value == 'string') {
                    obj.data[f] = eval(obj.functions[f].value);
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
                if(typeof newObj.init == 'function') {
                    newObj.init();
                }
                break;
            case 'update':
                if(typeof syncObjects[f.key] !== 'undefined' &&
                   typeof syncObjects[f.key].destroy !== 'undefined') {
                    syncObjects[f.key].destroy();
                }
                var newObj = this.decodeObject(f.content);
                syncObjects[f.key] = newObj; // TODO: Patch old object
                if(typeof newObj.init == 'function') {
                    newObj.init();
                }
                break;
            default:
                console.log("Unknown action " + f.action);
                break;
            }
        };
    });

    function init() {
        var socket = new WebSocket('ws://127.0.0.1:8181');

        socket.onmessage = function(event) {
            sync.receive(event.data);
            socket.send(JSON.stringify({'message': 'received'}));
        };
    }
    window.onload = init;
})(window, document);
