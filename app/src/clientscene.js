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
 
    this.render();
};

ClientScene.destroy = function () {
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

ClientScene.render = function() {
    this.renderer.render(this.scene, this.camera);
    var _this = this;
    this.renderTimeout = requestAnimationFrame(this.render.bind(this));
}
