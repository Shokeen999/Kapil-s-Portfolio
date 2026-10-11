const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, '..', 'public', 'models', 'head.glb');
const buf = fs.readFileSync(glbPath);

// Parse GLB
const chunk0Length = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(jsonStr);

// Binary chunk
const chunk1Offset = 20 + chunk0Length;
const chunk1Length = buf.readUInt32LE(chunk1Offset);
const binStart = chunk1Offset + 8;
const binBuf = buf.slice(binStart, binStart + chunk1Length);

// Check for meshopt compression
const posAccessorIdx = gltf.meshes[0].primitives[0].attributes.POSITION;
const posAccessor = gltf.accessors[posAccessorIdx];
const posBufferView = gltf.bufferViews[posAccessor.bufferView];

console.log('Position accessor:', JSON.stringify(posAccessor, null, 2));
console.log('\nPosition bufferView:', JSON.stringify(posBufferView, null, 2));

// Check accessor min/max (glTF spec requires these for POSITION)
if (posAccessor.min && posAccessor.max) {
  console.log('\n=== FROM ACCESSOR MIN/MAX ===');
  console.log(`X: [${posAccessor.min[0].toFixed(4)}, ${posAccessor.max[0].toFixed(4)}] range: ${(posAccessor.max[0] - posAccessor.min[0]).toFixed(4)}`);
  console.log(`Y: [${posAccessor.min[1].toFixed(4)}, ${posAccessor.max[1].toFixed(4)}] range: ${(posAccessor.max[1] - posAccessor.min[1]).toFixed(4)}`);
  console.log(`Z: [${posAccessor.min[2].toFixed(4)}, ${posAccessor.max[2].toFixed(4)}] range: ${(posAccessor.max[2] - posAccessor.min[2]).toFixed(4)}`);
  
  const sizeX = posAccessor.max[0] - posAccessor.min[0];
  const sizeY = posAccessor.max[1] - posAccessor.min[1];
  const sizeZ = posAccessor.max[2] - posAccessor.min[2];
  const centerX = (posAccessor.min[0] + posAccessor.max[0]) / 2;
  const centerY = (posAccessor.min[1] + posAccessor.max[1]) / 2;
  const centerZ = (posAccessor.min[2] + posAccessor.max[2]) / 2;
  
  console.log(`\nSize: (${sizeX.toFixed(4)}, ${sizeY.toFixed(4)}, ${sizeZ.toFixed(4)})`);
  console.log(`Center: (${centerX.toFixed(4)}, ${centerY.toFixed(4)}, ${centerZ.toFixed(4)})`);
  console.log(`Height (Y): ${sizeY.toFixed(4)}`);
  
  // Estimate neck Y: for a standing human, neck is about 78-82% up from feet
  const neckRatio = 0.80;
  const neckY = posAccessor.min[1] + sizeY * neckRatio;
  console.log(`\nEstimated neck Y (~${(neckRatio*100).toFixed(0)}% up): ${neckY.toFixed(4)}`);
  
  // Head top is ~12% of total height
  const headTop = posAccessor.max[1];
  const headBottom = posAccessor.min[1] + sizeY * 0.75;
  console.log(`Head region estimate: Y [${headBottom.toFixed(4)} .. ${headTop.toFixed(4)}]`);
}

// Check extensions used
console.log('\n=== EXTENSIONS ===');
console.log('extensionsUsed:', gltf.extensionsUsed);
console.log('extensionsRequired:', gltf.extensionsRequired);

// Check if bufferViews use meshopt
let hasMeshopt = false;
gltf.bufferViews.forEach((bv, i) => {
  if (bv.extensions && bv.extensions.EXT_meshopt_compression) {
    if (!hasMeshopt) {
      console.log('\nMeshopt compression detected on bufferViews');
      hasMeshopt = true;
    }
  }
});

// Also check node transforms
console.log('\n=== NODE TRANSFORM ===');
const node = gltf.nodes[0];
console.log('translation:', node.translation);
console.log('rotation:', node.rotation);
console.log('scale:', node.scale);
console.log('matrix:', node.matrix);
