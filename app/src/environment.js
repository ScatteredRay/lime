var Environment = exports;

Environment._depends = ['ClientScene'];

Environment.init = function() {
    var scene = root.ClientScene.scene;

    this.ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0x777790);
    this.dirLight1.position.set(-1, 1, .2);
    scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0x662222);
    this.dirLight2.position.set(.2, 1, -.8);
    scene.add(this.dirLight2);

    var sphereGeo = new THREE.SphereBufferGeometry(3, 20, 20);
    var sphereMat = new THREE.MeshPhongMaterial();
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(this.sphereMesh);
}

Environment.destroy = function() {
    var scene = root.ClientScene.scene;
    scene.remove(this.sphereMesh);
    delete this.sphereMesh;

    scene.remove(this.dirLight1);
    delete this.dirLight1;

    scene.remove(this.dirLight2);
    delete this.dirLight2;

    scene.remove(this.ambientLight);
    delete this.ambientLight;
}
