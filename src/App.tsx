import { useState, useRef, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Float, Text, MeshWobbleMaterial, Stars, RoundedBox, Center } from '@react-three/drei'
import * as THREE from 'three'

// Types
interface Task {
  id: string
  text: string
  completed: boolean
  completedAt?: number
}

interface Reward {
  id: string
  type: 'star' | 'coin' | 'gem'
  position: [number, number, number]
}

// Glowing material for streak blocks
function GlowingBlock({ position, color, index, total }: { position: [number, number, number], color: string, index: number, total: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const isTop = index === total - 1

  useFrame((state) => {
    if (meshRef.current && isTop) {
      meshRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
      meshRef.current.scale.z = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <RoundedBox args={[0.9, 0.4, 0.9]} radius={0.08} smoothness={4}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTop ? 0.8 : 0.3}
          metalness={0.6}
          roughness={0.2}
        />
      </RoundedBox>
    </mesh>
  )
}

// Streak Tower - the main visual centerpiece
function StreakTower({ completedCount }: { completedCount: number }) {
  const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff6600', '#ff0088', '#00ff00']

  const blocks = useMemo(() => {
    return Array.from({ length: completedCount }, (_, i) => ({
      position: [0, i * 0.45 - 1, 0] as [number, number, number],
      color: colors[i % colors.length]
    }))
  }, [completedCount])

  return (
    <group>
      {/* Base platform */}
      <mesh position={[0, -1.5, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 2, 0.3, 32]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Glowing ring base */}
      <mesh position={[0, -1.3, 0]}>
        <torusGeometry args={[1.2, 0.08, 16, 64]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={0.5} />
      </mesh>

      {/* Streak blocks */}
      {blocks.map((block, i) => (
        <GlowingBlock
          key={i}
          position={block.position}
          color={block.color}
          index={i}
          total={completedCount}
        />
      ))}

      {/* Trophy on top when streak >= 5 */}
      {completedCount >= 5 && (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <Trophy position={[0, completedCount * 0.45 - 0.3, 0]} />
        </Float>
      )}
    </group>
  )
}

// Procedural Trophy
function Trophy({ position }: { position: [number, number, number] }) {
  const trophyRef = useRef<THREE.Group>(null!)

  useFrame((state) => {
    if (trophyRef.current) {
      trophyRef.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <group ref={trophyRef} position={position} scale={0.5}>
      {/* Cup */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.4, 0.25, 0.6, 32]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffd700" emissiveIntensity={0.4} metalness={1} roughness={0.1} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 16]} />
        <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.2} />
      </mesh>
      {/* Base */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.15, 32]} />
        <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.1} />
      </mesh>
      {/* Handles */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.45 * side, 0.3, 0]} rotation={[0, 0, Math.PI / 2 * side]}>
          <torusGeometry args={[0.15, 0.03, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.1} />
        </mesh>
      ))}
    </group>
  )
}

// Floating reward particles
function FloatingReward({ position, type }: { position: [number, number, number], type: 'star' | 'coin' | 'gem' }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const initialY = useRef(position[1])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02
      meshRef.current.position.y = initialY.current + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.3
    }
  })

  const colors = {
    star: '#ffff00',
    coin: '#ffd700',
    gem: '#ff00ff'
  }

  return (
    <mesh ref={meshRef} position={position} scale={0.3}>
      {type === 'star' && <octahedronGeometry args={[0.5]} />}
      {type === 'coin' && <cylinderGeometry args={[0.4, 0.4, 0.1, 32]} />}
      {type === 'gem' && <dodecahedronGeometry args={[0.4]} />}
      <MeshWobbleMaterial
        color={colors[type]}
        emissive={colors[type]}
        emissiveIntensity={0.6}
        factor={0.3}
        speed={2}
        metalness={0.8}
        roughness={0.1}
      />
    </mesh>
  )
}

// Particle explosion effect
function ParticleExplosion({ active, position }: { active: boolean, position: [number, number, number] }) {
  const particlesRef = useRef<THREE.Points>(null!)
  const timeRef = useRef(0)

  const particleCount = 50
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = 0
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = 0
    }
    return pos
  }, [])

  const velocities = useMemo(() => {
    const vel = []
    for (let i = 0; i < particleCount; i++) {
      vel.push({
        x: (Math.random() - 0.5) * 0.3,
        y: Math.random() * 0.2 + 0.1,
        z: (Math.random() - 0.5) * 0.3
      })
    }
    return vel
  }, [])

  useFrame((_, delta) => {
    if (!particlesRef.current || !active) return

    timeRef.current += delta
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      posArray[i * 3] += velocities[i].x
      posArray[i * 3 + 1] += velocities[i].y - timeRef.current * 0.01
      posArray[i * 3 + 2] += velocities[i].z
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  if (!active) return null

  return (
    <points ref={particlesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#00ffff" sizeAttenuation transparent opacity={0.8} />
    </points>
  )
}

// Streak counter display in 3D
function StreakDisplay({ count }: { count: number }) {
  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
      <Center position={[0, 4, 0]}>
        <Text
          font="https://fonts.gstatic.com/s/pressstart2p/v15/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff"
          fontSize={0.8}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#ff00ff"
        >
          {`STREAK: ${count}`}
        </Text>
      </Center>
    </Float>
  )
}

// 3D Scene
function Scene({ completedCount, rewards, explosionActive }: { completedCount: number, rewards: Reward[], explosionActive: boolean }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#00ffff" />
      <pointLight position={[-5, 5, -5]} intensity={0.8} color="#ff00ff" />
      <spotLight position={[0, 10, 0]} intensity={1.5} angle={0.3} penumbra={0.5} color="#ffffff" />

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0.5} fade speed={1} />

      <StreakTower completedCount={completedCount} />
      <StreakDisplay count={completedCount} />

      {rewards.map((reward) => (
        <FloatingReward key={reward.id} position={reward.position} type={reward.type} />
      ))}

      <ParticleExplosion active={explosionActive} position={[0, completedCount * 0.45 - 1, 0]} />

      {/* Ground grid */}
      <gridHelper args={[20, 20, '#00ffff', '#1a1a2e']} position={[0, -1.65, 0]} />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={4}
        maxDistance={15}
        maxPolarAngle={Math.PI / 2}
        enablePan={false}
      />
      <Environment preset="night" />
    </>
  )
}

// Main App
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', text: 'Complete morning workout', completed: false },
    { id: '2', text: 'Review project proposal', completed: false },
    { id: '3', text: 'Send weekly report', completed: false },
    { id: '4', text: 'Meditate for 10 minutes', completed: false },
    { id: '5', text: 'Read 20 pages', completed: false },
  ])
  const [newTask, setNewTask] = useState('')
  const [rewards, setRewards] = useState<Reward[]>([])
  const [explosionActive, setExplosionActive] = useState(false)
  const [showShare, setShowShare] = useState(false)

  const completedCount = tasks.filter(t => t.completed).length

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id && !task.completed) {
        // Add reward
        const types: ('star' | 'coin' | 'gem')[] = ['star', 'coin', 'gem']
        const newReward: Reward = {
          id: Date.now().toString(),
          type: types[Math.floor(Math.random() * types.length)],
          position: [
            (Math.random() - 0.5) * 4,
            Math.random() * 2 + 2,
            (Math.random() - 0.5) * 4
          ]
        }
        setRewards(prev => [...prev, newReward])

        // Trigger explosion
        setExplosionActive(true)
        setTimeout(() => setExplosionActive(false), 1000)

        return { ...task, completed: true, completedAt: Date.now() }
      }
      return task
    }))
  }, [])

  const addTask = useCallback(() => {
    if (newTask.trim()) {
      setTasks(prev => [...prev, {
        id: Date.now().toString(),
        text: newTask.trim(),
        completed: false
      }])
      setNewTask('')
    }
  }, [newTask])

  const shareStreak = useCallback(() => {
    setShowShare(true)
    setTimeout(() => setShowShare(false), 3000)
  }, [])

  return (
    <div className="w-screen h-screen bg-[#0a0a1a] overflow-hidden relative" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 3, 8], fov: 50 }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <Scene completedCount={completedCount} rewards={rewards} explosionActive={explosionActive} />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="pointer-events-auto">
              <h1
                className="text-2xl md:text-4xl font-bold tracking-wider"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  background: 'linear-gradient(90deg, #00ffff, #ff00ff, #ffff00)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 30px rgba(0,255,255,0.5)'
                }}
              >
                DONE STREAK
              </h1>
              <p className="text-[#00ffff] text-xs md:text-sm mt-1 opacity-70 tracking-widest uppercase">
                Build Your Productivity Tower
              </p>
            </div>

            {/* Stats Badge */}
            <div
              className="pointer-events-auto bg-[#1a1a2e]/90 backdrop-blur-md border border-[#00ffff]/30 rounded-lg p-3 md:p-4"
              style={{ boxShadow: '0 0 20px rgba(0,255,255,0.2), inset 0 0 20px rgba(0,255,255,0.05)' }}
            >
              <div className="text-center">
                <div
                  className="text-3xl md:text-5xl font-bold text-[#ffff00]"
                  style={{
                    fontFamily: "'Press Start 2P', cursive",
                    textShadow: '0 0 20px rgba(255,255,0,0.8)'
                  }}
                >
                  {completedCount}
                </div>
                <div className="text-[10px] md:text-xs text-[#ff00ff] tracking-widest mt-1">COMPLETED</div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Panel */}
        <div className="absolute bottom-20 md:bottom-24 left-4 right-4 md:left-6 md:right-auto md:w-96 pointer-events-auto">
          <div
            className="bg-[#0a0a1a]/95 backdrop-blur-xl border border-[#ff00ff]/40 rounded-xl p-4 md:p-5"
            style={{
              boxShadow: '0 0 40px rgba(255,0,255,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
              background: 'linear-gradient(135deg, rgba(26,26,46,0.95) 0%, rgba(10,10,26,0.98) 100%)'
            }}
          >
            <h2
              className="text-sm md:text-base font-bold text-[#ff00ff] mb-4 tracking-widest flex items-center gap-2"
              style={{ fontFamily: "'Press Start 2P', cursive" }}
            >
              <span className="w-2 h-2 bg-[#ff00ff] rounded-full animate-pulse"></span>
              MISSIONS
            </h2>

            {/* Task list */}
            <div className="space-y-2 max-h-40 md:max-h-52 overflow-y-auto custom-scrollbar">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  disabled={task.completed}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-300 flex items-center gap-3 group ${
                    task.completed
                      ? 'bg-[#00ff88]/10 border border-[#00ff88]/30'
                      : 'bg-[#1a1a2e]/80 border border-[#00ffff]/20 hover:border-[#00ffff]/60 hover:bg-[#1a1a2e]'
                  }`}
                  style={{ minHeight: '48px' }}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    task.completed
                      ? 'bg-[#00ff88] border-[#00ff88]'
                      : 'border-[#00ffff]/50 group-hover:border-[#00ffff]'
                  }`}>
                    {task.completed && (
                      <svg className="w-3 h-3 text-[#0a0a1a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm flex-1 ${
                    task.completed
                      ? 'text-[#00ff88]/70 line-through'
                      : 'text-white/90'
                  }`}>
                    {task.text}
                  </span>
                  {!task.completed && (
                    <span className="text-[10px] text-[#ffff00] opacity-0 group-hover:opacity-100 transition-opacity tracking-wider">
                      +1
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Add task input */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add new mission..."
                className="flex-1 bg-[#1a1a2e] border border-[#00ffff]/30 rounded-lg px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00ffff] transition-colors"
                style={{ minHeight: '48px' }}
              />
              <button
                onClick={addTask}
                className="px-4 bg-gradient-to-r from-[#00ffff] to-[#00ff88] text-[#0a0a1a] font-bold rounded-lg hover:opacity-90 transition-opacity"
                style={{ minWidth: '48px', minHeight: '48px' }}
              >
                +
              </button>
            </div>

            {/* Share button */}
            {completedCount > 0 && (
              <button
                onClick={shareStreak}
                className="mt-4 w-full py-3 bg-gradient-to-r from-[#ff00ff] to-[#ff6600] text-white font-bold rounded-lg tracking-wider text-sm hover:opacity-90 transition-all"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  fontSize: '10px',
                  minHeight: '48px',
                  boxShadow: '0 0 20px rgba(255,0,255,0.3)'
                }}
              >
                SHARE STREAK 🏆
              </button>
            )}
          </div>
        </div>

        {/* Share Modal */}
        {showShare && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto animate-fadeIn">
            <div
              className="bg-[#1a1a2e] border-2 border-[#ffff00] rounded-2xl p-6 md:p-8 text-center mx-4"
              style={{
                boxShadow: '0 0 60px rgba(255,255,0,0.4)',
                animation: 'pulse 2s infinite'
              }}
            >
              <div
                className="text-4xl md:text-6xl font-bold mb-2"
                style={{
                  fontFamily: "'Press Start 2P', cursive",
                  background: 'linear-gradient(90deg, #ffff00, #ff6600, #ff00ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                🔥 {completedCount} 🔥
              </div>
              <p className="text-[#00ffff] text-sm md:text-base mb-4 tracking-wider">TASKS CRUSHED TODAY!</p>
              <p className="text-white/50 text-xs">Screenshot this and flex on your friends!</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
          <p className="text-white/30 text-[10px] md:text-xs tracking-wider">
            Requested by @web-user · Built by @clonkbot
          </p>
        </div>
      </div>

      {/* Custom styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 60px rgba(255,255,0,0.4); }
          50% { box-shadow: 0 0 80px rgba(255,255,0,0.6); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,255,255,0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,255,255,0.5);
        }
      `}</style>
    </div>
  )
}
