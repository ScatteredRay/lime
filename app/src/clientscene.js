
var ClientScene = exports;

ClientScene.init = function() {
    this.win = document.createElement('div');
    document.body.appendChild(this.win);
    this.container = document.createElement('div');
    this.win.appendChild(this.container);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    this.camera.position.z = 10;
    this.camera.position.y = 0;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));

    this.renderer = new THREE.WebGLRenderer({antialias: true})
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('mousedown', this.mousedown.bind(this));
    this.renderer.domElement.addEventListener('mouseup', this.mouseup.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.mousemove.bind(this));
    this.dragging = false;
    this.drag = {x: 0, y: 0};

    this.render();
};

ClientScene.destroy = function () {
    this.renderer.domElement.removeEventListener('mousedown', this.mousedown);
    this.renderer.domElement.removeEventListener('mouseup', this.mouseup);
    this.renderer.domElement.removeEventListener('mousemove', this.mousemove);
    if(typeof this.renderTimeout != 'undefined') {
        cancelAnimationFrame(this.renderTimeout);
        delete this.renderTimeout;
    }
    delete this.renderer;
    delete this.camera;
    delete this.scene;
    this.win.removeChild(this.container);
    delete this.container;
    delete this.win;
}

ClientScene.mousedown = function(event) {
    this.dragging = true;
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
}

ClientScene.mousemove = function(event) {
    if(this.dragging) {
        let delta = {
            x: -(event.clientX - this.drag.x),
            y: event.clientY - this.drag.y
        };
        if(typeof(root.Camera) !== 'undefined') {
            root.Camera.drag(delta);
        }
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
    }
}

ClientScene.mouseup = function(event) {
    this.dragging = false;
}

ClientScene.render = function() {
    if(typeof(root.Environment) !== 'undefined') {
        root.Environment.tick();
    }
    if(typeof(root.Camera) !== 'undefined') {
        root.Camera.tick();
        let pos = root.Camera.position;
        let dir = root.Camera.direction;
        this.camera.position.set(pos.x, pos.y, pos.z);
        let look = new THREE.Vector3(pos.x, pos.y, pos.z);
        look.add(new THREE.Vector3(dir.x, dir.y, dir.z));
        this.camera.lookAt(look);
    }
    this.renderer.render(this.scene, this.camera);
    var _this = this;
    this.renderTimeout = requestAnimationFrame(this.render.bind(this));
}
