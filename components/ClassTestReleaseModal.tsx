
import React, { useState, useEffect, useRef } from 'react';
import { useTestReleaseManager } from '../presentation/hooks/useTestReleaseManager';
import { Student, GeoPoint, TestReleaseSite } from '../types';
import { X, Calendar, Clock, CheckCircle, Loader2, AlertTriangle, BookOpen, Map as MapIcon, Globe, MapPin, Eraser, Globe2, Link, XCircle, Bot } from 'lucide-react';

interface ClassTestReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classNameProp?: string; // to avoid conflict with className reserved word
  institutionId: string;
  hasSupabase: boolean;
}

declare global {
  interface Window {
    L: any; // Leaflet global
  }
}

const ClassTestReleaseModal: React.FC<ClassTestReleaseModalProps> = ({ isOpen, onClose, students, classNameProp, hasSupabase, institutionId }) => {
  const { tests, createBulkReleases, isCreating } = useTestReleaseManager(hasSupabase);
  
  // Form State
  const [selectedTestId, setSelectedTestId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [allowConsultation, setAllowConsultation] = useState(false);
  const [allowAiAgent, setAllowAiAgent] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [locationPolygon, setLocationPolygon] = useState<GeoPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Allowed Sites
  const [newSites, setNewSites] = useState<Partial<TestReleaseSite>[]>([]);
  const [siteInput, setSiteInput] = useState({ url: '', title: '' });

  // Map Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polygonRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const pointsRef = useRef<GeoPoint[]>([]); // Ref to track points inside event listeners
  const currentLocationMarkerRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Input Refs for pickers
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  // Initialize selected students when modal opens or students change
  useEffect(() => {
      if (isOpen && students.length > 0) {
          setSelectedStudentIds(students.map(s => s.id));
      }
  }, [isOpen, students]);

  // Map Initialization
  useEffect(() => {
    if (isOpen && mapRef.current && !mapInstance.current && window.L) {
       const map = window.L.map(mapRef.current);
       window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
           attribution: '&copy; OpenStreetMap'
       }).addTo(map);

       map.setView([-15.7801, -47.9292], 13); // Default to Brasília
       
       // Get and show user's current location
       if (navigator.geolocation) {
           navigator.geolocation.getCurrentPosition(
               (pos) => {
                   const { latitude, longitude } = pos.coords;
                   setUserLocation({ lat: latitude, lng: longitude });
                   map.setView([latitude, longitude], 16);
                   
                   // Create pulsing current location marker
                   const pulsingIcon = window.L.divIcon({
                       className: 'current-location-marker',
                       html: `
                           <div style="
                               position: relative;
                               width: 20px;
                               height: 20px;
                           ">
                               <div style="
                                   position: absolute;
                                   width: 20px;
                                   height: 20px;
                                   background: #3b82f6;
                                   border: 3px solid white;
                                   border-radius: 50%;
                                   box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
                               "></div>
                               <div style="
                                   position: absolute;
                                   width: 20px;
                                   height: 20px;
                                   background: rgba(59, 130, 246, 0.3);
                                   border-radius: 50%;
                                   animation: pulse 2s ease-out infinite;
                               "></div>
                           </div>
                       `,
                       iconSize: [20, 20],
                       iconAnchor: [10, 10],
                   });
                   
                   // Remove existing marker if any
                   if (currentLocationMarkerRef.current) {
                       currentLocationMarkerRef.current.remove();
                   }
                   
                   // Add current location marker
                   currentLocationMarkerRef.current = window.L.marker([latitude, longitude], { 
                       icon: pulsingIcon,
                       zIndexOffset: 1000 // Keep it on top
                   })
                   .addTo(map)
                   .bindPopup('<strong>📍 Sua localização atual</strong>')
                   .openPopup();
                   
                   map.invalidateSize();
               },
               (error) => {
                   // Geolocation error - handled silently
               },
               { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
           );
       }

       // Small delay to ensure container size is calculated for tiles
       setTimeout(() => map.invalidateSize(), 200);

       map.on('click', (e: any) => {
           const lat = e.latlng.lat;
           const lng = e.latlng.lng;
           const updatedPoints = [...pointsRef.current, { lat, lng }];
           pointsRef.current = updatedPoints;
           setLocationPolygon(updatedPoints);
           updateMapVisuals(updatedPoints, map);
       });

       mapInstance.current = map;
    }

    // Cleanup map on close
    if (!isOpen && mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current = [];
        polygonRef.current = null;
        polylineRef.current = null;
        pointsRef.current = [];
        currentLocationMarkerRef.current = null;
        setLocationPolygon([]);
        setNewSites([]);
        setUserLocation(null);
    }
  }, [isOpen]);

  const updateMapVisuals = (points: GeoPoint[], map: any) => {
      // Clear existing
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (polygonRef.current) polygonRef.current.remove();
      if (polylineRef.current) polylineRef.current.remove();

      const latLngs = points.map(p => [p.lat, p.lng]);

      // Draw Polygon Fill
      if (points.length > 2) {
          polygonRef.current = window.L.polygon(latLngs, { 
              stroke: false,
              fillColor: '#4f46e5',
              fillOpacity: 0.15
          }).addTo(map);
      }

      // Draw Polyline Outline
      if (points.length > 1) {
          const linePoints = points.length > 2 ? [...latLngs, latLngs[0]] : latLngs;
          polylineRef.current = window.L.polyline(linePoints, { 
              color: '#4f46e5', 
              weight: 3,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: points.length > 2 ? undefined : '6, 6'
          }).addTo(map);
      }

      // Draw Markers
      points.forEach(p => {
          const marker = window.L.circleMarker([p.lat, p.lng], {
              radius: 6, fillColor: '#ffffff', color: '#4f46e5', weight: 2, opacity: 1, fillOpacity: 1
          }).addTo(map);
          markersRef.current.push(marker);
      });
  };

  const clearMap = () => {
      setLocationPolygon([]);
      pointsRef.current = [];
      if (mapInstance.current) {
          markersRef.current.forEach(m => m.remove());
          markersRef.current = [];
          if (polygonRef.current) polygonRef.current.remove();
          if (polylineRef.current) polylineRef.current.remove();
      }
  };

  const toggleStudent = (id: string) => {
      setSelectedStudentIds(prev => 
          prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
  };

  const toggleAll = () => {
      if (selectedStudentIds.length === students.length) {
          setSelectedStudentIds([]);
      } else {
          setSelectedStudentIds(students.map(s => s.id));
      }
  };

  const triggerPicker = (ref: React.RefObject<HTMLInputElement>) => {
      if (ref.current && 'showPicker' in HTMLInputElement.prototype) {
          try {
              (ref.current as any).showPicker();
          } catch (e) {
              ref.current.focus();
          }
      } else if (ref.current) {
          ref.current.focus();
      }
  };

  const handleAddSite = () => {
      if (!siteInput.url) return;
      setNewSites(prev => [...prev, { url: siteInput.url, title: siteInput.title || siteInput.url }]);
      setSiteInput({ url: '', title: '' });
  };

  const handleRemoveSite = (index: number) => {
      setNewSites(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!selectedTestId) {
          setError("Selecione uma prova.");
          return;
      }
      if (selectedStudentIds.length === 0) {
          setError("Selecione pelo menos um aluno.");
          return;
      }

      const selectedTest = tests.find(t => t.id === selectedTestId);
      if (!selectedTest) return;

      const baseRelease = {
          test_id: selectedTest.id,
          professor_id: selectedTest.professor_id,
          institution_id: selectedTest.institution_id || institutionId, // Fallback to class institution
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          max_attempts: maxAttempts,
          allow_consultation: allowConsultation,
          allow_ai_agent: allowAiAgent,
          location_polygon: locationPolygon
      };

      const success = await createBulkReleases(baseRelease, selectedStudentIds, newSites);
      if (success) {
          onClose();
          // Reset form
          setSelectedTestId('');
          setStartTime('');
          setEndTime('');
          setMaxAttempts(1);
          setAllowConsultation(false);
          setAllowAiAgent(false);
          setNewSites([]);
          clearMap();
      }
  };

  if (!isOpen) return null;

  // Current time logic taking Timezone into account
  // datetime-local inputs expect "YYYY-MM-DDTHH:mm" in LOCAL time, not UTC.
  const getLocalISOString = () => {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
  };
  const now = getLocalISOString();
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                  <div>
                      <h3 className="font-bold text-xl text-slate-800">Aplicar Prova à Turma</h3>
                      <p className="text-slate-500 text-sm">{classNameProp} • {students.length} Alunos Disponíveis</p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} className="text-slate-500"/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* LEFT COLUMN: Configuration & Map */}
                  <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-slate-700">1. Configuração da Prova</h4>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">
                              Fuso: {userTimeZone}
                          </span>
                      </div>
                      
                      {error && (
                          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                              <AlertTriangle size={16}/> {error}
                          </div>
                      )}

                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Selecionar Prova</label>
                          <select 
                              value={selectedTestId}
                              onChange={e => setSelectedTestId(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                          >
                              <option value="">-- Escolha uma Prova --</option>
                              {tests.map(t => (
                                  <option key={t.id} value={t.id}>{t.title} ({t.school_grades?.name || 'Não atribuído'})</option>
                              ))}
                          </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-sm font-bold text-slate-700 mb-2">Início</label>
                               <div className="relative group" onClick={() => triggerPicker(startTimeRef)}>
                                   <input 
                                    ref={startTimeRef}
                                    type="datetime-local" 
                                    min={now}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                   />
                                   <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 pointer-events-none transition-colors" />
                               </div>
                           </div>
                           <div>
                               <label className="block text-sm font-bold text-slate-700 mb-2">Fim</label>
                               <div className="relative group" onClick={() => triggerPicker(endTimeRef)}>
                                   <input 
                                    ref={endTimeRef}
                                    type="datetime-local"
                                    min={startTime || now}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                                    value={endTime}
                                    onChange={e => setEndTime(e.target.value)}
                                   />
                                   <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 pointer-events-none transition-colors" />
                               </div>
                           </div>
                      </div>

                      <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-4">
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tentativas</label>
                              <input type="number" min="1" max="10" className="w-20 border border-slate-300 rounded-lg px-3 py-1 text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm" value={maxAttempts} onChange={e => setMaxAttempts(parseInt(e.target.value))} />
                          </div>
                          
                          <div className="flex gap-6 mt-2">
                              <div className="flex items-center gap-2">
                                   <input type="checkbox" id="modalConsult" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer" checked={allowConsultation} onChange={e => setAllowConsultation(e.target.checked)} />
                                   <label htmlFor="modalConsult" className="font-medium text-sm text-slate-700 cursor-pointer select-none">Consulta Liberada</label>
                              </div>
                              <div className="flex items-center gap-2">
                                   <input type="checkbox" id="modalAi" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer" checked={allowAiAgent} onChange={e => setAllowAiAgent(e.target.checked)} />
                                   <label htmlFor="modalAi" className="font-medium text-sm text-slate-700 cursor-pointer select-none flex items-center gap-1"><Bot size={14}/> Permitir IA</label>
                              </div>
                          </div>
                      </div>

                      {allowConsultation && (
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Globe2 size={16}/> Sites Permitidos</h4>
                              <div className="flex gap-2 mb-3">
                                  <input 
                                    placeholder="URL" 
                                    className="flex-1 text-xs border border-slate-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                                    value={siteInput.url}
                                    onChange={e => setSiteInput({...siteInput, url: e.target.value})}
                                  />
                                  <input 
                                    placeholder="Título" 
                                    className="w-1/3 text-xs border border-slate-300 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                                    value={siteInput.title}
                                    onChange={e => setSiteInput({...siteInput, title: e.target.value})}
                                  />
                                  <button type="button" onClick={handleAddSite} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">Adicionar</button>
                              </div>
                              <div className="space-y-1">
                                  {newSites.map((site, i) => (
                                      <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-xs shadow-sm">
                                          <div className="flex items-center gap-2 overflow-hidden">
                                              <Link size={12} className="text-indigo-400 shrink-0"/>
                                              <span className="font-medium truncate">{site.title}</span>
                                              <span className="text-slate-400 text-xs truncate">({site.url})</span>
                                          </div>
                                          <button type="button" onClick={() => handleRemoveSite(i)} className="text-slate-400 hover:text-red-500"><XCircle size={14}/></button>
                                      </div>
                                  ))}
                                  {newSites.length === 0 && <p className="text-xs text-slate-400 italic text-center">Nenhum site adicionado.</p>}
                              </div>
                          </div>
                      )}

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
                          {/* CSS Animation for pulse effect */}
                          <style>{`
                              @keyframes pulse {
                                  0% { transform: scale(1); opacity: 1; }
                                  100% { transform: scale(3); opacity: 0; }
                              }
                          `}</style>
                          <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                              <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2"><MapIcon size={16}/> Cerca Geográfica (Polígono)</h4>
                              <div className="flex items-center gap-3">
                                  {/* User Location Indicator */}
                                  {userLocation ? (
                                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                          GPS Ativo
                                      </span>
                                  ) : (
                                      <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                                          <MapPin size={10}/> Localizando...
                                      </span>
                                  )}
                                  {locationPolygon.length > 0 && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{locationPolygon.length} Pontos</span>}
                                  <button onClick={clearMap} type="button" className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1"><Eraser size={12}/> Limpar</button>
                              </div>
                          </div>
                          <div ref={mapRef} className="h-64 w-full bg-slate-100 relative z-0"></div>
                          {locationPolygon.length === 0 && (
                              <div className="absolute inset-0 top-10 flex flex-col items-center justify-center pointer-events-none bg-slate-50/50">
                                  <Globe size={32} className="text-slate-300 mb-1"/>
                                  <p className="text-xs text-slate-400 font-medium">Clique no mapa para definir a área permitida</p>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* RIGHT COLUMN: Student Selection */}
                  <div className="flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                          <h4 className="font-bold text-slate-700">2. Selecionar Alunos</h4>
                          <button onClick={toggleAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                              {selectedStudentIds.length === students.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                          </button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-1">
                          {students.length === 0 ? (
                              <div className="text-center p-8 text-slate-400 text-sm">Nenhum aluno nesta turma.</div>
                          ) : (
                              students.map(s => (
                                  <div 
                                    key={s.id} 
                                    onClick={() => toggleStudent(s.id)}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selectedStudentIds.includes(s.id) ? 'bg-white dark:bg-slate-800 shadow-sm border border-indigo-200 dark:border-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'}`}
                                  >
                                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                          {selectedStudentIds.includes(s.id) && <CheckCircle size={14}/>}
                                      </div>
                                      <div>
                                          <div className={`text-sm font-medium ${selectedStudentIds.includes(s.id) ? 'text-indigo-900' : 'text-slate-600'}`}>{s.name}</div>
                                          <div className="text-xs text-slate-400 truncate w-32">{s.student_hash}</div>
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                      <div className="mt-2 text-right text-xs font-bold text-slate-500">
                          {selectedStudentIds.length} de {students.length} selecionados
                      </div>
                  </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                  <button onClick={onClose} className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                  <button 
                      onClick={handleSubmit} 
                      disabled={isCreating || selectedStudentIds.length === 0} 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      {isCreating ? <Loader2 className="animate-spin" size={20}/> : <BookOpen size={20}/>}
                      Confirmar Aplicação
                  </button>
              </div>
          </div>
      </div>
  );
};

export default ClassTestReleaseModal;
