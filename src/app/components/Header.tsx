import { Route, Home, MapPin, Info, Navigation, Radio } from 'lucide-react';

interface HeaderProps {
  currentPage: 'home' | 'app' | 'about';
  viewMode?: 'plan' | 'track';
  onViewModeChange?: (mode: 'plan' | 'track') => void;
  onNavigateHome: () => void;
  onNavigateTrack: () => void;
  onNavigateAbout: () => void;
  fixed?: boolean;
}

export default function Header({
  currentPage,
  viewMode,
  onViewModeChange,
  onNavigateHome,
  onNavigateTrack,
  onNavigateAbout,
  fixed = false
}: HeaderProps) {
  const headerClass = fixed
    ? "absolute top-0 left-0 right-0 z-[1001] bg-white shadow-sm border-b border-gray-100"
    : "sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100";

  return (
    <header className={headerClass}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button onClick={onNavigateHome} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="bg-brand-coral p-2 rounded-xl">
              <Route className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-brand-coral tracking-tight">
              FitRoute
            </h1>
          </button>

          {/* Center: Always-visible nav + GPS/Plan appended on app page */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={onNavigateHome}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  currentPage === 'home'
                    ? 'text-brand-coral bg-brand-coral/10'
                    : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                }`}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={onNavigateTrack}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  currentPage === 'app'
                    ? 'text-brand-coral bg-brand-coral/10'
                    : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                }`}
              >
                <MapPin className="w-4 h-4" />
                Track
              </button>
              <button
                onClick={onNavigateAbout}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  currentPage === 'about'
                    ? 'text-brand-coral bg-brand-coral/10'
                    : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                }`}
              >
                <Info className="w-4 h-4" />
                About
              </button>

              {currentPage === 'app' && onViewModeChange && viewMode && (
                <>
                  <div className="w-px h-5 bg-gray-200 mx-1" />
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => onViewModeChange('track')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                        viewMode === 'track'
                          ? 'bg-brand-coral text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      GPS
                    </button>
                    <button
                      onClick={() => onViewModeChange('plan')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                        viewMode === 'plan'
                          ? 'bg-brand-coral text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Plan
                    </button>
                  </div>
                </>
              )}
            </nav>
          </div>

          {/* Right side - Mobile navigation or placeholder */}
          <nav className="md:hidden flex items-center gap-1">
            {currentPage !== 'app' && (
              <>
                <button
                  onClick={onNavigateHome}
                  className={`p-2 rounded-lg transition-all ${
                    currentPage === 'home' ? 'text-brand-coral bg-brand-coral/10' : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                  }`}
                  title="Home"
                >
                  <Home className="w-4 h-4" />
                </button>
                <button
                  onClick={onNavigateTrack}
                  className={`p-2 rounded-lg transition-all ${
                    currentPage === 'app' ? 'text-brand-coral bg-brand-coral/10' : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                  }`}
                  title="Track"
                >
                  <MapPin className="w-4 h-4" />
                </button>
                <button
                  onClick={onNavigateAbout}
                  className={`p-2 rounded-lg transition-all ${
                    currentPage === 'about' ? 'text-brand-coral bg-brand-coral/10' : 'text-gray-600 hover:text-brand-coral hover:bg-gray-100'
                  }`}
                  title="About"
                >
                  <Info className="w-4 h-4" />
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
