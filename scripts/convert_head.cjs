// Convert meshopt-compressed head.glb to standard draco-compressed GLB
// This script reads the model using three-stdlib's GLTFLoader with meshopt,
// simplifies the geometry, and re-exports as a clean standard GLB.

const THREE = require('three');
const { GLTFLoader, GLTFExporter, DRACOLoader, MeshoptDecoder } = require('three-stdlib');
const fs = require('fs');
const path = require('path');

// Polyfill for Node.js environment
global.self = global;
global.window = { 
  innerWidth: 1024, 
  innerHeight: 768,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        getContext: () => ({
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(0) }),
        }),
        width: 0,
        height: 0,
        toDataURL: () => '',
      };
    }
    return {};
  },
  createElementNS: () => ({}),
};
global.URL = { createObjectURL: () => '' };
global.Blob = class Blob {};
global.Image = class Image {};
global.ImageBitmap = class ImageBitmap {};
global.HTMLCanvasElement = class HTMLCanvasElement {};

const inputPath = path.join(__dirname, '..', 'public', 'models', 'head.glb');
const outputPath = path.join(__dirname, '..', 'public', 'models', 'head_optimized.glb');

console.log('Reading input file...');
const inputData = fs.readFileSync(inputPath);
const arrayBuffer = inputData.buffer.slice(inputData.byteOffset, inputData.byteOffset + inputData.byteLength);

console.log(`Input size: ${(inputData.length / 1024 / 1024).toFixed(2)} MB`);

// Parse just the JSON to get geometry data
const jsonChunkLength = inputData.readUInt32LE(12);
const jsonStr = inputData.toString('utf8', 20, 20 + jsonChunkLength);
const gltfJson = JSON.parse(jsonStr);

// Get the binary chunk
const binChunkOffset = 20 + jsonChunkLength;
const binChunkLength = inputData.readUInt32LE(binChunkOffset);
const binStart = binChunkOffset + 8;

console.log(`\nModel info:`);
console.log(`  Vertices: ${gltfJson.accessors[gltfJson.meshes[0].primitives[0].attributes.POSITION].count}`);
console.log(`  Extensions: ${JSON.stringify(gltfJson.extensionsUsed)}`);

// Since we can't easily decode meshopt in Node.js without the WASM module,
// let's try a different approach: strip the meshopt extension and 
// point bufferViews to the decompressed data

// Actually, the simplest approach is to just make the head model
// loadable without meshopt by the browser. The issue is that the
// browser's MeshoptDecoder might not initialize.

// Let's try: use the GLTFLoader with meshopt decoder
const loader = new GLTFLoader();

// Check if MeshoptDecoder needs ready
console.log('\nMeshoptDecoder type:', typeof MeshoptDecoder);
console.log('MeshoptDecoder keys:', MeshoptDecoder ? Object.keys(MeshoptDecoder) : 'null');

if (MeshoptDecoder && MeshoptDecoder.ready) {
  console.log('Waiting for MeshoptDecoder.ready...');
  MeshoptDecoder.ready.then(() => {
    console.log('MeshoptDecoder ready!');
    loader.setMeshoptDecoder(MeshoptDecoder);
    parseModel();
  }).catch(err => {
    console.error('MeshoptDecoder.ready failed:', err);
  });
} else {
  console.log('No ready promise, trying directly...');
  if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
  parseModel();
}

function parseModel() {
  loader.parse(arrayBuffer, '', (gltf) => {
    console.log('\nModel parsed successfully!');
    const scene = gltf.scene;
    
    scene.traverse((child) => {
      if (child.isMesh) {
        const geom = child.geometry;
        const pos = geom.getAttribute('position');
        console.log(`  Mesh "${child.name}": ${pos.count} vertices`);
        
        // Compute bounding box
        geom.computeBoundingBox();
        const bb = geom.boundingBox;
        console.log(`  BBox: (${bb.min.x.toFixed(3)}, ${bb.min.y.toFixed(3)}, ${bb.min.z.toFixed(3)}) to (${bb.max.x.toFixed(3)}, ${bb.max.y.toFixed(3)}, ${bb.max.z.toFixed(3)})`);
      }
    });
    
    console.log('\nDone!');
  }, (error) => {
    console.error('Parse error:', error.message || error);
  });
}
