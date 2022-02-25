let Ian = exports;

// This file is for your scene!


Ian._depends = ['Environment'];

Ian.init = function() {
    let scene = root.Environment.scene;
    let sphereGeo = new THREE.SphereBufferGeometry(1, 20, 20);
    let sphereMat = new THREE.MeshPhongMaterial();
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.sphereMesh.position.set(0, 1, 0); // initial position
    scene.add(this.sphereMesh);
    this.time = 0;
}

Ian.destroy = function() {
    let scene = root.Environment.scene;
    scene.remove(this.sphereMesh);
    delete this.sphereMesh;
}

Ian.tick = function() {
    // This happnes every frame!
    this.time += 0.03;
    this.sphereMesh.position.z -= 0.0;
    if(this.sphereMesh.position.z < -10) {
        this.sphereMesh.position.z = 0;
    }
    this.sphereMesh.position.x = Math.sin(this.time) * 2.0;
    this.sphereMesh.position.y = Math.abs(Math.cos(this.time) * 0.6);
}