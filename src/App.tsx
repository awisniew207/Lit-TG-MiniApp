import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { isRecent, verifyInitData } from "./telegramAuth";
import "./App.css";

interface TelegramWebApp {
  ready: () => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons: Array<{ text: string; type: string }>;
  }) => void;
  initData: string;
  initDataUnsafe: any;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

function App() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<boolean | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const tgApp = window.Telegram?.WebApp;
    if (tgApp) {
      tgApp.ready();
      setWebApp(tgApp);
      setData(tgApp.initData);

      isRecent(tgApp.initData).then((isRecent) => {
        setRecent(isRecent);
      });

      verifyInitData(tgApp.initData, import.meta.env.VITE_TELEGRAM_BOT_TOKEN)
        .then((isVerified) => {
          setValid(isVerified);
        })
        .catch((error) => {
          console.error("Error verifying init data:", error);
          setError("Failed to verify Telegram init data");
        });
    }

    // Set up Three.js scene
    if (canvasRef.current) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      camera.position.set(0, 5, 10);
      camera.lookAt(0, 0, 0);

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(5, 10, 7);
      scene.add(directionalLight);

      // Add OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      controlsRef.current = controls;

      // Load GLB model
      const loader = new GLTFLoader();
      loader.load(
        'city.glb',
        (gltf) => {
          const model = gltf.scene;
          modelRef.current = model;
          scene.add(model);

          // Center the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          // Adjust camera
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          cameraZ *= 1.5; // Zoom out a little so object fits in view
          camera.position.z = cameraZ;
          camera.updateProjectionMatrix();

          // Update controls
          controls.maxDistance = cameraZ * 2;
          controls.target.copy(center);
          controls.update();
        },
        (xhr) => {
          const progress = (xhr.loaded / xhr.total) * 100;
          setLoadingProgress(progress);
          console.log(progress + '% loaded');
        },
        (error) => {
          console.error('An error happened', error);
          setError("Failed to load 3D model");
        }
      );

      // Animation loop
      let animationFrameId: number;
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (cameraRef.current && rendererRef.current) {
          const { innerWidth, innerHeight } = window;
          rendererRef.current.setSize(innerWidth, innerHeight);
          cameraRef.current.aspect = innerWidth / innerHeight;
          cameraRef.current.updateProjectionMatrix();
        }
      };
      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        renderer.dispose();
        controls.dispose();
      };
    }
  }, []);

  const handleCanvasClick = () => {
    setClickCount((prevCount) => prevCount + 1);
  };

  return (
    <div className="App">
      <canvas ref={canvasRef} onClick={handleCanvasClick} />
      <div className="overlay">
        <h3>Click Count: {clickCount}</h3>
        {loadingProgress < 100 && <p>Loading: {loadingProgress.toFixed(2)}%</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export default App;