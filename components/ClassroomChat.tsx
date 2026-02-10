import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageCircle, Loader2, Trash2, RotateCcw, AlertCircle, CheckCircle, Lock, User, RefreshCw, Paperclip, FileText, Image, X, Download, ThumbsUp, ThumbsDown, Heart, Lightbulb } from 'lucide-react';
import { useClassroomMessages } from '../presentation/hooks/useClassroomMessages';
import { useMessageReactions } from '../presentation/hooks/useMessageReactions';
import { ClassroomRoom, ClassroomMessage, ClassroomMessageType, MessageReactionType, MessageReactionCounts } from '../types';
import { getSupabaseClient } from '../services/supabaseService';

interface ClassroomChatProps {
  room: ClassroomRoom;
  hasSupabase: boolean;
  onClose?: () => void;
}

export const ClassroomChat: React.FC<ClassroomChatProps> = ({ room, hasSupabase, onClose }) => {
  const {
    messages,
    loading,
    sending,
    error,
    showDeleted,
    setShowDeleted,
    canListMessages,
    canSendMessages,
    canManageMessages,
    isAdmin,
    currentAppUserId,
    currentUserName,
    sendMessage,
    deleteMessage,
    restoreMessage,
    refresh
  } = useClassroomMessages(room.id, hasSupabase);

  const [messageText, setMessageText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = getSupabaseClient();

  // Memorizar IDs das mensagens para o hook de reações
  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);

  // Hook para gerenciar reações
  const {
    getReactionCounts,
    hasUserReacted,
    toggleReaction: handleToggleReaction,
  } = useMessageReactions({
    messageIds,
    currentUserId: currentAppUserId,
    hasSupabase
  });

  // Rolar automaticamente para o final quando as mensagens mudarem
  useEffect(() => {
    if (canListMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, canListMessages]);

  const getFileType = (file: File): ClassroomMessageType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  };

  const uploadFile = async (file: File): Promise<{ url: string; path: string } | null> => {
    if (!supabase) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${room.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('class_room_messages')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      throw new Error('Erro ao fazer upload do arquivo.');
    }
    
    const { data } = supabase.storage
      .from('class_room_messages')
      .getPublicUrl(fileName);
    
    return { url: data.publicUrl, path: fileName };
  };

  const handleSend = async () => {
    if ((!messageText.trim() && !selectedFile) || sending || uploading) return;

    setSendError(null);
    setSendSuccess(false);

    try {
      let fileUrl: string | undefined;
      let filePath: string | undefined;
      let messageType: ClassroomMessageType = 'text';
      let metadata: Record<string, any> = {};

      // Fazer upload do arquivo se selecionado
      if (selectedFile) {
        setUploading(true);
        const result = await uploadFile(selectedFile);
        if (result) {
          fileUrl = result.url;
          filePath = result.path;
          messageType = getFileType(selectedFile);
          metadata = {
            file_url: fileUrl,
            file_path: filePath,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            file_type: selectedFile.type
          };
        }
        setUploading(false);
      }

      const content = messageText.trim() || (selectedFile ? selectedFile.name : '');
      await sendMessage(content, messageType, metadata);
      
      setMessageText('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (e: any) {
      setUploading(false);
      setSendError(e.message || 'Erro ao enviar mensagem.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        setSendError('Arquivo muito grande. Máximo: 10MB');
        return;
      }
      setSelectedFile(file);
      setSendError(null);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle size={20} />
          <div>
            <h3 className="font-bold">{room.name}</h3>
            {room.description && (
              <p className="text-xs text-teal-100">{room.description}</p>
            )}
          </div>
          {!room.is_public && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs flex items-center gap-1">
              <Lock size={10} /> Privada
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-3 h-3"
              />
              Excluídas
            </label>
          )}
          {canListMessages && (
            <button
              onClick={refresh}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Atualizar mensagens"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 min-h-[200px] max-h-[400px]">
        {loading || !canListMessages ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
            <MessageCircle size={32} className="mb-2 opacity-50" />
            <p>Nenhuma mensagem ainda.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.user_id === currentAppUserId}
                canManage={canManageMessages}
                canReact={canSendMessages && !msg.deleted}
                onDelete={() => deleteMessage(msg.id)}
                onRestore={() => restoreMessage(msg.id)}
                onToggleReaction={(type) => handleToggleReaction(msg.id, type)}
                reactionCounts={getReactionCounts(msg.id)}
                hasUserReacted={hasUserReacted}
                formatTime={formatTime}
                formatFileSize={formatFileSize}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Área de Entrada */}
      {canSendMessages && (
        <div className="border-t border-slate-200 p-3 bg-white">
          {/* Mensagens de Erro/Sucesso */}
          {sendError && (
            <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              {sendError}
            </div>
          )}
          {sendSuccess && (
            <div className="mb-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-xs flex items-center gap-2">
              <CheckCircle size={14} />
              Mensagem enviada com sucesso!
            </div>
          )}

          {/* Prévia do arquivo selecionado */}
          {selectedFile && (
            <div className="mb-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {selectedFile.type.startsWith('image/') ? (
                  <Image size={16} className="text-blue-500" />
                ) : (
                  <FileText size={16} className="text-slate-500" />
                )}
                <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-xs text-slate-400">({formatFileSize(selectedFile.size)})</span>
              </div>
              <button
                onClick={removeSelectedFile}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
                title="Remover arquivo"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          <div className="flex items-end gap-2">
            {/* Input de arquivo (oculto) */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            />
            
            {/* Botão de anexar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              className="p-2 text-slate-500 hover:text-teal-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Anexar arquivo"
            >
              <Paperclip size={20} />
            </button>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-400"
              rows={2}
              disabled={sending || uploading}
            />
            <button
              onClick={handleSend}
              disabled={(!messageText.trim() && !selectedFile) || sending || uploading}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              {sending || uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enviando como: <span className="font-medium text-slate-600">{currentUserName || 'Usuário'}</span>
            <span className="ml-2 text-slate-300">• Máx: 10MB</span>
          </p>
        </div>
      )}

      {/* Mensagem sem permissão */}
      {!canSendMessages && (
        <div className="border-t border-slate-200 p-4 bg-slate-100 text-center text-slate-500 text-sm">
          Você não tem permissão para enviar mensagens nesta sala.
        </div>
      )}
    </div>
  );
};

// Componente de Botão de Reação
interface ReactionButtonProps {
  type: MessageReactionType;
  count: number;
  isActive: boolean;
  onClick: () => void;
  isOwn: boolean;
  disabled?: boolean;
}

const ReactionButton: React.FC<ReactionButtonProps> = ({ type, count, isActive, onClick, isOwn, disabled }) => {
  const icons = {
    like: ThumbsUp,
    dislike: ThumbsDown,
    love: Heart,
    understood: Lightbulb
  };

  const labels = {
    like: 'Gostei',
    dislike: 'Não gostei',
    love: 'Amei',
    understood: 'Entendi'
  };

  const Icon = icons[type];

  const activeColors = {
    like: 'text-blue-500',
    dislike: 'text-red-500',
    love: 'text-pink-500',
    understood: 'text-yellow-500'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={labels[type]}
      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? `${activeColors[type]} ${isOwn ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'} font-medium`
          : isOwn
            ? 'text-teal-100 hover:bg-white/10'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      <Icon size={12} className={isActive ? 'fill-current' : ''} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
};

// Componente de Bolha de Mensagem
interface MessageBubbleProps {
  message: ClassroomMessage;
  isOwn: boolean;
  canManage: boolean;
  canReact: boolean;
  onDelete: () => void;
  onRestore: () => void;
  onToggleReaction: (type: MessageReactionType) => void;
  reactionCounts: MessageReactionCounts;
  hasUserReacted: (messageId: string, type: MessageReactionType) => boolean;
  formatTime: (date?: string) => string;
  formatFileSize: (bytes: number) => string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  canManage,
  canReact,
  onDelete,
  onRestore,
  onToggleReaction,
  reactionCounts,
  hasUserReacted,
  formatTime,
  formatFileSize
}) => {
  const [reacting, setReacting] = useState(false);

  const handleReaction = async (type: MessageReactionType) => {
    if (reacting) return;
    setReacting(true);
    try {
      await onToggleReaction(type);
    } catch (err) {
      console.error('Erro ao alternar reação:', err);
    } finally {
      setReacting(false);
    }
  };

  const totalReactions = reactionCounts.like + reactionCounts.dislike + reactionCounts.love + reactionCounts.understood;
  const userName = message.nickname || 
    (message.app_users ? `${message.app_users.first_name} ${message.app_users.last_name}`.trim() : 'Usuário');

  const hasFile = message.metadata?.file_url;
  const isImage = message.type === 'image';
  const isVideo = message.type === 'video';
  const isAudio = message.type === 'audio';

  const renderAttachment = () => {
    if (!hasFile) return null;

    const { file_url, file_name, file_size } = message.metadata || {};

    if (isImage) {
      return (
        <a href={file_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img 
            src={file_url} 
            alt={file_name || 'Imagem'} 
            className="max-w-full max-h-48 rounded-lg object-cover border border-slate-200"
          />
        </a>
      );
    }

    if (isVideo) {
      return (
        <video 
          src={file_url} 
          controls 
          className="max-w-full max-h-48 rounded-lg mt-2"
        />
      );
    }

    if (isAudio) {
      return (
        <audio 
          src={file_url} 
          controls 
          className="w-full mt-2"
        />
      );
    }

    // Anexo de arquivo
    return (
      <a 
        href={file_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          isOwn 
            ? 'bg-teal-400/30 border-teal-400/50 hover:bg-teal-400/40' 
            : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
        }`}
      >
        <FileText size={16} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${isOwn ? 'text-white' : 'text-slate-700'}`}>
            {file_name || 'Arquivo'}
          </p>
          {file_size && (
            <p className={`text-xs ${isOwn ? 'text-teal-100' : 'text-slate-400'}`}>
              {formatFileSize(file_size)}
            </p>
          )}
        </div>
        <Download size={14} />
      </a>
    );
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[80%] rounded-lg p-3 ${
          message.deleted 
            ? 'bg-red-100 border border-red-200 opacity-60'
            : isOwn 
              ? 'bg-teal-500 text-white' 
              : 'bg-white border border-slate-200'
        }`}
      >
        {/* Nome do autor (para mensagens de outros) */}
        {!isOwn && (
          <div className="flex items-center gap-1 mb-1">
            <User size={12} className={message.deleted ? 'text-red-500' : 'text-teal-500'} />
            <span className={`text-xs font-medium ${message.deleted ? 'text-red-600' : 'text-teal-600'}`}>
              {userName}
            </span>
          </div>
        )}

        {/* Conteúdo da mensagem */}
        {message.deleted ? (
          <p className="text-sm text-red-600 italic">[Mensagem excluída]</p>
        ) : (
          <>
            {message.content && !hasFile && (
              <p className={`text-sm whitespace-pre-wrap break-words ${
                isOwn ? 'text-white' : 'text-slate-700'
              }`}>
                {message.content}
              </p>
            )}
            {message.content && hasFile && message.content !== message.metadata?.file_name && (
              <p className={`text-sm whitespace-pre-wrap break-words ${
                isOwn ? 'text-white' : 'text-slate-700'
              }`}>
                {message.content}
              </p>
            )}
            {renderAttachment()}
          </>
        )}

        {/* Barra de Reações */}
        {!message.deleted && (canReact || totalReactions > 0) && (
          <div className={`flex items-center gap-1 mt-2 pt-2 border-t ${
            isOwn ? 'border-teal-400/30' : 'border-slate-200'
          }`}>
            <ReactionButton
              type="like"
              count={reactionCounts.like}
              isActive={hasUserReacted(message.id, 'like')}
              onClick={() => handleReaction('like')}
              isOwn={isOwn}
              disabled={!canReact || reacting}
            />
            <ReactionButton
              type="dislike"
              count={reactionCounts.dislike}
              isActive={hasUserReacted(message.id, 'dislike')}
              onClick={() => handleReaction('dislike')}
              isOwn={isOwn}
              disabled={!canReact || reacting}
            />
            <ReactionButton
              type="love"
              count={reactionCounts.love}
              isActive={hasUserReacted(message.id, 'love')}
              onClick={() => handleReaction('love')}
              isOwn={isOwn}
              disabled={!canReact || reacting}
            />
            <ReactionButton
              type="understood"
              count={reactionCounts.understood}
              isActive={hasUserReacted(message.id, 'understood')}
              onClick={() => handleReaction('understood')}
              isOwn={isOwn}
              disabled={!canReact || reacting}
            />
          </div>
        )}

        {/* Rodapé com hora e ações */}
        <div className={`flex items-center justify-between mt-1 text-xs ${
          message.deleted 
            ? 'text-red-400' 
            : isOwn 
              ? 'text-teal-100' 
              : 'text-slate-400'
        }`}>
          <span>
            {formatTime(message.created_at)}
            {message.edited && !message.deleted && ' (editada)'}
          </span>
          
          {canManage && (
            <div className="flex items-center gap-1 ml-2">
              {message.deleted ? (
                <button
                  onClick={onRestore}
                  className="p-1 hover:bg-emerald-200 rounded transition-colors text-emerald-600"
                  title="Restaurar"
                >
                  <RotateCcw size={12} />
                </button>
              ) : (
                <button
                  onClick={onDelete}
                  className={`p-1 rounded transition-colors ${
                    isOwn 
                      ? 'hover:bg-teal-400 text-teal-100' 
                      : 'hover:bg-red-100 text-red-400'
                  }`}
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassroomChat;
