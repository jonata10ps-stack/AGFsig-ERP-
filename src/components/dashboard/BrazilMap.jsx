import React, { useState, useMemo } from 'react';
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

// Coordenadas geográficas aproximadas para os estados (para pins se não houver cidade)
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
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);

  const currentZoom = useMemo(() => {
    if (!selectedRegion) return { center: [-55, -15], zoom: 1 };
    return REGIONS_CONFIG[selectedRegion];
  }, [selectedRegion]);

  const handleRegionClick = (key) => {
    setSelectedRegion(selectedRegion === key ? null : key);
  };

  const filteredServices = useMemo(() => {
    if (!selectedRegion) return services.slice(0, 50);
    const regionStates = REGIONS_CONFIG[selectedRegion].states;
    return services.filter(s => regionStates.includes(s.state_uf));
  }, [services, selectedRegion]);

  return (
    <Card className="relative w-full aspect-[16/9] bg-[#0A0C10] border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden rounded-[3rem] group border">
      {/* HUD Header */}
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
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em]">{selectedRegion ? REGIONS_CONFIG[selectedRegion].name : 'Território Nacional'}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Floating UI Controls */}
      <div className="absolute top-10 right-10 z-40 flex gap-4">
        <AnimatePresence>
          {selectedRegion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.5, x: 20 }}
            >
              <Button 
                variant="ghost" 
                onClick={() => setSelectedRegion(null)}
                className="bg-white/5 hover:bg-white/10 text-white rounded-3xl border border-white/10 px-8 h-14 backdrop-blur-3xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl transition-all hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5 mr-3" /> Reset Vision
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map Implementation using react-simple-maps */}
      <div className="absolute inset-0 flex items-center justify-center">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 650 }}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={currentZoom.center}
            zoom={currentZoom.zoom}
            filterZoomEvent={(evt) => evt.type !== "wheel"} // Desativa zoom de scroll p/ não interferir no dashboard
          >
            <Geographies geography={BRAZIL_TOPOJSON_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const uf = geo.id; // ruliana topojson utiliza id como UF
                  const regionEntry = Object.entries(REGIONS_CONFIG).find(([_, config]) => 
                    config.states.includes(uf)
                  );
                  const regionKey = regionEntry ? regionEntry[0] : null;
                  const regionColor = regionEntry ? regionEntry[1].color : "#1e293b";
                  
                  const isRegSelected = selectedRegion === regionKey;
                  const isRegDimmed = selectedRegion && !isRegSelected;
                  const isHovered = hoveredState === uf;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHoveredState(uf)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() => regionKey && handleRegionClick(regionKey)}
                      style={{
                        default: {
                          fill: isRegDimmed ? "rgba(255,255,255,0.02)" : (isRegSelected ? regionColor : "rgba(255,255,255,0.05)"),
                          fillOpacity: isRegSelected ? 0.2 : 1,
                          stroke: isRegDimmed ? "rgba(255,255,255,0.01)" : (isRegSelected ? regionColor : "rgba(255,255,255,0.1)"),
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: regionColor,
                          fillOpacity: 0.4,
                          stroke: regionColor,
                          strokeWidth: 1,
                          outline: "none",
                          cursor: "pointer"
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

            {/* Marcadores de Serviços/OS */}
            {filteredServices.map((service, idx) => {
                const geoCoords = STATE_GEO_COORDS[service.state_uf];
                if (!geoCoords) return null;

                // Pequeno jitter geográfico p/ não sobrepor pins no mesmo estado
                const jitterLat = (idx % 10) * 0.4 - 2;
                const jitterLong = (idx % 8) * 0.4 - 1.5;

                return (
                  <Marker 
                    key={`pin-${idx}`} 
                    coordinates={[geoCoords[0] + jitterLong, geoCoords[1] + jitterLat]}
                  >
                    <g 
                      className="cursor-pointer group/pin"
                      onMouseEnter={() => setHoveredState(`marker-${idx}`)}
                      onMouseLeave={() => setHoveredState(null)}
                    >
                        {/* Efeito de pulso sob o pin (Compensado pelo Zoom) */}
                        <circle r={4 / currentZoom.zoom} fill="rgba(239, 68, 68, 0.4)">
                            <animate attributeName="r" from={2 / currentZoom.zoom} to={8 / currentZoom.zoom} dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>
                        
                        {/* Ícone de Pin Vermelho (Compensado para tamanho constante e nítido) */}
                        <path 
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                          fill="#ef4444" 
                          transform={`translate(${-12 / currentZoom.zoom}, ${-22 / currentZoom.zoom}) scale(${1 / currentZoom.zoom})`}
                          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        />
                    </g>
                    
                    {/* Label flutuante Proporcional (Compensada e Legível) */}
                    {hoveredState === `marker-${idx}` && (
                        <foreignObject 
                            x={14 / currentZoom.zoom} 
                            y={-42 / currentZoom.zoom} 
                            width={180 / currentZoom.zoom} 
                            height={55 / currentZoom.zoom} 
                            style={{ overflow: 'visible' }}
                        >
                             <div 
                               style={{ 
                                 transform: `scale(${1.2 / currentZoom.zoom})`, 
                                 transformOrigin: 'bottom left',
                                 background: 'rgba(0,0,0,0.98)',
                                 backdropFilter: 'blur(16px)',
                                 padding: '8px 12px',
                                 borderRadius: '12px',
                                 border: '1px solid rgba(255,255,255,0.2)',
                                 borderLeft: '5px solid #ef4444',
                                 boxShadow: '0 15px 50px rgba(0,0,0,0.7)',
                                 pointerEvents: 'none',
                                 width: 'fit-content'
                               }}
                             >
                                <p style={{ fontSize: '13px', fontWeight: '900', color: 'white', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: '1.2' }}>
                                    {service.technician_name}
                                </p>
                                <p style={{ fontSize: '11px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', marginTop: '2px', lineHeight: '1' }}>
                                    {service.city_name}/{service.state_uf}
                                </p>
                             </div>
                        </foreignObject>
                    )}
                  </Marker>
                );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Legend & Regional Quick-Select */}
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

      {/* Connectivity Status */}
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
