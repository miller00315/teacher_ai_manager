
import React, { useState, useMemo, useEffect } from 'react';
import { useAIAgentManager } from '../presentation/hooks/useAIAgentManager';
import { AIAgent } from '../types';
import { Bot, Plus, Trash2, Edit2, MessageSquare, Save, X, Loader2, Send, Database, AlertCircle, RotateCcw, ChevronRight, ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ConfirmationModal from './ConfirmationModal';

interface AIAgentManagerProps {
  hasSupabase: boolean;
}

const AIAgentManager: React.FC<AIAgentManagerProps> = ({ hasSupabase }) => {
  const { 
      agents, loading, error, chatHistory, isChatting, 
      saveAgent, deleteAgent, restoreAgent, sendMessage, clearChat, 
      isAdmin, showDeleted, setShowDeleted 
  } = useAIAgentManager(hasSupabase);
  
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'chat'>('list');
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [formData, setFormData] = useState<Partial<AIAgent>>({ name: '', role: '', system_prompt: '' });
  const [chatInput, setChatInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter and Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      id: string | null;
      action: 'delete' | 'restore';
      name: string;
  }>({ isOpen: false, id: null, action: 'delete', name: '' });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const resetForm = () => {
    setFormData({ name: '', role: '', system_prompt: '' });
  };

  const handleEdit = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setFormData({
        name: agent.name,
        role: agent.role,
        system_prompt: agent.system_prompt
    });
    setView('edit');
  };

  const handleCreate = () => {
    setSelectedAgent(null);
    resetForm();
    setView('create');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const success = await saveAgent(selectedAgent?.id || null, formData);
        if (success) {
            setView('list');
            resetForm();
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleChat = (agent: AIAgent) => {
    setSelectedAgent(agent);
    clearChat();
    setView('chat');
  };

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || !selectedAgent) return;
      sendMessage(selectedAgent, chatInput);
      setChatInput('');
  };

  const openDeleteModal = (agent: AIAgent) => {
      setModalConfig({ isOpen: true, id: agent.id, action: 'delete', name: agent.name });
  };

  const openRestoreModal = (agent: AIAgent) => {
      setModalConfig({ isOpen: true, id: agent.id, action: 'restore', name: agent.name });
  };

  const executeAction = async () => {
      if (!modalConfig.id) return;
      setIsActionLoading(true);
      try {
          if (modalConfig.action === 'delete') {
              await deleteAgent(modalConfig.id);
          } else {
              await restoreAgent(modalConfig.id);
          }
          setModalConfig({ ...modalConfig, isOpen: false });
      } finally {
          setIsActionLoading(false);
      }
  };

  // Filter agents by search term and deleted status
  const filteredAgents = useMemo(() => {
      let filtered = agents;
      
      // Filter by search term
      if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          filtered = filtered.filter(a => 
              a.name.toLowerCase().includes(term) || 
              (a.role && a.role.toLowerCase().includes(term))
          );
      }
      
      // Filter by deleted status based on showDeleted flag
      if (!showDeleted) {
          filtered = filtered.filter(a => !a.deleted);
      }
      
      return filtered;
  }, [agents, searchTerm, showDeleted]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAgents = useMemo(() => {
      return filteredAgents.slice(startIndex, endIndex);
  }, [filteredAgents, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, showDeleted]);

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure database first.</div>;

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
        <ConfirmationModal
            isOpen={modalConfig.isOpen}
            onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
            onConfirm={executeAction}
            title={modalConfig.action === 'delete' ? "Delete Agent" : "Restore Agent"}
            message={
                modalConfig.action === 'delete'
                ? <span>Are you sure you want to delete the agent <strong>{modalConfig.name}</strong>?</span>
                : <span>Restore <strong>{modalConfig.name}</strong>?</span>
            }
            confirmLabel={modalConfig.action === 'delete' ? "Delete" : "Restore"}
            isDestructive={modalConfig.action === 'delete'}
            isLoading={isActionLoading}
        />

        {/* Left Side: Agent List */}
        <div className="w-1/3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Bot size={20} className="text-indigo-600 dark:text-indigo-400"/> AI Agents</h3>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <input 
                                type="checkbox" 
                                checked={showDeleted} 
                                onChange={e => setShowDeleted(e.target.checked)} 
                                title="Show Deleted"
                                className="w-4 h-4 rounded text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                            />
                        )}
                        <button onClick={handleCreate} className="p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"><Plus size={18}/></button>
                    </div>
                </div>
                {/* Search */}
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar agentes..."
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
                {/* Counter */}
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {filteredAgents.length} agente{filteredAgents.length !== 1 ? 's' : ''}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                    <div className="text-center p-8 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/> Loading...</div>
                ) : paginatedAgents.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 dark:text-slate-500 text-sm">
                        {searchTerm ? `Nenhum agente encontrado para "${searchTerm}".` : 'Nenhum agente criado ainda.'}
                    </div>
                ) : paginatedAgents.map(agent => (
                    <div key={agent.id} className={`p-4 rounded-lg border transition-all cursor-pointer group ${selectedAgent?.id === agent.id ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500 dark:ring-indigo-400' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-slate-800'} ${agent.deleted ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                {agent.name}
                                {agent.deleted && <span className="bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Deleted</span>}
                            </h4>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!agent.deleted && <button onClick={(e) => {e.stopPropagation(); handleEdit(agent);}} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded"><Edit2 size={14}/></button>}
                                {isAdmin && agent.deleted ? (
                                    <button onClick={(e) => {e.stopPropagation(); openRestoreModal(agent);}} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><RotateCcw size={14}/></button>
                                ) : !agent.deleted && (
                                    <button onClick={(e) => {e.stopPropagation(); openDeleteModal(agent);}} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"><Trash2 size={14}/></button>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{agent.role || "No role defined"}</p>
                        
                        <div 
                            className="flex items-center gap-1 mb-3 text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 px-2 py-1 rounded w-fit cursor-help"
                            title="Number of text fragments (chunks) stored in the vector database."
                        >
                            <Database size={10}/>
                            {(agent as any).agent_documents?.[0]?.count || 0} Knowledge Chunks
                        </div>

                        {!agent.deleted && (
                            <button onClick={() => handleChat(agent)} className="w-full py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center gap-1"><MessageSquare size={12}/> Test Chat</button>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Itens por página:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={e => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 outline-none text-xs"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Página anterior"
                            >
                                <ChevronLeft size={16}/>
                            </button>
                            
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                Página {currentPage} de {totalPages}
                            </span>
                            
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Próxima página"
                            >
                                <ChevronRight size={16}/>
                            </button>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span>Ir para:</span>
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={currentPage}
                                onChange={e => {
                                    const page = Math.max(1, Math.min(totalPages, Number(e.target.value)));
                                    setCurrentPage(page);
                                }}
                                className="w-12 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 outline-none text-xs"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Right Side: Content Area */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            {view === 'list' && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8">
                    <Bot size={64} className="mb-4 text-slate-200 dark:text-slate-700"/>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">Select or Create an Agent</h3>
                    <p className="max-w-md text-center">Configure your AI assistant with a custom prompt and knowledge base, then test it in real-time.</p>
                </div>
            )}

            {(view === 'create' || view === 'edit') && (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{view === 'create' ? 'Create New Agent' : 'Edit Agent'}</h3>
                        <button onClick={() => setView('list')} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Agent Name</label>
                                <input 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" 
                                    placeholder="e.g. Math Tutor"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Role / Description</label>
                                <input 
                                    value={formData.role} 
                                    onChange={e => setFormData({...formData, role: e.target.value})} 
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500" 
                                    placeholder="e.g. Helps students with calculus"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">System Prompt</label>
                            <textarea 
                                value={formData.system_prompt} 
                                onChange={e => setFormData({...formData, system_prompt: e.target.value})} 
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 h-32 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm placeholder-slate-400 dark:placeholder-slate-500" 
                                placeholder="You are a helpful assistant..."
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Define the personality and constraints of the agent.</p>
                        </div>

                        {/* Knowledge Base Disabled Section */}
                        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6">
                             <div className="flex flex-col items-center justify-center text-center">
                                 <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-3">
                                     <AlertCircle size={24}/>
                                 </div>
                                 <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-1">Knowledge Base Uploads Disabled</h4>
                                 <p className="text-sm text-amber-800 dark:text-amber-300 opacity-80 max-w-sm">
                                     File uploading and vector embedding features are currently unavailable for maintenance. Please check back later.
                                 </p>
                             </div>
                        </div>
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                        <button onClick={() => setView('list')} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
                        <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                            {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Save Agent
                        </button>
                    </div>
                </div>
            )}

            {view === 'chat' && selectedAgent && (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><Bot className="text-indigo-600 dark:text-indigo-400"/> {selectedAgent.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedAgent.role}</p>
                        </div>
                        <button onClick={() => setView('list')} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/50">
                        {chatHistory.length === 0 && (
                            <div className="text-center text-slate-400 dark:text-slate-500 mt-10">
                                <MessageSquare size={48} className="mx-auto mb-2 opacity-50"/>
                                <p>Start a conversation with {selectedAgent.name}</p>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-indigo-600 dark:bg-indigo-500 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-bl-none shadow-sm'}`}>
                                    <div className="text-sm leading-relaxed markdown-content">
                                        <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isChatting && (
                             <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                                    <Loader2 size={16} className="animate-spin text-indigo-500 dark:text-indigo-400"/>
                                    <span>Typing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                        <form onSubmit={handleSendMessage} className="relative">
                            <input 
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                                placeholder="Type a message..."
                                disabled={isChatting}
                            />
                            <button type="submit" disabled={!chatInput.trim() || isChatting} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                <Send size={16}/>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AIAgentManager;
