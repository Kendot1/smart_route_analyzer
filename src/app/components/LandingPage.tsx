import { motion } from "motion/react";
import {
  Route,
  Map,
  Cloud,
  TrendingUp,
  Clock,
  Zap,
  CheckCircle,
  Navigation,
  Heart,
  Footprints,
  Mountain,
} from "lucide-react";
import GradientButton from "./GradientButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";

interface LandingPageProps {
  onEnterApp: (mode: "track" | "plan") => void;
}

export default function LandingPage({
  onEnterApp,
}: LandingPageProps) {

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Full Screen with Image Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="City skyline with roads and urban mobility"
            className="w-full h-full object-cover"
          />
          {/* Solid color overlays instead of gradients */}
          <div className="absolute inset-0 bg-black/70"></div>
          <div className="absolute inset-0 bg-brand-coral/10"></div>
        </div>

        <div className="relative z-10 container mx-auto px-8 md:px-16 lg:px-24 py-8 md:py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center gap-3 md:gap-4"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                duration: 0.8,
                type: "spring",
                bounce: 0.4,
              }}
              className="relative"
            >
              <div className="absolute inset-0 bg-brand-coral rounded-xl opacity-30 blur-xl"></div>
              <div className="relative bg-brand-coral p-2 md:p-3 rounded-xl shadow-2xl">
                <Route className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-block"
            >
              <Badge className="bg-white/10 backdrop-blur-xl text-white border border-white/30 px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-bold shadow-md">
                <Zap className="w-2.5 h-2.5 md:w-3 md:h-3 inline mr-1 md:mr-1.5 text-brand-coral" />
                Free Forever • No Sign-up Required
              </Badge>
            </motion.div>

            {/* Headline */}
            <div className="space-y-2 md:space-y-3 max-w-3xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-4xl sm:text-6xl font-black text-white leading-tight"
              >
                Plan Smarter,
                <br />
                <span className="text-brand-coral">
                  Move Better
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-sm md:text-base text-gray-200 max-w-xl mx-auto leading-relaxed"
              >
                Your smart route companion for walking, hiking,
                jogging, biking, and driving. Get weather-aware travel
                times, real-time GPS tracking, and AI-powered analytics.
              </motion.p>

              {/* Trust Indicators */}
              
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-3 md:mt-5 items-center sm:items-start justify-center sm:justify-start">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group"
              >
                <button
                  onClick={() => onEnterApp("track")}
                  className="relative text-xs md:text-sm px-4 py-2.5 md:px-6 md:py-3 bg-brand-coral text-white rounded-lg font-bold shadow-xl flex items-center gap-1.5 md:gap-2"
                >
                  <Route className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>Start Tracking Now</span>
                  <span>→</span>
                </button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative group"
              >
                <button
                  onClick={() => onEnterApp("plan")}
                  className="text-xs md:text-sm px-4 py-2.5 md:px-6 md:py-3 bg-white/10 backdrop-blur-xl text-white border border-white/30 rounded-lg font-bold shadow-md flex items-center gap-1.5 md:gap-2 hover:bg-white/20 transition-all"
                >
                  <Map className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>Plan a Route</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-8 md:px-16 lg:px-24 py-16">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="bg-brand-coral/10 text-brand-coral border border-brand-coral/20 font-bold mb-4 text-xs px-3 py-1">
              FEATURES
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
              Everything You Need to Move Smarter
            </h2>
            <p className="text-sm md:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Powerful features designed to help you plan,
              track, and optimize every trip
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Feature 1: GPS Tracking */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ y: -6 }}
              className="group"
            >
              <div className="h-full bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-transparent hover:border-brand-coral/30">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1773399452188-a42e29543bf2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                    alt="Fitness tracker during workout"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute bottom-3 left-3">
                    <div className="p-2 bg-brand-coral rounded-xl shadow-md">
                      <Route className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-5">
                  <h3 className="text-lg md:text-xl font-black text-gray-900 mb-2">
                    Live Activity Tracking
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-3">
                    Record your walks, runs, and rides with
                    real-time distance, speed, and calorie
                    tracking. Monitor your progress every step
                    of the way.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="bg-brand-coral/10 text-brand-coral border-brand-coral/20 text-[10px]"
                    >
                      Real-time GPS
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-coral/10 text-brand-coral border-brand-coral/20 text-[10px]"
                    >
                      Calorie Counter
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-coral/10 text-brand-coral border-brand-coral/20 text-[10px]"
                    >
                      Pace Tracking
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 2: Route Planning */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -6 }}
              className="group"
            >
              <div className="h-full bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-transparent hover:border-brand-purple/30">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1764347923709-fc48487f2486?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                    alt="Navigation app on phone"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute bottom-3 left-3">
                    <div className="p-2 bg-brand-purple rounded-xl shadow-md">
                      <Navigation className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-5">
                  <h3 className="text-lg md:text-xl font-black text-gray-900 mb-2">
                    Smart Route Planning
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-3">
                    Click on the map to plan your perfect route.
                    Get instant analysis with weather-adjusted
                    calculations and smart recommendations.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="bg-brand-purple/10 text-brand-purple border-brand-purple/20 text-[10px]"
                    >
                      Interactive Maps
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-purple/10 text-brand-purple border-brand-purple/20 text-[10px]"
                    >
                      Distance Calc
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-purple/10 text-brand-purple border-brand-purple/20 text-[10px]"
                    >
                      ETA Estimates
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Feature 3: Outdoor Adventure */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -6 }}
              className="group"
            >
              <div className="h-full bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-transparent hover:border-brand-teal/30">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1775312865751-b249b1746304?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
                    alt="People cycling outdoors"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute bottom-3 left-3">
                    <div className="p-2 bg-brand-teal rounded-xl shadow-md">
                      <Route className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-5">
                  <h3 className="text-lg md:text-xl font-black text-gray-900 mb-2">
                    Weather-Smart Analytics
                  </h3>
                  <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-3">
                    Real-time weather data adjusts your route
                    difficulty and provides personalized
                    recommendations for any travel mode.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="secondary"
                      className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 text-[10px]"
                    >
                      Temperature
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 text-[10px]"
                    >
                      Wind Speed
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 text-[10px]"
                    >
                      Rainfall
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-8 md:px-16 lg:px-24 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <Badge className="bg-brand-purple/10 text-brand-purple border border-brand-purple/20 px-3 py-1 text-xs font-bold mb-3">
              HOW IT WORKS
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Get Started in Seconds
            </h2>
            <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto">
              Simple, intuitive, and powerful. Plan your next
              trip in just a few taps.
            </p>
          </motion.div>

          <div className="space-y-12">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row gap-6 items-center"
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-coral text-white font-bold text-sm sm:text-base mb-3 shadow-md">
                  <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Choose Your Mode
                </div>
                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
                  Select Your Travel Mode
                </h3>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-3">
                  Select from Walking, Hiking, Jogging, Biking, or
                  Driving. Each mode is optimized with specific
                  physics calculations for accurate calorie burn
                  and performance tracking.
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="px-2 py-1 bg-brand-coral/10 text-brand-coral rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                    <Footprints className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    Walking
                  </div>
                  <div className="px-2 py-1 bg-amber-600/10 text-amber-700 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                    <Mountain className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    Hiking
                  </div>
                  <div className="px-2 py-1 bg-brand-purple/10 text-brand-purple rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                    <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    Jogging
                  </div>
                  <div className="px-2 py-1 bg-brand-teal/10 text-brand-teal rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5">
                    <Route className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    Biking
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative rounded-xl overflow-hidden shadow-lg">
                  <img
                    src="https://images.unsplash.com/photo-1759256243611-502772ac391b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                    alt="Person using navigation app"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row-reverse gap-6 items-center"
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-purple text-white font-bold text-sm sm:text-base mb-3 shadow-md">
                  <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
                    2
                  </span>
                  Track or Plan
                </div>
                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
                  Start Your Journey
                </h3>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                  Begin GPS tracking to record your activity in
                  real-time, or tap the map to plan your route
                  ahead of time. Get instant distance, time, and
                  difficulty calculations.
                </p>
              </div>
              <div className="flex-1">
                <div className="relative rounded-xl overflow-hidden shadow-lg">
                  <img
                    src="https://images.unsplash.com/photo-1579427091530-efe9fc8bd76c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
                    alt="Beautiful coastal view"
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="bg-white/90 backdrop-blur-xl rounded-lg p-2.5 shadow-md">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="font-bold text-gray-900 text-[10px] md:text-xs">
                          Live Tracking Active
                        </span>
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-600">
                        Distance: 2.4 km • Time: 18 min
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row gap-6 items-center"
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-teal text-white font-bold text-sm sm:text-base mb-3 shadow-md">
                  <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Get Smart Insights
                </div>
                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
                  Weather-Powered Analytics
                </h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Real-time weather conditions automatically
                  adjust difficulty calculations. Get
                  personalized recommendations based on
                  temperature, wind, and rainfall to stay safe
                  and optimize performance.
                </p>
              </div>
              <div className="flex-1">
                <div className="relative rounded-xl overflow-hidden shadow-lg bg-brand-teal/10 p-4 md:p-5">
                  <div className="bg-white rounded-lg p-3 md:p-4 shadow-md mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="w-6 h-6 md:w-8 md:h-8 text-brand-teal" />
                      <div>
                        <div className="text-xl md:text-2xl font-black text-gray-900">
                          28°C
                        </div>
                        <div className="text-[10px] md:text-xs text-gray-600">
                          Partly Cloudy
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] md:text-xs">
                      <div>
                        <div className="text-gray-600">
                          Wind
                        </div>
                        <div className="font-bold text-gray-900">
                          12 km/h
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">
                          Difficulty
                        </div>
                        <div className="font-bold text-green-600">
                          Easy
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-20 px-8 md:px-16 lg:px-24 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Aerial view of city roads at night"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70"></div>
          <div className="absolute inset-0 bg-brand-coral/20"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative container mx-auto text-center max-w-3xl"
        >
          <div className="inline-flex p-4 bg-brand-coral rounded-2xl mb-6 shadow-xl">
            <Route className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
            Ready to Plan Smarter?
          </h2>
          <p className="text-sm md:text-base text-gray-200 mb-8 max-w-xl mx-auto leading-relaxed">
            Walk, jog, bike, or drive — get weather-aware analytics
            for every route.
            <br />
            <span className="text-white font-semibold mt-1 block">
              No sign-up • Free forever • Privacy first
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-3 md:mt-5 items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => onEnterApp("track")}
                className="text-sm md:text-base bg-brand-coral text-white rounded-xl font-black shadow-xl flex items-center gap-2 hover:shadow-2xl transition-all px-6 py-3"
              >
                <Route className="w-4 h-4 md:w-5 md:h-5" />
                Launch App Now
                <span>→</span>
              </button>
            </motion.div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-white/80 text-xs md:text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-teal" />
              <span>Modern browsers supported</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-brand-teal" />
              <span>Location access required for GPS</span>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}