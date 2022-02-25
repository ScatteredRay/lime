let Camera = exports;

Camera._depends = ['ClientScene'];

Camera.init = function() {
    this.position = {
        x: 0,
        y: 0,
        z: 10
    };
    this.direction = {
        x: 0,
        y: 0,
        z: -1
    };
}

Camera.destroy = function() {
}

Camera.drag = function(delta) {
    this.position.x += delta.x / 100;
    this.position.y += delta.y / 100;
}

Camera.tick = function() {
    //this.position.x += 0.1;
}