import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import './FrontHero.css';

function FrontHero({ onStartScan }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const [modelStatus, setModelStatus] = useState('loading');

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4.6);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const light = new THREE.PointLight(0xff6b6b, 1.2, 20);
    light.position.set(4, 3, 6);
    scene.add(light);

    const group = new THREE.Group();
    group.scale.set(1.25, 1.25, 1.25);
    scene.add(group);

    const coreGeom = new THREE.IcosahedronGeometry(1.35, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1abc9c,
      emissive: 0x0b3a3a,
      metalness: 0.45,
      roughness: 0.35,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    group.add(core);

    const ringGeom = new THREE.TorusGeometry(2.1, 0.09, 16, 140);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.6,
      roughness: 0.25,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    let mosquitoModel;
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
      '/models/mosquito.glb',
      (gltf) => {
        mosquitoModel = gltf.scene;
        mosquitoModel.scale.set(1.4, 1.4, 1.4);
        mosquitoModel.position.set(0, -0.2, 0);
        mosquitoModel.rotation.set(0, Math.PI * 0.6, 0);
        group.add(mosquitoModel);
        core.visible = false;
        setModelStatus('ready');
      },
      undefined,
      () => {
        setModelStatus('error');
      }
    );

    const particleCount = 120;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 2.2 + Math.random() * 1.1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.035,
      opacity: 0.7,
      transparent: true,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    group.add(particles);

    const handlePointer = (event) => {
      const rect = container.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0]?.clientX : event.clientX;
      const clientY = event.touches ? event.touches[0]?.clientY : event.clientY;
      if (clientX == null || clientY == null) return;
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      targetRef.current = { x, y };
    };

    const handlePointerLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    let resizeObserver;
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        window.requestAnimationFrame(resize);
      }, 100);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(debouncedResize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', debouncedResize);
    }

    container.addEventListener('pointermove', handlePointer, { passive: true });
    container.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    container.addEventListener('touchmove', handlePointer, { passive: true });
    container.addEventListener('touchend', handlePointerLeave, { passive: true });

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    let frameId;
    const clock = new THREE.Clock();

    const renderFrame = () => {
      const t = clock.getElapsedTime();
      pointerRef.current.x += (targetRef.current.x - pointerRef.current.x) * 0.06;
      pointerRef.current.y += (targetRef.current.y - pointerRef.current.y) * 0.06;

      group.rotation.y = t * 0.25 + pointerRef.current.x * 0.4;
      group.rotation.x = pointerRef.current.y * 0.25;
      core.rotation.x = t * 0.4 + pointerRef.current.y * 0.3;
      core.rotation.y = t * 0.3 + pointerRef.current.x * 0.25;
      if (mosquitoModel) {
        mosquitoModel.rotation.y = t * 0.35 + pointerRef.current.x * 0.5;
        mosquitoModel.rotation.x = pointerRef.current.y * 0.25;
      }
      ring.rotation.z = t * 0.55 - pointerRef.current.x * 0.35;
      particles.rotation.y = -t * 0.18 + pointerRef.current.x * 0.2;
      particles.rotation.x = pointerRef.current.y * 0.15;
      camera.position.x = pointerRef.current.x * 0.4;
      camera.position.y = pointerRef.current.y * 0.3;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderFrame);
    };

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      renderFrame();
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
      container.removeEventListener('pointermove', handlePointer);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.removeEventListener('touchmove', handlePointer);
      container.removeEventListener('touchend', handlePointerLeave);
      if (mosquitoModel) {
        mosquitoModel.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
      dracoLoader.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="front-hero" ref={containerRef}>
      <canvas ref={canvasRef} className="front-hero-canvas" aria-hidden="true" />
      <div className="front-hero-content">
        <span className="front-hero-badge">AI-Powered Safety</span>
        <h2>Spot risks before they become outbreaks</h2>
        <p>
          Scan your surroundings and get instant guidance on preventing mosquito
          breeding sites. Clean smarter, act faster, protect your community.
        </p>
        {modelStatus !== 'ready' && (
          <div className={`front-hero-status ${modelStatus}`}>
            {modelStatus === 'loading' ? 'Loading 3D mosquito model…' : '3D model failed to load — using fallback.'}
          </div>
        )}
        <div className="front-hero-actions">
          <button className="front-hero-primary" onClick={onStartScan}>
            Start Scan
          </button>
          <div className="front-hero-meta">
            <span>Instant guidance</span>
            <span>AI detection</span>
            <span>Community impact</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FrontHero;
