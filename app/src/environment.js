var Environment = exports;

Environment._depends = ['ClientScene'];

Environment.light1 = {pos: {x: 1, y: 1, z: .2}};
Environment.light2 = {pos: {x: .2, y: 1, z: -.8}};
Environment.sphere = {pos: {x: 1, y: 1, z: 0}};

Environment.init = function() {
    var scene = root.ClientScene.scene;
    this.scene = scene;

    this.ambientLight = new THREE.AmbientLight(0x101010);
    scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0x997790);
    scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0x888888);
    scene.add(this.dirLight2);

    var sphereGeo = new THREE.SphereBufferGeometry(1, 20, 20);
    var sphereMat = new THREE.MeshPhongMaterial();
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(this.sphereMesh);

    this.tick()
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

Environment.tick = function() {
    {
        let pos = this.light1.pos;
        this.dirLight1.position.set(pos.x, pos.y, pos.z);
    }
    {
        let pos = this.light2.pos;
        this.dirLight2.position.set(pos.x, pos.y, pos.z);
    }
    {
        this.sphere.pos.z += 0.01;
        if(this.sphere.pos.z > 1.0) this.sphere.pos.z -= 1.0;
        let pos = this.sphere.pos;
        this.sphereMesh.position.set(pos.x, pos.y, pos.z);
    }
    if(typeof(root.Ian) !== 'undefined') {
        root.Ian.tick();
    }
}
