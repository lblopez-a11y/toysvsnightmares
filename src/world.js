import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GAME } from './config.js';
import { createCharacterModel } from './characters.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Geometrías compartidas. Los modelos visuales están aislados de la simulación:
 * en la próxima etapa createToyModel se podrá reemplazar por GLTFLoader.
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);this.roundedGeometry=new RoundedBoxGeometry(1,1,1,2,.12);
    this.sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
    this.cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 16);
    this.materials = new Map();
    this.obstacles = [];
    this.solids = [];
    this.ambientToys = [];
    this.lods = [];
    this.buildRoom();
    this.buildDistricts();
    this.buildBattleProps();
    this.batchStatic();
  }
  material(color, roughness = 0.48) {
    const key = `${color}:${roughness}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness:.06 }));
    return this.materials.get(key);
  }
  surface(color,kind='plastic'){
    const key=color+':'+kind;if(!this.materials.has(key)){
      const presets={plastic:{roughness:.3,metalness:.05,clearcoat:.7,clearcoatRoughness:.22},metal:{roughness:.24,metalness:.78,clearcoat:.25},cloth:{roughness:.92,metalness:0},glow:{roughness:.28,metalness:.2,emissive:color,emissiveIntensity:1.7},slime:{roughness:.19,metalness:.08,clearcoat:1,clearcoatRoughness:.1},porcelain:{roughness:.2,metalness:.08,clearcoat:1}};
      this.materials.set(key,new THREE.MeshPhysicalMaterial({color,...presets[kind]}));
    }return this.materials.get(key);
  }
  roundBox(color,position,scale,parent){return this.mesh(this.roundedGeometry,color,position,scale,parent);}
  buildBattleProps(){
    this.ramps=[];
    // Bases en extremos opuestos; la franja central queda libre para salir.
    for(const [team,cx,cz,color] of [['toys',-18,103,'#72b48f'],['nightmares',0,-103,'#746295']]){
      const group=new THREE.Group();group.name=`base-${team}`;this.root.add(group);const back=team==='toys'?1:-1;
      for(const side of [-1,1]){
        const x=cx+side*15,z=cz+back*4;const tower=this.cover(color,x,z,5,10,5);group.add(tower);
        for(const dx of [-1.5,1.5])this.box(team==='toys'?'#e9bd66':'#aa84bf',[x+dx,10.5,z],[1.3,1.2,5],group);
        this.sphere(team==='toys'?'#e9f9af':'#f599bf',[x,7,z-back*2.6],[.55,.8,.2],group);
      }
      const wall=this.cover(color,cx,cz+back*11,32,6,2);group.add(wall);
      this.addText(team==='toys'?'BASE JUGUETES':'BASE PESADILLAS',[cx,9,cz+back*10-back*.2],22,team==='toys'?'#e7fbbd':'#e4b2f4').rotation.y=team==='toys'?Math.PI:0;
      this.box(team==='toys'?'#638f88':'#625779',[cx,.08,cz],[24,.12,14],group);
    }
    // Edificios de cartón: cinta, ventanas, puertas y solapas abiertas.
    for(const [x,z,w,h,d] of [[-36,-64,12,8,10],[35,-68,14,10,11],[-76,40,12,9,10],[67,62,13,7,12],[34,43,9,6,8]]){
      const group=new THREE.Group();group.name='edificio-carton';this.root.add(group);group.add(this.cover('#b28b64',x,z,w,h,d));
      this.box('#d7b58a',[x,h+.06,z],[1,.12,d+.1],group);this.box('#c8a579',[x,h/2,z+d/2+.05],[.8,h,.08],group);
      for(const side of [-1,1]){this.box('#433a3a',[x+side*w*.27,h*.62,z+d/2+.08],[2,2,.12],group);const flap=this.box('#c6a17a',[x+side*w*.45,h+1,z],[w*.25,.15,d],group);flap.rotation.z=side*.55;}
      this.box('#64514b',[x,h*.2,z+d/2+.11],[2.6,h*.4,.15],group);
    }
    // Torres de bloques con tetones y colores de plástico.
    for(const [x,z] of [[-49,-34],[49,-28],[-29,37],[12,65]]){
      const group=new THREE.Group();group.name='torre-bloques';this.root.add(group);
      for(let layer=0;layer<4;layer++){const color=['#d56852','#e9c766','#64a994','#628cae'][layer];const block=this.box(color,[x,1+layer*2,z],[5,2,4],group);for(const dx of [-1.3,1.3])for(const dz of [-1,1])this.mesh(this.cylinderGeometry,color,[x+dx,2.15+layer*2,z+dz],[.5,.3,.5],group);}
      this.obstacles.push({x,z,w:5,d:4,h:8});const collider=new THREE.Mesh(this.boxGeometry,this.material('#64a994'));collider.position.set(x,4,z);collider.scale.set(5,8,4);collider.updateMatrixWorld();this.solids.push(collider);
    }
    for(const [x,z,color] of [[-16,29,'#cf7466'],[49,55,'#71a58c'],[-59,-48,'#829dc2']])this.addBookRamp(x,z,8,15,4,color);
    for(let i=0;i<12;i++){
      const x=(i%2?1:-1)*(20+(i%4)*13),z=-80+i*13;
      const group=new THREE.Group();group.name='crayon';group.position.set(x,.55,z);group.rotation.y=i*.8;this.root.add(group);
      const color=['#d8b859','#7cbb9b','#c7778e','#74a5ce'][i%4];const pencil=this.mesh(this.cylinderGeometry,color,[0,0,0],[.5,7,.5],group);pencil.rotation.x=Math.PI/2;
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.5,1.5,12),this.material('#e9d4aa'));tip.rotation.x=Math.PI/2;tip.position.z=4.2;group.add(tip);
      this.box('#e6d6b8',[0,.48,0],[.4,.05,4],group);
    }
  }
  addBookRamp(x,z,w,d,h,color){
    const group=new THREE.Group();group.name='libro-rampa';this.root.add(group);
    const geometry=new THREE.BoxGeometry(1,1,1),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const px=positions.getX(i)*w,pz=positions.getZ(i)*d;positions.setXYZ(i,px,positions.getY(i)>0?(pz/d+.5)*h+.1:0,pz);}geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,this.material('#ddd4b6'));mesh.position.set(x,0,z);mesh.receiveShadow=mesh.castShadow=true;group.add(mesh);this.solids.push(mesh);
    const cover=new THREE.Mesh(new THREE.PlaneGeometry(w+.2,Math.hypot(d,h)),this.material(color));cover.rotation.x=-Math.PI/2-Math.atan(h/d);cover.position.set(x,h/2+.13,z);cover.receiveShadow=true;group.add(cover);
    for(let layer=.5;layer<h;layer+=.45){const begin=-d/2+(layer-.1)/h*d,length=d/2-begin;for(const side of [-1,1])this.box('#a79b87',[x+side*(w/2+.015),layer,z+(begin+d/2)/2],[.035,.025,length],group);}
    this.box(color,[x,.08,z-d/2],[w+.25,.16,.35],group);
    const ramp={x,z,w,d,h:h+.1,ramp:true,rise:h};this.ramps.push(ramp);this.obstacles.push(ramp);
  }
  groundHeight(x,z){let height=0;for(const r of this.ramps||[])if(Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2)height=Math.max(height,(z-r.z+r.d/2)/r.d*r.rise+.1);return height;}
  mesh(geometry, color, position, scale, parent = this.root) {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // Conserva frustumCulled=true; no se ocultan meshes manualmente por distancia.
    parent.add(mesh);
    return mesh;
  }
  box(color, position, scale, parent) { return this.mesh(this.boxGeometry, color, position, scale, parent); }
  sphere(color, position, scale, parent) { return this.mesh(this.sphereGeometry, color, position, scale, parent); }
  cover(color, x, z, w, h, d) {
    const mesh = this.box(color, [x, h / 2, z], [w, h, d]);
    this.solids.push(mesh);
    this.obstacles.push({ x, z, w, d, h });
    return mesh;
  }
  buildRoom() {
    // Textura procedural local: sin descarga de imágenes ni archivos propietarios.
    const tile = document.createElement('canvas'); tile.width = tile.height = 256;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#bb9873'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#a98665'; ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
      const x = (y / 64 % 2) * 128 + 48;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 64); ctx.stroke();
      ctx.fillStyle = '#cfad8628'; ctx.fillRect(0, y + 9, 256, 3);
    }
    this.floorTexture = new THREE.CanvasTexture(tile);
    this.floorTexture.wrapS = this.floorTexture.wrapT = THREE.RepeatWrapping;
    this.floorTexture.repeat.set(18, 18); this.floorTexture.colorSpace = THREE.SRGBColorSpace;
    this.floorMaterial = new THREE.MeshStandardMaterial({ map: this.floorTexture, roughness: 0.95 });
    this.floorGeometry = new THREE.PlaneGeometry(GAME.worldSize, GAME.worldSize, 32, 32);
    const floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.root.add(floor);
    this.solids.push(floor);

    this.cover('#406e77', 0, -120, 240, 55, 1);
    this.cover('#315965', -120, 0, 1, 55, 240);
    this.cover('#42646b', 120, 0, 1, 55, 240);
    this.cover('#315965', 0, 120, 240, 55, 1);
    for (let x = -112; x <= 112; x += 8) this.box('#527d82', [x, 24, -119.35], [0.18, 48, 0.15]);
    this.box('#d7c69b', [0, 1, -119], [240, 2, 0.8]);
    // Wallpaper: constelaciones y un mural gigante frente al jugador.
    for(let i=0;i<22;i++) {
      const x=-105+i*10,y=22+Math.sin(i*2.3)*8;
      this.box('#8ca9a1',[x,y,119.3],[.35,2.5,.15]);
      this.box('#8ca9a1',[x,y,119.25],[2.5,.35,.15]);
    }
    this.box('#dbbd88',[-74,30,119],[34,30,.5]);
    this.box('#476b7b',[-74,30,118.5],[31,27,.4]);
    this.sphere('#eed5a2',[-75,32,118],[7,7,.25]);
    this.box('#ed9f7b',[-70,27,117.6],[22,.8,.2]);
    // Ventana de luna: fuente visual y luz localizada.
    this.box('#19364f', [28, 26, -118.7], [24, 24, 0.7]);
    this.sphere('#fff0b8', [31, 29, -117.8], [5, 5, 0.5]);
    for (const x of [16, 28, 40]) this.box('#c2cebe', [x, 26, -117.4], [0.6, 25, 1]);
    for (const y of [14, 26, 38]) this.box('#c2cebe', [28, y, -117.3], [25, 0.6, 1]);
    // Alfombra circular bajo la base.
    this.rugGeometry = new THREE.CylinderGeometry(23, 23, 0.12, 64);
    this.mesh(this.rugGeometry, '#4a8582', [0, 0.07, 0], [1, 1, 1]);
    this.ringGeometry = new THREE.TorusGeometry(20, 0.14, 6, 80);
    const ring = this.mesh(this.ringGeometry, '#a8c7a3', [0, 0.16, 0], [1, 1, 1]); ring.rotation.x = Math.PI / 2;

    // Fortaleza: bloques con remates, almohadas y una bandera de tela primitiva.
    this.cover('#79b6a0', -11, -8, 7, 8, 7);
    this.cover('#e5ad68', 11, -8, 7, 10, 7);
    this.cover('#6c9a9c', 0, -12, 16, 5, 6);
    for (const x of [-13, -9, 9, 13]) this.box('#e5c794', [x, x < 0 ? 8.5 : 10.5, -8], [2, 1.2, 7]);
    this.box('#f3d0a1', [0, 6, -12], [14, 2, 5]);
    this.box('#bd7466', [0, 7.5, -12], [12, 1, 4.6]);
    this.box('#ceceac', [11, 14, -8], [0.2, 7, 0.2]);
    this.box('#f08f76', [13.2, 16, -8], [4.5, 2.2, 0.12]);
    this.addText('01', [-11, 4.5, -4.45], 4, '#fff6dc');
    this.addText('TVN', [0, 3, -8.95], 7, '#fff6dc');

    // Libros-montaña y bloques lejanos con LOD: detalle cerca, una caja lejos.
    const colors = ['#d28a70', '#648eae', '#d7b56e', '#79a78e'];
    for (let i = 0; i < 22; i++) {
      const angle = i * 2.399963; const radius = 29 + (i % 4) * 10;
      this.addBlock(Math.cos(angle) * radius, Math.sin(angle) * radius,
        3.8 + i % 3, 3 + i % 5, colors[i % colors.length], i);
    }
    for (let i = 0; i < 5; i++) {
      this.cover(colors[i % 4], -37, -33, 18 - i * 0.7, 2 + i * 2.2, 12 - i * 0.8);
    }
    // Mueble gigante al fondo.
    this.cover('#a17c5f', -46, -69, 42, 4, 14);
    this.cover('#bd9970', -67, -69, 2, 34, 14);
    this.cover('#bd9970', -25, -69, 2, 34, 14);
    for (const y of [15, 29]) this.box('#bd9970', [-46, y, -69], [44, 1.5, 14]);
    for (let i = 0; i < 10; i++) this.box(colors[i % 4], [-63 + i * 3.6, 22, -68], [2.8, 11 - i % 3, 9]);

    // Tren de madera; ruedas reutilizan la misma geometría.
    for (let i = 0; i < 3; i++) {
      const x = 21 + i * 5.3;
      this.cover(colors[i], x, 19, 4.3, 2, 3.2);
      for (const dx of [-1.4, 1.4]) for (const z of [17.3, 20.7]) {
        const wheel = this.mesh(this.cylinderGeometry, '#223c43', [x + dx, 0.8, z], [0.7, 0.4, 0.7]);
        wheel.rotation.x = Math.PI / 2;
      }
    }
    // Figuras decorativas, no bots: animación de menú únicamente.
    for (const [x, z, color, scale] of [[7, 8, '#80bfa0', 2.2], [-4, 5, '#d1a36b', 1.5], [15, 2, '#89a8cc', 1.7]]) {
      const toy = this.createToyModel(color); toy.position.set(x, 0, z); toy.scale.setScalar(scale);
      toy.rotation.y = 0.4; this.ambientToys.push(toy); this.root.add(toy);
    }
  }
  addText(text, position, width, color) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 78px sans-serif';
    const textWidth=ctx.measureText(text).width;if(textWidth>240)ctx.font=`bold ${Math.floor(78*240/textWidth)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({roughness:1,metalness:0, emissive:0xffffff,emissiveMap:texture, map: texture, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 2), material);
    mesh.position.set(...position); this.root.add(mesh);return mesh;
  }
  addBlock(x, z, w, h, color, i) {
    const lod = new THREE.LOD(); lod.position.set(x, h / 2, z);
    const near = new THREE.Group(); this.box(color, [0, 0, 0], [w, h, w], near);
    for (const dx of [-w / 4, w / 4]) for (const dz of [-w / 4, w / 4])
      this.mesh(this.cylinderGeometry, color, [dx, h / 2 + 0.25, dz], [w / 7, 0.5, w / 7], near);
    const far = new THREE.Mesh(this.boxGeometry, this.material(color)); far.scale.set(w, h, w);
    far.castShadow = true; far.receiveShadow = true;
    lod.addLevel(near, 0); lod.addLevel(far, 45, 0.1);
    this.root.add(lod); this.lods.push(lod);
    // Raycast de cámara usa solo la caja de colisión, no ambos niveles del LOD.
    this.solids.push(near.children[0]); this.obstacles.push({ x, z, w, d: w, h });
    if (i < 5) this.addText(String.fromCharCode(65 + i), [x, h / 2, z + w / 2 + .02], w * .8, '#fff3d4');
  }
  createToyModel(color = '#80bfa0') {
    return createCharacterModel(this, color === 'medic' || color === '#d1a36b' ? 'medic' : color === 'mech' || color === '#89a8cc' ? 'mech' : 'commando');
  }
  updateMenu(time) {
    this.ambientToys.forEach((toy, i) => {
      toy.rotation.y = .4 + Math.sin(time * .55 + i * 2) * .18;
      toy.position.y = Math.abs(Math.sin(time * 2 + i)) * .12;
      toy.userData.rig.arms.forEach((arm,j) => { arm.rotation.x = Math.sin(time*2+i+j)*.4; });
    });
    this.animateEnvironment(time);
  }
  buildDistricts() {
    this.portals = [];
    // Una carretera de juguete conecta tres frentes. Las marcas no colisionan.
    this.box('#405f67',[0,.04,61],[15,.06,103]);
    this.box('#405f67',[0,.05,48],[167,.06,12]);
    // Playmats y puentes de bloques recortan los espacios de combate.
    this.box('#889d85',[-30,.06,26],[25,.08,20]);
    this.box('#ab8d7e',[38,.06,30],[24,.08,20]);
    for(const [x,z] of [[-37,22],[-23,32],[30,23],[45,36]]){
      this.cover('#d6bd86',x,z,4,2.4,3);
      this.box('#89a8a9',[x,2.7,z],[4.2,.6,3.2]);
    }
    for (let z=16;z<112;z+=9) this.box('#d4c898',[0,.1,z],[.35,.04,3]);
    for (let x=-78;x<82;x+=9) this.box('#d4c898',[x,.11,48],[3,.04,.35]);
    // Cama / territorio de las pesadillas.
    this.cover('#81749b',36,102,61,4,23);
    this.box('#cdbbba',[36,9,102],[63,7,25]);
    this.box('#798eaf',[41,13,104],[45,2,24]);
    this.box('#e9ddc4',[12,13.5,102],[14,3,20]);
    this.cover('#a38473',4,105,3,23,26); this.cover('#a38473',68,105,3,20,26);
    // Mesa de dibujo, lápices gigantes y cuaderno.
    for (const x of [-104,-68]) for (const z of [65,99]) this.cover('#b89166',x,z,4,27,4);
    this.box('#d7b883',[-86,28,82],[45,3,45]);
    this.box('#ece2c4',[-88,30,80],[28,1,25]);
    for (let i=0;i<6;i++) this.box('#8aafad',[-88,30.55,71+i*3],[23,.07,.12]);
    for (let i=0;i<4;i++) {
      const x=-58+i*6,z=78+i*4; const p=this.cover(['#ed9575','#a8c786','#e6c773','#8eb0cd'][i],x,z,2.3,2.3,24);
      this.box('#eed7a0',[x,1.15,z-14],[2.3,2.3,4]);
      this.box('#344550',[x,1.15,z-16.3],[1.1,1.1,1]);
    }
    // Ciudad de bloques a la derecha, con calles que permanecen transitables.
    // Armario al fondo del segundo sector: puertas, pomos y ropa gigante.
    this.cover('#8a715d',53,-4,30,32,9);
    for(const x of [45,61]){
      this.box('#ac8c69',[x,16,1],[14,30,1]);
      this.box('#775e52',[x,16,1.6],[11,25,.18]);
      this.sphere('#e4c895',[x+(x<53?4:-4),15,2],[.55,.55,.55]);
    }
    this.addText('EL ARMARIO',[53,35,2],22,'#fff0c4');
    this.addText('EL ESCRITORIO',[-86,34,59],27,'#fff0c4');
    this.addText('LA CAMA',[36,18,88],20,'#fff0c4');
    for(const [x,z,color] of [[-61,44,'#d6b16f'],[-39,64,'#88afa2'],[51,30,'#b18da4'],[15,66,'#8bacc7'],[35,82,'#aab985']]){
      this.cover(color,x,z,3,2.2,4);
      this.box('#e8d9b6',[x,2.35,z],[3.2,.3,4.2]);
    }
    for (let row=0;row<4;row++) for (let col=0;col<3;col++) {
      const x=68+col*14,z=-36+row*19, height=4+((row+col)%3)*4;
      this.addBlock(x,z,7,height,['#cd967d','#9caf8a','#7d9fb3'][(row+col)%3],10);
      this.box('#e9d69c',[x,height+1,z],[5,2,5]);
    }
    // Valle de libros: lomos, páginas y separadores visibles.
    for (let i=0;i<8;i++) {
      const x=-82+(i%3)*17,z=-43+Math.floor(i/3)*21;
      this.cover(['#6c8f9f','#ae7c82','#6e9c89'][i%3],x,z,12,4+i%3,14);
      this.box('#e4d8b8',[x+.15,2,z+.2],[11.5,2.8,13]);
      this.box('#ccab6f',[x,4+i%3+.12,z],[12.4,.25,14.4]);
    }
    // Dominó, carretes, canicas y pequeños grupos de piezas para llenar los bordes.
    for (let i=0;i<15;i++) {
      const x=-35+i*4,z=-48+Math.sin(i*.5)*6;
      this.cover('#ead8b3',x,z,1.1,4.5,2.4);
      for (const y of [1.2,3.1]) this.sphere('#49636d',[x,y,z+1.22],[.19,.19,.04]);
    }
    for (let i=0;i<70;i++) {
      const a=i*2.39996,r=64+(i%5)*9,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if (Math.abs(x)<10 || Math.abs(z-48)<9) continue;
      this.sphere(['#afc5a0','#d59583','#8bacc7','#ead19c'][i%4],[x,.65,z],[.6,.65,.6]);
    }
    // Banderines en la fortaleza y luces decorativas suspendidas.
    for (let i=0;i<21;i++) {
      const x=-45+i*4.5,y=22-Math.sin(i/20*Math.PI)*5;
      this.sphere(i%2?'#f0c48b':'#a9d7c1',[x,y,-24],[.35,.5,.35]);
      if (i<20) this.box('#725d51',[x+2.2,y+.4,-24],[4.6,.07,.07]);
    }
    this.addText('VALLE DE LIBROS',[-66,9,-40],19,'#fff0c4');
    this.addText('CIUDAD BLOQUE',[79,15,5],18,'#fff0c4');
    // Portales animados: establecen inequívocamente el frente enemigo.
    const portalGeometry=new THREE.TorusGeometry(3.6,.34,8,36);
    this.portalGeometry=portalGeometry;
    for (const [x,z] of [[-52,52],[0,79],[58,54]]) {
      const group=new THREE.Group(); group.position.set(x,4,z); this.root.add(group);
      const ring=new THREE.Mesh(portalGeometry,new THREE.MeshStandardMaterial({color:'#ac70ed',emissive:'#8540cd',emissiveIntensity:1.4}));group.add(ring);
      const inside=this.sphere('#281e40',[0,0,0],[3.2,3.2,.35],group);
      this.portals.push({group,ring,inside,x,z});
      this.portals.at(-1).label=this.addText('PESADILLAS',[x,9,z],13,'#ffc0db');
    }
    // Objetivo central, visible también desde el minimapa.
    this.core=new THREE.Group(); this.root.add(this.core);
    this.box('#976d4b',[0,.8,0],[4,1.6,3],this.core);
    this.box('#d4b77b',[0,1.75,0],[4.2,.5,3.2],this.core);
    for(const x of [-1.5,1.5])this.box('#e6c987',[x,.8,1.55],[.2,1.6,.12],this.core);
    this.box('#f4d880',[0,1.1,1.65],[.6,.7,.2],this.core);
    this.coreOrb=this.sphere('#def9a0',[0,3,0],[1.2,1.2,1.2],this.core);
    this.coreOrb.material=new THREE.MeshStandardMaterial({color:'#e0ffa1',emissive:'#9eda65',emissiveIntensity:.7});
    this.coreRing=new THREE.Mesh(new THREE.TorusGeometry(2,.08,8,40),this.material('#e2f9a6'));
    this.coreRing.position.y=3; this.core.add(this.coreRing);
    this.coreLabel=this.addText('COFRE CENTRAL',[0,7,0],12,'#e4ffab');
  }
  animateEnvironment(time) {
    for (const p of this.portals) {
      p.ring.rotation.z=time*.45; p.inside.scale.set(3.2+Math.sin(time*2)*.15,3.2+Math.sin(time*2)*.15,.35);
      p.group.position.y=4+Math.sin(time*1.4+p.x)*.22;
    }
    this.coreOrb.position.y=3+Math.sin(time*2)*.25;
    this.coreRing.rotation.set(time*.45,time*.65,0);
  }
  batchStatic() {
    // Fusiona por material y celda espacial para reducir draw calls sin hacer
    // que una sola caja envolvente del mapa anule el frustum culling. Los rigs,
    // LOD y portales quedan
    // separados. Las mallas de colisión conservan sus matrices mundiales.
    this.root.updateMatrixWorld(true);
    const batches=new Map();
    const animated=new Set([...this.ambientToys,...this.lods,...this.portals.map(p=>p.group),this.core]);
    const candidates=[];this.root.traverse(node=>{if(!node.isMesh||node.isInstancedMesh||node.material.transparent)return;for(let p=node.parent;p&&p!==this.root;p=p.parent)if(animated.has(p))return;candidates.push(node);});
    this.originalStaticGeometries=new Set();
    for (const mesh of candidates) {
      const key=mesh.material.uuid+':'+Math.floor(mesh.matrixWorld.elements[12]/50)+':'+Math.floor(mesh.matrixWorld.elements[14]/50);
      if (!batches.has(key)) batches.set(key,{material:mesh.material,meshes:[]});
      batches.get(key).meshes.push(mesh);
    }
    this.staticGeometries=[];
    for (const {material,meshes} of batches.values()) {
      if (meshes.length<3) continue;
      const geometries=meshes.map(mesh=>(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld));
      const geometry=mergeGeometries(geometries);
      geometries.forEach(g=>g.dispose());
      if (!geometry) continue;
      const merged=new THREE.Mesh(geometry,material); merged.castShadow=true;merged.receiveShadow=true;
      this.root.add(merged);this.staticGeometries.push(geometry);meshes.forEach(mesh=>{this.originalStaticGeometries.add(mesh.geometry);mesh.removeFromParent();});
    }
  }
  /** Colisiones AABB en X/Z, resueltas eje por eje por el motor. */
  blocked(x, z, feetY, radius) {
    for (const o of this.obstacles) {
      if(o.ramp&&feetY+.55>=this.groundHeight(x,z))continue;
      if (feetY < o.h && x + radius > o.x - o.w / 2 && x - radius < o.x + o.w / 2 &&
          z + radius > o.z - o.d / 2 && z - radius < o.z + o.d / 2) return true;
    }
    return false;
  }
  dispose() {
    const geometries = new Set(this.originalStaticGeometries||[]), materials = new Set(this.materials.values()), textures = new Set();for(const mesh of this.solids)geometries.add(mesh.geometry);
    this.root.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) materials.add(node.material);
    });
    for (const material of materials) { if (material.map) textures.add(material.map); material.dispose(); }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    this.scene.remove(this.root);
  }
}

