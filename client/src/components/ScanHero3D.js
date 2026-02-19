import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './ScanHero3D.css';

function ScanHero3D({ children }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.set(0, 2.4, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const light = new THREE.PointLight(0x1abc9c, 1.3, 20);
    light.position.set(3, 4, 5);
    scene.add(light);

    const textLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    textLight1.position.set(0, 2, 5);
    scene.add(textLight1);

    const textLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    textLight2.position.set(0, -1, 3);
    scene.add(textLight2);

    const grid = new THREE.GridHelper(8, 20, 0xe74c3c, 0x1abc9c);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    const ring1Geom = new THREE.TorusGeometry(1.8, 0.06, 16, 120);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      metalness: 0.5,
      roughness: 0.3,
      emissive: 0x3b0f0b,
    });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.2;
    scene.add(ring1);

    const ring2Geom = new THREE.TorusGeometry(1.2, 0.04, 16, 100);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x1abc9c,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0x0a3a3a,
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.4;
    scene.add(ring2);

    const particles = new THREE.Group();
    const particleGeom = new THREE.SphereGeometry(0.04, 12, 12);
    const particleMat1 = new THREE.MeshStandardMaterial({ color: 0x1abc9c, emissive: 0x0a3a3a });
    const particleMat2 = new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0x3b0f0b });
    for (let i = 0; i < 40; i += 1) {
      const material = i % 3 === 0 ? particleMat2 : particleMat1;
      const particle = new THREE.Mesh(particleGeom, material);
      const radius = 1.5 + Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      particle.position.set(
        Math.cos(theta) * radius,
        Math.random() * 1.8 + 0.2,
        Math.sin(theta) * radius
      );
      particle.userData = { speed: 0.5 + Math.random() * 0.8, offset: i * 0.2 };
      particles.add(particle);
    }
    scene.add(particles);

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

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
    const clock = new THREE.Clock();
    let frameId;

    const animate = () => {
      const t = clock.getElapsedTime();
      pointerRef.current.x += (targetRef.current.x - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (targetRef.current.y - pointerRef.current.y) * 0.05;

      ring1.rotation.z = t * 0.4 + pointerRef.current.x * 0.3;
      ring1.rotation.y = t * 0.2 - pointerRef.current.y * 0.2;
      ring2.rotation.z = -t * 0.5 - pointerRef.current.x * 0.4;
      ring2.rotation.y = t * 0.15 + pointerRef.current.y * 0.25;
      
      particles.children.forEach((p, idx) => {
        const { speed, offset } = p.userData;
        p.position.y = 0.3 + Math.sin(t * speed + offset) * 0.2 + (idx % 5) * 0.05;
      });
      camera.position.x = pointerRef.current.x * 0.3;
      camera.position.y = 2.4 + pointerRef.current.y * 0.2;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      animate();
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
      ring1Geom.dispose();
      ring1Mat.dispose();
      ring2Geom.dispose();
      ring2Mat.dispose();
      particleGeom.dispose();
      particleMat1.dispose();
      particleMat2.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="scan-hero-3d" ref={containerRef}>
      <canvas ref={canvasRef} className="scan-hero-3d-canvas" aria-hidden="true" />
      <div className="scan-hero-text-overlay">
        <h1 className="scan-3d-title">
          <span className="scan-3d-title-top">FIGHTING</span>
          <span className="scan-3d-title-bottom">DENGUE</span>
        </h1>
      </div>
      <div className="scan-hero-3d-overlay">
        {children}
      </div>
    </div>
  );
}

export default ScanHero3D;
