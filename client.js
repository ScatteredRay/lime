(function(window, document) {

    var sync = new (function() {
        this.decodeObject = function(obj) {
            // Decodes in place.
            for(var f in obj) {
                if(typeof obj[f] == 'object' && typeof obj[f].syncType == 'string') {
                    switch(obj[f].syncType) {
                    case 'function':
                        obj[f] = eval(obj[f].value);
                        break;
                    default:
                        console.log("Unrecogonized synctype: " + obj[f].syncType + " in decode");
                        break;
                    }
                } 
            }
            return obj;
        };

        this.receive = function(data) {
            var f = JSON.parse(data);
            console.dir(f);
            switch(f.action) {
            case 'create':
                var newObj = this.decodeObject(f.content);
                console.dir(newObj);
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
            console.dir(event);
            socket.send(JSON.stringify({'message': 'received'}));
        };
    }
    window.onload = init;
})(window, document);
