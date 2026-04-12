import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  ZoomableGroup
} from 'react-simple-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, X, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// URL do TopoJSON verificado e funcional
const BRAZIL_TOPOJSON_URL = "https://gist.githubusercontent.com/ruliana/1ccaaab05ea113b0dff3b22be3b4d637/raw/196c0332d38cb935cfca227d28f7cecfa70b412e/br-states.json";

const REGIONS_CONFIG = {
  norte: { name: 'Norte', color: '#0ea5e9', states: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'], center: [-60, -3], zoom: 2.5 },
  nordeste: { name: 'Nordeste', color: '#f59e0b', states: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'], center: [-40, -10], zoom: 3 },
  centro_oeste: { name: 'Centro-Oeste', color: '#10b981', states: ['DF', 'GO', 'MT', 'MS'], center: [-53, -15], zoom: 3.5 },
  sudeste: { name: 'Sudeste', color: '#6366f1', states: ['ES', 'MG', 'RJ', 'SP'], center: [-45, -20], zoom: 4.5 },
  sul: { name: 'Sul', color: '#ec4899', states: ['PR', 'RS', 'SC'], center: [-52, -27], zoom: 4.5 }
};

// Zoom por estado individual
const STATE_ZOOM_CONFIG = {
  'AC': { center: [-70, -9], zoom: 5 }, 'AL': { center: [-36, -9.5], zoom: 10 }, 'AP': { center: [-51, 1], zoom: 5 },
  'AM': { center: [-63, -3], zoom: 2.5 }, 'BA': { center: [-41, -12], zoom: 4 }, 'CE': { center: [-39, -5], zoom: 7 },
  'DF': { center: [-47.8, -15.8], zoom: 20 }, 'ES': { center: [-40.5, -19.5], zoom: 8 }, 'GO': { center: [-49, -16], zoom: 5 },
  'MA': { center: [-45, -5], zoom: 4.5 }, 'MT': { center: [-55, -13], zoom: 3.5 }, 'MS': { center: [-54, -20], zoom: 5 },
  'MG': { center: [-44, -18], zoom: 4 }, 'PA': { center: [-52, -5], zoom: 3 }, 'PB': { center: [-36.5, -7], zoom: 10 },
  'PR': { center: [-51, -25], zoom: 6 }, 'PE': { center: [-37, -8], zoom: 8 }, 'PI': { center: [-42, -7], zoom: 4.5 },
  'RJ': { center: [-43, -22], zoom: 9 }, 'RN': { center: [-36, -5.5], zoom: 10 }, 'RS': { center: [-53, -30], zoom: 5 },
  'RO': { center: [-63, -11], zoom: 5 }, 'RR': { center: [-61, 2], zoom: 5 }, 'SC': { center: [-50, -27], zoom: 7 },
  'SP': { center: [-48, -23], zoom: 5.5 }, 'SE': { center: [-37, -10.5], zoom: 12 }, 'TO': { center: [-48, -10], zoom: 4.5 }
};

const STATE_NAMES = {
  'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia',
  'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás',
  'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais',
  'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí',
  'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo',
  'SE': 'Sergipe', 'TO': 'Tocantins'
};

const STATE_GEO_COORDS = {
  'AC': [-70, -9], 'AL': [-36, -9], 'AP': [-51, 1], 'AM': [-63, -3],
  'BA': [-41, -12], 'CE': [-39, -5], 'DF': [-47, -15], 'ES': [-40, -19],
  'GO': [-49, -16], 'MA': [-45, -5], 'MT': [-55, -13], 'MS': [-54, -20],
  'MG': [-44, -18], 'PA': [-52, -5], 'PB': [-36, -7], 'PR': [-51, -25],
  'PE': [-37, -8], 'PI': [-42, -7], 'RJ': [-43, -22], 'RN': [-36, -5],
  'RS': [-53, -30], 'RO': [-63, -11], 'RR': [-61, 2], 'SC': [-50, -27],
  'SP': [-48, -23], 'SE': [-37, -10], 'TO': [-48, -10]
};

export default function BrazilInteractiveMap({ services = [] }) {
  const [selectedState, setSelectedState] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [autoRotateIdx, setAutoRotateIdx] = useState(0);
  const isManualHover = useRef(false);

  const filteredServices = useMemo(() => {
    if (selectedState) return services.filter(s => s.state_uf === selectedState);
    if (selectedRegion) {
      const regionStates = REGIONS_CONFIG[selectedRegion].states;
      return services.filter(s => regionStates.includes(s.state_uf));
    }
    return services.slice(0, 50);
  }, [services, selectedState, selectedRegion]);

  // Auto-rotate: cicla pelos marcadores a cada 10 segundos
  useEffect(() => {
    if (filteredServices.length === 0) return;
    const interval = setInterval(() => {
      if (!isManualHover.current) {
        setAutoRotateIdx(prev => (prev + 1) % filteredServices.length);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [filteredServices.length]);

  // Reset auto-rotate index quando filtro muda
  useEffect(() => {
    setAutoRotateIdx(0);
  }, [selectedState, selectedRegion]);

  const handleMarkerEnter = useCallback((idx) => {
    isManualHover.current = true;
    setHoveredState(`marker-${idx}`);
  }, []);

  const handleMarkerLeave = useCallback(() => {
    isManualHover.current = false;
    setHoveredState(null);
  }, []);

  const currentZoom = useMemo(() => {
    if (selectedState) return STATE_ZOOM_CONFIG[selectedState] || { center: [-55, -15], zoom: 1 };
    if (selectedRegion) return REGIONS_CONFIG[selectedRegion];
    return { center: [-55, -15], zoom: 1 };
  }, [selectedState, selectedRegion]);

  const handleStateClick = (uf) => {
    if (selectedState === uf) {
      setSelectedState(null);
    } else {
      setSelectedState(uf);
      setSelectedRegion(null);
    }
  };

  const handleRegionClick = (key) => {
    if (selectedRegion === key) {
      setSelectedRegion(null);
    } else {
      setSelectedRegion(key);
      setSelectedState(null);
    }
  };

  const handleReset = () => {
    setSelectedState(null);
    setSelectedRegion(null);
  };

  const hasSelection = selectedState || selectedRegion;

  // Subtítulo dinâmico
  const subtitle = useMemo(() => {
    if (selectedState) return `${STATE_NAMES[selectedState] || selectedState} (${selectedState})`;
    if (selectedRegion) return REGIONS_CONFIG[selectedRegion].name;
    return 'Território Nacional';
  }, [selectedState, selectedRegion]);

  return (
    <Card className="relative w-full aspect-[16/9] bg-[#0A0C10] border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden rounded-[3rem] group border">
      <div className="absolute top-10 left-10 z-30 pointer-events-none">
        <div className="flex items-center gap-6 transition-all duration-500">
           <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-3xl shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <Activity className="h-7 w-7 text-indigo-400 animate-pulse" />
           </div>
           <div className="flex flex-col">
              <h3 className="text-white font-black text-3xl tracking-tighter uppercase leading-none mb-1">
                AGF Core GeoNet
              </h3>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">{subtitle}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="absolute top-10 right-10 z-40 flex gap-4">
        <AnimatePresence>
          {hasSelection && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: 20 }}
            >
              <Button 
                variant="ghost" 
                onClick={handleReset}
                className="bg-white/5 hover:bg-white/10 text-white rounded-3xl border border-white/10 px-8 h-14 backdrop-blur-3xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl transition-all hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5 mr-3" /> Reset Vision
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 650 }}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={currentZoom.center}
            zoom={currentZoom.zoom}
            filterZoomEvent={(evt) => evt.type !== "wheel"}
          >
            <Geographies geography={BRAZIL_TOPOJSON_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const uf = geo.id; 
                  const regionEntry = Object.entries(REGIONS_CONFIG).find(([_, config]) => 
                    config.states.includes(uf)
                  );
                  const regionKey = regionEntry ? regionEntry[0] : null;
                  const regionColor = regionEntry ? regionEntry[1].color : "#1e293b";
                  
                  // Calcular se o estado está ativo/dimmed
                  let isHighlighted = false;
                  let isDimmed = false;

                  if (selectedState) {
                    // Modo estado: só o estado clicado fica destacado
                    isHighlighted = selectedState === uf;
                    isDimmed = !isHighlighted;
                  } else if (selectedRegion) {
                    // Modo região: todos os estados da região ficam destacados
                    isHighlighted = regionKey === selectedRegion;
                    isDimmed = !isHighlighted;
                  }

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHoveredState(uf)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() => handleStateClick(uf)}
                      style={{
                        default: {
                          fill: isDimmed ? "rgba(255,255,255,0.03)" : regionColor,
                          fillOpacity: isDimmed ? 1 : (isHighlighted ? 0.45 : 0.15),
                          stroke: isDimmed ? "rgba(255,255,255,0.05)" : (isHighlighted ? regionColor : "rgba(255,255,255,0.25)"),
                          strokeWidth: isHighlighted ? 1.5 : 0.6,
                          outline: "none",
                          filter: isHighlighted ? `drop-shadow(0 0 10px ${regionColor})` : "none",
                        },
                        hover: {
                          fill: regionColor,
                          fillOpacity: 0.5,
                          stroke: regionColor,
                          strokeWidth: 1.5,
                          outline: "none",
                          cursor: "pointer",
                          filter: `drop-shadow(0 0 8px ${regionColor})`,
                        },
                        pressed: {
                          outline: "none",
                        }
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {filteredServices.map((service, idx) => {
                const geoCoords = STATE_GEO_COORDS[service.state_uf];
                if (!geoCoords) return null;

                const jitterLat = (idx % 10) * 0.4 - 2;
                const jitterLong = (idx % 8) * 0.4 - 1.5;

                return (
                  <Marker 
                    key={`pin-${idx}`} 
                    coordinates={[geoCoords[0] + jitterLong, geoCoords[1] + jitterLat]}
                  >
                    <g 
                      className="cursor-pointer group/pin"
                      onMouseEnter={() => handleMarkerEnter(idx)}
                      onMouseLeave={handleMarkerLeave}
                    >
                        <circle r={4 / currentZoom.zoom} fill="rgba(239, 68, 68, 0.4)">
                            <animate attributeName="r" from={2 / currentZoom.zoom} to={8 / currentZoom.zoom} dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        
                        <path 
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                          fill="#ef4444" 
                          transform={`translate(${-12 / currentZoom.zoom}, ${-22 / currentZoom.zoom}) scale(${1 / currentZoom.zoom})`}
                          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        />
                    </g>
                  </Marker>
                );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip fixo no container - manual hover ou auto-rotate */}
      {(() => {
        // Prioridade: hover manual > auto-rotate
        let activeService = null;
        let activeIdx = -1;
        let isAuto = false;

        if (hoveredState?.startsWith('marker-')) {
          activeIdx = parseInt(hoveredState.split('-')[1]);
          activeService = filteredServices[activeIdx];
        } else if (filteredServices.length > 0) {
          activeIdx = autoRotateIdx % filteredServices.length;
          activeService = filteredServices[activeIdx];
          isAuto = true;
        }

        if (!activeService) return null;
        return (
          <div key={`tooltip-${activeIdx}-${isAuto}`} className="absolute top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none" style={{ animation: 'tooltipFade 0.4s ease-out' }}>
            <div className="bg-black/95 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/20 border-l-4 border-l-red-500 shadow-2xl shadow-black/50">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight leading-tight">
                    {(activeService.technician_name || 'TÉCNICO').toUpperCase()}
                  </p>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">
                    <span className="text-indigo-400">{activeService.city_name}</span> / {activeService.state_uf}
                  </p>
                  {activeService.client_name && (
                    <p className="text-[10px] font-medium text-slate-500 mt-1 truncate max-w-[250px]">
                      Cliente: {activeService.client_name}
                    </p>
                  )}
                </div>
                {isAuto && filteredServices.length > 1 && (
                  <div className="flex items-center gap-1 ml-2 pl-3 border-l border-white/10">
                    <span className="text-[9px] font-bold text-slate-600 tabular-nums">{activeIdx + 1}/{filteredServices.length}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes tooltipFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div className="absolute bottom-6 left-10 z-30">
        <div className="flex flex-wrap bg-black/60 backdrop-blur-3xl p-1.5 rounded-[2rem] border border-white/10 gap-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            {Object.entries(REGIONS_CONFIG).map(([key, reg]) => (
                <button 
                  key={key} 
                  onClick={() => handleRegionClick(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all duration-500 border border-transparent ${
                    selectedRegion === key 
                    ? 'bg-white/10 border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                    : 'hover:bg-white/5 opacity-50 hover:opacity-100'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reg.color, boxShadow: `0 0 10px ${reg.color}` }} />
                  <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">{reg.name}</span>
                </button>
            ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-10 z-30">
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-2xl px-6 py-3 rounded-[1.5rem] border border-white/5 shadow-2xl">
            <div className="flex flex-col gap-0.5">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Links</span>
                <span className="text-sm font-black text-white tabular-nums tracking-tighter leading-none">{services.length}</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div className="flex items-center gap-2.5">
                 <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[8px] font-black text-emerald-500/80 uppercase tracking-widest leading-none">Health</span>
                    <span className="text-[9px] font-bold text-slate-400 leading-none">99.4%</span>
                 </div>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse" />
            </div>
        </div>
      </div>
    </Card>
  );
}
