import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Route as RouteIcon, Zap, Shield, Heart, Code, Target,
  TrendingUp, Compass, Award, Sparkles, Rocket,
  Globe, CheckCircle, Footprints, X,
  Mountain, Timer, Flame, ChevronRight, MapPin,
  Users, Bike, Car, PersonStanding
} from 'lucide-react';
import { Badge } from './ui/badge';

/* ── Team Data ── */
const TEAM = [
  {
    name: 'Kenneth Bitun',
    role: 'Project Lead & Full-Stack Developer',
    color: '#e8634a',          // brand-coral
    colorDark: '#c94d35',
    image: 'https://pub-c5c927d2e80642fa9e11dbcff8612e19.r2.dev/kenneth.png',
    bio: 'Led the development from concept to deployment. Built the route planning system, integrated the Open-Meteo weather API, and developed the physics engine for speed and calorie calculations.',
    skills: ['React', 'TypeScript', 'Node.js', 'Supabase', 'MongoDB'],
    quote: '"I wanted to build something our batchmates would actually use."',
    stats: { commits: '160+', features: '12', cups: '∞' },
  },
  {
    name: 'Pearl Shanley Roselo',
    role: 'UI/UX Designer & Frontend Developer',
    color: '#7c5cbf',          // brand-purple
    colorDark: '#5a3d99',
    image: '/avatars.png',
    bio: 'Responsible for the overall look and feel of FitRoute. Implemented the responsive layouts, and handled the styling for the landing page, about page, and sidebar components.',
    skills: ['TailwindCSS', 'Dynamic Layout', 'UI Components'],
    quote: '"If it looks clean and feels smooth, I did my job right."',
    stats: { commits: '85+', features: '8', cups: '∞' },
  },
  {
    name: 'Czarina Santos',
    role: 'Quality Tester & Assurance',
    color: '#1a9a7a',          // brand-teal
    colorDark: '#d97706',      // amber
    image: '/avatars.png',
    bio: 'Handled all testing and quality checks across the app. Verified route calculations, tested weather data accuracy, checked mobile responsiveness, and documented bugs for the team to fix before deployment.',
    skills: ['Manual Testing', 'Bug Reporting', 'Mobile QA', 'Documentation'],
    quote: '"I break things so users don\'t have to."',
    stats: { commits: '45+', features: '5', cups: '∞' },
  },
];

/* ── Capability Data ── */
const CAPS = [
  { icon: Target, title: 'GPS Tracking', desc: 'Real-time position tracking with intelligent speed calculations across 4 activity modes.', color: 'brand-coral' },
  { icon: TrendingUp, title: 'Physics Engine', desc: 'MET-based calorie calculations, weather-adjusted difficulty scoring, and fuel cost estimates.', color: 'brand-purple' },
  { icon: Compass, title: 'Dynamic Routing', desc: 'Robust fallback chain with Catmull-Rom spline approximation for accurate procedural path generation.', color: 'brand-teal' },
  { icon: Flame, title: 'Weather Analytics', desc: 'Live Open-Meteo integration adjusts difficulty factor based on temperature, rain, and wind.', color: 'brand-coral' },
  { icon: Shield, title: 'Privacy First', desc: 'Zero tracking, zero cookies, zero sign-up. All data stays on your device.', color: 'brand-purple' },
  { icon: Sparkles, title: 'Free Forever', desc: 'No subscriptions, no trial periods, no feature gates. Everything is yours.', color: 'brand-teal' },
];

export default function AboutPage() {
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [hoveredCap, setHoveredCap] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[50vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background Image — same pattern as Home page */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Aerial view of city roads and urban mobility"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute inset-0 bg-brand-coral/15" />
        </div>

        <div className="relative z-10 container mx-auto px-4 sm:px-8 md:px-16 lg:px-24 max-w-5xl text-center py-10 sm:py-16">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, type: 'spring', bounce: 0.4 }}
              className="inline-flex p-5 md:p-6 bg-white/15 backdrop-blur-sm rounded-3xl mb-6 border border-white/20 shadow-2xl"
            >
              <RouteIcon className="w-12 h-12 md:w-16 md:h-16 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-4 tracking-tight"
            >
              FitRoute
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed font-medium mb-8"
            >
              Your smart route companion for the Philippines.
              <br />
              <span className="text-white font-bold text-xl md:text-2xl mt-1 block">Walk. Hike. Jog. Bike. Drive. Analyzed.</span>
            </motion.p>

            {/* Interactive activity mode selector display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
            >
              {[
                { icon: Footprints, label: 'Walk', met: '3.5' },
                { icon: Mountain, label: 'Hike', met: '6.3' },
                { icon: PersonStanding, label: 'Jog', met: '8.0' },
                { icon: Bike, label: 'Bike', met: '7.5' },
                { icon: Car, label: 'Drive', met: 'Fuel' },
              ].map((mode, i) => (
                <motion.div
                  key={mode.label}
                  whileHover={{ scale: 1.1, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl cursor-pointer hover:bg-white/25 transition-colors"
                >
                  <mode.icon className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">{mode.label}</span>
                  <span className="text-[10px] text-white/60 font-mono">MET {mode.met}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Curved wave layer */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" className="w-full">
            <path d="M0 100L48 87.5C96 75 192 50 288 41.7C384 33.3 480 41.7 576 50C672 58.3 768 66.7 864 62.5C960 58.3 1056 41.7 1152 33.3C1248 25 1344 25 1392 25L1440 25V100H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ═══ MISSION ═══ */}
      <section className="py-12 sm:py-16 md:py-24 px-4 sm:px-8 md:px-16 lg:px-24">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-brand-coral/10 text-brand-coral border border-brand-coral/20 font-bold mb-4 text-xs px-3 py-1">OUR MISSION</Badge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 mb-5">
                Fitness for <span className="text-brand-coral">Everyone</span>
              </h2>
              <div className="space-y-4 text-base text-gray-600 leading-relaxed">
                <p><strong className="text-brand-coral">FitRoute</strong> was born from a simple belief: fitness tracking should be <strong className="text-gray-900">accessible to everyone</strong>, without compromising privacy or breaking the bank.</p>
                <p>Built on <strong className="text-brand-purple">open-source technologies</strong> — your data stays on your device, your workouts remain private, and your progress is yours alone.</p>
              </div>
              <div className="mt-6 bg-gradient-to-r from-brand-coral/8 to-brand-teal/8 rounded-xl p-5 border-l-4 border-brand-coral">
                <p className="text-lg font-bold text-gray-900">No ads. No tracking. No limits.<br /><span className="text-brand-coral">Just pure, powerful fitness analytics.</span></p>
              </div>
            </motion.div>

            {/* Interactive stat cards */}
            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4">
              {[
                { value: '5', label: 'Travel Modes', icon: Footprints, color: 'brand-coral' },
                { value: '10+', label: 'Live Metrics', icon: TrendingUp, color: 'brand-purple' },
                { value: '1,500+', label: 'Mountains', icon: Mountain, color: 'brand-teal' },
                { value: '∞', label: 'Free Routes', icon: Sparkles, color: 'brand-coral' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className={`bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl border-2 border-gray-100 hover:border-${stat.color}/30 transition-all cursor-pointer text-center`}
                >
                  <div className={`inline-flex p-3 bg-${stat.color}/10 rounded-xl mb-3`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}`} />
                  </div>
                  <div className="text-3xl font-black text-gray-900">{stat.value}</div>
                  <div className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES — Large interactive grid ═══ */}
      <section className="py-12 sm:py-16 md:py-24 px-4 sm:px-8 md:px-16 lg:px-24 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <Badge className="bg-brand-purple/10 text-brand-purple border border-brand-purple/20 font-bold mb-4 text-xs px-3 py-1">CAPABILITIES</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">What Powers <span className="text-brand-coral">FitRoute</span></h2>
            <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto">Click any capability to learn more about the technology behind it.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPS.map((cap, i) => {
              const isHovered = hoveredCap === i;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onHoverStart={() => setHoveredCap(i)}
                  onHoverEnd={() => setHoveredCap(null)}
                  className={`relative bg-white rounded-2xl p-6 md:p-7 shadow-lg hover:shadow-2xl border-2 border-gray-100 hover:border-${cap.color}/30 transition-all cursor-pointer overflow-hidden group`}
                >
                  {/* Hover glow */}
                  <motion.div
                    animate={{ opacity: isHovered ? 0.06 : 0 }}
                    className={`absolute inset-0 bg-${cap.color}`}
                  />

                  <div className="relative z-10">
                    <motion.div
                      animate={{ rotate: isHovered ? 10 : 0, scale: isHovered ? 1.1 : 1 }}
                      className={`inline-flex p-4 bg-${cap.color}/10 rounded-2xl mb-4`}
                    >
                      <cap.icon className={`w-7 h-7 text-${cap.color}`} />
                    </motion.div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">{cap.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{cap.desc}</p>

                    <motion.div
                      animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
                      className={`mt-4 flex items-center gap-1.5 text-xs font-bold text-${cap.color}`}
                    >
                      <span>Learn more</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ TEAM — Full-image cards, hover-reveal details on right ═══ */}
      <section className="py-12 sm:py-16 md:py-24 px-4 sm:px-8 md:px-16 lg:px-24 bg-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <Badge className="bg-brand-teal/10 text-brand-teal border border-brand-teal/20 font-bold mb-4 text-xs px-3 py-1">THE TEAM</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">The <span className="text-brand-coral">Team</span> Behind FitRoute</h2>
            <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto">Hover over a card to discover who built FitRoute.</p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6 md:gap-8">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (window.innerWidth < 640) setSelectedMember(i);
                }}
                className="group cursor-pointer sm:cursor-default"
              >
                <div className="relative rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl border-2 border-gray-100 hover:border-brand-coral/30 transition-all h-[340px] sm:h-[420px] md:h-[480px]">
                  {/* Full-bleed image */}
                  <img
                    src={member.image}
                    alt={member.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />

                  {/* Bottom gradient with name — always visible */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-20 transition-opacity duration-300 group-hover:opacity-0">
                    <h4 className="text-xl md:text-2xl font-black text-white mb-1">{member.name}</h4>
                    <p className="text-sm text-white/70 font-medium">{member.role}</p>
                    {/* Mobile tap hint */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-coral mt-2 sm:hidden">
                      <span>Tap for Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Desktop: hover overlay — fades in with member details */}
                  <div className="hidden sm:flex absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out">
                    <div
                      className="w-full h-full backdrop-blur-[3px] flex flex-col justify-end p-6 md:p-8"
                      style={{ background: `linear-gradient(to top, ${member.color}f0, ${member.color}cc 50%, ${member.color}40 80%, transparent)` }}
                    >
                      {/* Quote */}
                      <p className="text-[12px] text-white/70 italic mb-3 leading-snug">{member.quote}</p>

                      {/* Name & role */}
                      <h4 className="text-xl md:text-2xl font-black text-white mb-0.5">{member.name}</h4>
                      <p className="text-sm text-white/80 font-medium mb-2">{member.role}</p>

                      {/* Bio */}
                      <p className="text-[12px] text-white/75 leading-relaxed mb-3">{member.bio}</p>

                      {/* Skill tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {member.skills.map((skill) => (
                          <span
                            key={skill}
                            className="text-[10px] font-bold text-white/90 px-2.5 py-1 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm uppercase tracking-wider"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Commits', value: member.stats.commits },
                          { label: 'Features', value: member.stats.features },
                          { label: 'Coffee', value: member.stats.cups },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
                            <div className="text-lg font-black text-white">{s.value}</div>
                            <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TEAM MEMBER MODAL ═══ */}
      <AnimatePresence>
        {selectedMember !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={() => setSelectedMember(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              {(() => {
                const m = TEAM[selectedMember];
                return (
                  <>
                    <div className="relative">
                      <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-sm rounded-xl hover:bg-black/50 transition-colors z-10">
                        <X className="w-5 h-5 text-white" />
                      </button>
                      <div className="w-full h-56 md:h-72 overflow-hidden">
                        <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                      </div>
                      <div
                        className="px-8 py-5"
                        style={{ background: `linear-gradient(135deg, ${m.color}, ${m.colorDark})` }}
                      >
                        <h3 className="text-2xl font-black text-white mb-1">{m.name}</h3>
                        <p className="text-white/80 text-sm font-medium">{m.role}</p>
                      </div>
                    </div>
                    <div className="p-6 md:p-8">
                      <p className="text-gray-500 italic text-sm mb-3">{m.quote}</p>
                      <p className="text-gray-600 leading-relaxed mb-4">{m.bio}</p>
                      {/* Skill tags */}
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {m.skills.map((skill) => (
                          <span
                            key={skill}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider"
                            style={{ color: m.color, borderColor: `${m.color}40`, backgroundColor: `${m.color}10` }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Commits', value: m.stats.commits },
                          { label: 'Features', value: m.stats.features },
                          { label: 'Coffee', value: m.stats.cups },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                            <div className="text-xl font-black text-gray-900">{s.value}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TECH STACK ═══ */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-8 md:px-16 lg:px-24 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <Badge className="bg-brand-coral/10 text-brand-coral border border-brand-coral/20 font-bold mb-4 text-xs px-3 py-1">TECH STACK</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">Built With Excellence</h2>
            <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto">Powered by battle-tested open-source technologies</p>
          </motion.div>

          <div className="relative overflow-hidden py-6 rounded-2xl">
            <style>{`
              @keyframes scrollTech { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
              .scroll-tech { animation: scrollTech 28s linear infinite; }
              .scroll-tech:hover { animation-play-state: paused; }
            `}</style>
            <div className="flex scroll-tech w-max">
              {[
                { name: 'React', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
                { name: 'TypeScript', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
                { name: 'Tailwind', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg' },
                { name: 'JavaScript', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
                { name: 'Leaflet', logo: 'https://leafletjs.com/docs/images/logo.png' },
                { name: 'Node.js', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
                { name: 'Git', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg' },
                { name: 'Vite', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg' },
                { name: 'React', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
                { name: 'TypeScript', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
                { name: 'Tailwind', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg' },
                { name: 'JavaScript', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
                { name: 'Leaflet', logo: 'https://leafletjs.com/docs/images/logo.png' },
                { name: 'Node.js', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
                { name: 'Git', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg' },
                { name: 'Vite', logo: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vitejs/vitejs-original.svg' },
              ].map((tech, index) => (
                <motion.div key={index} whileHover={{ scale: 1.15, y: -6 }} className="flex-shrink-0 pr-6 group cursor-pointer">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl border border-gray-200 group-hover:border-brand-coral/30 shadow-sm group-hover:shadow-xl p-3.5 flex items-center justify-center transition-all duration-300">
                    <img src={tech.logo} alt={tech.name} className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 mt-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">{tech.name}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}