
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, Bot, Loader2, Sparkles, ShoppingCart, MapPin, Building2, ExternalLink, Globe, FileText, CheckCircle, PackageCheck, FileSpreadsheet, RotateCcw, Trash2, ChevronRight, Check, AlertCircle, Camera, Image as ImageIcon } from 'lucide-react';
import { MaterialItem, SlipItem } from '../types';
import * as gemini from '../services/geminiService';
import * as XLSX from 'xlsx';

interface Source {
  uri: string;
  title: string;
}

interface PendingAction {
  type: string;
  payload: any;
  executed: boolean;
}

interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface Message {
  role: 'user' | 'model';
  parts: MessagePart[];
  sources?: Source[];
  pendingActions?: PendingAction[];
  options?: string[];
  imagePreview?: string; // 表示用URL
}

interface AITakahashiProps {
  masterItems: MaterialItem[];
  onAddToCart: (items: any[]) => void;
  onUpdateInfo: (info: { customerName?: string; siteName?: string; destination?: string }) => void;
  onCreateEstimate: (items: any[]) => void;
  onRegisterItems: (items: any[]) => void;
  helpMessage?: string;
  welcomeMessage?: string;
  currentScreen?: 'TOP' | 'SLIP_CREATE' | 'ESTIMATE_MANAGER' | 'MASTER_MANAGEMENT' | 'QUICK_SEARCH' | 'PO_MANAGER' | 'SETTINGS';
}

export const AITakahashi: React.FC<AITakahashiProps> = ({ masterItems, onAddToCart, onUpdateInfo, onCreateEstimate, onRegisterItems, helpMessage, welcomeMessage, currentScreen = 'TOP' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File, base64?: string; text?: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const defaultMessage: Message = {
    role: 'model',
    parts: [{ text: "あ、高橋です。お疲れ様です。なんのせ何でも調べて答えますので聞いてみてください。" }]
  };

  const [messages, setMessages] = useState<Message[]>([defaultMessage]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (welcomeMessage && messages.length === 1 && messages[0].role === 'model') {
      setMessages([{ role: 'model', parts: [{ text: welcomeMessage }] }]);
    } else if (!welcomeMessage && messages.length === 1 && messages[0].role === 'model' && messages[0].parts[0].text !== defaultMessage.parts[0].text) {
      setMessages([defaultMessage]);
    }
  }, [welcomeMessage]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const resetChat = () => {
    if (window.confirm('対話履歴をリセットして、最初からやり直しますか？')) {
      setMessages([defaultMessage]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedFile({ file, base64 });
      };
      reader.readAsDataURL(file);
    } else {
      // Excel/CSV/Text handling
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          let fullText = "";
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            fullText += `--- シート: ${sheetName} ---\n${csv}\n\n`;
          });
          setSelectedFile({ file, text: fullText });
        } catch (err) {
          // fallback to text
          const textReader = new FileReader();
          textReader.onload = (re) => {
            setSelectedFile({ file, text: re.target?.result as string });
          };
          textReader.readAsText(file);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const tryRepairJSON = (str: string): any => {
    let cleaned = str.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const stack = [];
      for (const char of cleaned) {
        if (char === '{' || char === '[') stack.push(char);
        else if (char === '}') { if (stack[stack.length - 1] === '{') stack.pop(); }
        else if (char === ']') { if (stack[stack.length - 1] === '[') stack.pop(); }
      }
      let repaired = cleaned;
      while (stack.length > 0) {
        const last = stack.pop();
        if (last === '{') repaired += '}';
        if (last === '[') repaired += ']';
      }
      return JSON.parse(repaired);
    }
  };

  const handleExecuteAction = (msgIdx: number, actionIdx: number) => {
    const newMessages = [...messages];
    const msg = newMessages[msgIdx];
    if (!msg.pendingActions) return;

    const action = msg.pendingActions[actionIdx];
    if (action.executed) return;

    if (action.type === 'ADD_CART') {
      onAddToCart(Array.isArray(action.payload) ? action.payload : [action.payload]);
    } else if (action.type === 'UPDATE_INFO') {
      onUpdateInfo(action.payload);
    } else if (action.type === 'CREATE_ESTIMATE') {
      onCreateEstimate(Array.isArray(action.payload) ? action.payload : [action.payload]);
    } else if (action.type === 'REGISTER_ITEMS') {
      onRegisterItems(Array.isArray(action.payload) ? action.payload : [action.payload]);
    }

    action.executed = true;
    setMessages(newMessages);
  };

  const handleSend = async (textOverride?: string) => {
    const finalInput = textOverride || input;
    if (!finalInput.trim() && !selectedFile && !isLoading) return;

    const userParts: MessagePart[] = [];
    
    if (selectedFile?.text) {
      const fileContext = `【アップロードファイル内容: ${selectedFile.file.name}】\n${selectedFile.text}\n\n`;
      userParts.push({ text: finalInput.trim() ? `${fileContext}質問: ${finalInput}` : `${fileContext}このファイルの内容を確認して、概要を教えてください。` });
    } else {
      if (finalInput.trim()) userParts.push({ text: finalInput });
    }

    if (selectedFile?.base64) {
      userParts.push({
        inlineData: {
          mimeType: selectedFile.file.type || 'image/jpeg',
          data: selectedFile.base64
        }
      });
    }

    const userMsg: Message = {
      role: 'user',
      parts: userParts,
      imagePreview: selectedFile?.base64 
        ? `data:${selectedFile.file.type};base64,${selectedFile.base64}` 
        : selectedFile?.text 
          ? 'FILE_TEXT_PREVIEW' 
          : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const chatHistory = messages.map(m => ({
        role: m.role,
        parts: m.parts.map(p => {
          if (p.text) return { text: p.text };
          if (p.inlineData) return { inlineData: p.inlineData };
          return { text: "" };
        })
      }));
      chatHistory.push({
        role: userMsg.role,
        parts: userMsg.parts
      });

      const response = await gemini.chatWithTakahashi(chatHistory, masterItems, currentScreen);
      let fullText = response.text || "";

      const sources: Source[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web && chunk.web.uri) {
            sources.push({ uri: chunk.web.uri, title: chunk.web.title || "参考サイト" });
          }
        });
      }

      let options: string[] = [];
      const optionsMatch = fullText.match(/\[\[OPTIONS:([\s\S]+?)\]\]/);
      if (optionsMatch) {
        try { options = JSON.parse(optionsMatch[1]); } catch (e) { }
      }

      const actionRegex = /\[\[ACTION:(\w+):([\s\S]+?)\]\]/g;
      let match;
      const pendingActions: PendingAction[] = [];

      while ((match = actionRegex.exec(fullText)) !== null) {
        const type = match[1];
        try {
          const payload = tryRepairJSON(match[2]);
          pendingActions.push({ type, payload, executed: false });
        } catch (e) {
          console.error("Action parse error:", e);
        }
      }

      const displayableText = fullText.replace(/\[\[ACTION:[\s\S]+?\]\]/g, '').replace(/\[\[OPTIONS:[\s\S]+?\]\]/g, '').trim();

      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: displayableText || "あ、高橋です。なんのせ、僕にお任せください。" }],
        sources: sources.length > 0 ? sources : undefined,
        pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
        options: options.length > 0 ? options : undefined
      }]);

    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "あ、高橋です。なんのせ少し考えがまとまらなかった。もう一度教えてもらえるかい？" }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[200] flex flex-col items-end max-w-full">
      {!isOpen && helpMessage && isHovered && (
        <div onClick={() => setIsOpen(true)} className="mb-4 bg-white px-4 py-3 rounded-2xl rounded-br-none shadow-xl border border-blue-100 flex items-center gap-3 cursor-pointer hover:scale-105 transition-all duration-300 origin-bottom-right animate-in fade-in slide-in-from-bottom-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles size={16} />
          </div>
          <p className="text-xs font-black text-slate-700 whitespace-nowrap">{helpMessage}</p>
        </div>
      )}
      {isOpen && (
        <div className="bg-white w-[calc(100vw-2rem)] sm:w-[440px] h-[70vh] sm:h-[720px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col mb-4 overflow-hidden animate-fade-in ring-4 ring-blue-600/10">
          <div className="bg-slate-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
                <Sparkles size={16} className="text-white relative z-10" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm tracking-tight">AI高橋さん</h3>
                <p className="text-[8px] sm:text-[9px] text-blue-400 font-bold uppercase tracking-widest">HVAC & Tools Pro</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetChat} title="履歴をリセット" className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"><RotateCcw size={14} /></button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
            {messages.map((m, msgIdx) => (
              <div key={msgIdx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[95%] sm:max-w-[90%] p-3 sm:p-4 rounded-2xl sm:rounded-3xl text-[11px] sm:text-xs font-bold leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                  {m.imagePreview && (
                    <div className="mb-3 rounded-xl overflow-hidden border-2 border-white/20 shadow-inner">
                      {m.imagePreview === 'FILE_TEXT_PREVIEW' ? (
                        <div className="w-full h-32 bg-slate-800 flex flex-col items-center justify-center gap-2">
                          <FileSpreadsheet size={40} className="text-emerald-400/50" />
                          <span className="text-[10px] text-emerald-400/50 font-black">EXCEL / CSV DOCUMENT</span>
                        </div>
                      ) : m.imagePreview.startsWith('data:application/pdf') ? (
                        <div className="w-full h-32 bg-slate-800 flex flex-col items-center justify-center gap-2">
                          <FileText size={40} className="text-white/50" />
                          <span className="text-[10px] text-white/50 font-black">PDF DOCUMENT</span>
                        </div>
                      ) : (
                        <img src={m.imagePreview} alt="User Upload" className="w-full h-auto object-cover max-h-40 sm:max-h-48" />
                      )}
                    </div>
                  )}
                  {m.parts.map((part, pIdx) => (
                    <div key={pIdx}>
                      {part.text && part.text.split('\n').map((line, idx) => <p key={idx} className="mb-1">{line}</p>)}
                    </div>
                  ))}

                  {m.pendingActions && m.pendingActions.map((action, actionIdx) => (
                    <div key={actionIdx} className={`mt-4 overflow-hidden rounded-xl sm:rounded-2xl border-2 transition-all ${action.executed ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-blue-100 bg-white shadow-md'}`}>
                      <div className={`px-3 py-2 text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${action.executed ? 'bg-emerald-100' : 'bg-blue-50 text-blue-600'}`}>
                        {action.executed ? <CheckCircle size={10} /> : <ShoppingCart size={10} />}
                        {action.type === 'ADD_CART' ? 'カート追加' : action.type === 'CREATE_ESTIMATE' ? '見積作成' : action.type === 'REGISTER_ITEMS' ? 'マスター登録' : '情報の更新'}
                      </div>
                      <div className="p-2 sm:p-3">
                        {action.type === 'ADD_CART' || action.type === 'CREATE_ESTIMATE' ? (
                          <div className="space-y-1 mb-2 sm:mb-3">
                            {(Array.isArray(action.payload) ? action.payload : [action.payload]).map((item: any, i: number) => {
                              const isNew = item.id === '新規' || !item.id || item.id.startsWith('ai-');
                              return (
                                <div key={i} className="flex flex-col gap-0.5 bg-slate-50/50 p-1.5 rounded mb-1 last:mb-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold leading-tight flex-1">
                                      ・{item.name} {item.dimensions && <span className="opacity-60">[{item.dimensions}]</span>}
                                    </span>
                                    <span className="text-[9px] sm:text-[10px] font-mono font-black whitespace-nowrap text-slate-500">
                                      {item.quantity} {item.unit || '個'}
                                    </span>
                                  </div>
                                  {isNew && (
                                    <div className="flex items-center gap-1">
                                      <span className="px-1 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black rounded uppercase tracking-tighter">マスター未登録 (新規)</span>
                                      <span className="text-[8px] text-amber-500 font-bold">※同名資材があればマスター修正が必要です</span>
                                    </div>
                                  )}
                                  {!isNew && (
                                    <div className="flex items-center gap-1">
                                      <span className="px-1 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black rounded uppercase tracking-tighter">マスター紐付け済み</span>
                                      <span className="text-[8px] text-blue-400 font-bold opacity-60">ID: {item.id}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : action.type === 'REGISTER_ITEMS' ? (
                          <div className="space-y-1 mb-2 sm:mb-3">
                            {(Array.isArray(action.payload) ? action.payload : [action.payload]).map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-[9px] sm:text-[10px] font-mono bg-slate-50/50 p-1 rounded">
                                <span className="truncate flex-1">・{item.name} ({item.dimensions})</span>
                              </div>
                            ))}
                          </div>
                        ) : action.type === 'UPDATE_INFO' ? (
                          <div className="text-[9px] sm:text-[10px] space-y-1 mb-2 sm:mb-3">
                            {action.payload.customerName && <p>顧客: <span className="font-black">{action.payload.customerName}</span></p>}
                            {action.payload.siteName && <p>現場: <span className="font-black">{action.payload.siteName}</span></p>}
                          </div>
                        ) : null}

                        {action.executed ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-black text-[9px] sm:text-[10px]">
                            <Check size={12} /> 完了しました
                          </div>
                        ) : (
                          <button
                            onClick={() => handleExecuteAction(msgIdx, actionIdx)}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                          >
                            <PackageCheck size={12} /> 反映する
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {m.options && (
                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                      {m.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(opt)}
                          className="w-full text-left px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] sm:text-[11px] font-black hover:bg-blue-100 transition-all flex items-center justify-between group"
                        >
                          <span className="truncate">{opt}</span>
                          <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}

                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[8px] sm:text-[9px] uppercase tracking-widest text-slate-400 font-black flex items-center gap-1"><Globe size={10} /> リサーチ結果</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((s, idx) => (
                          <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 text-blue-600 rounded-md text-[9px] hover:bg-blue-50 transition-colors border border-blue-100 max-w-full">
                            <span className="truncate">{s.title}</span>
                            <ExternalLink size={8} className="shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">鑑定中だべ...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 border-t bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] space-y-3">
            {selectedFile && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-blue-100 shadow-md">
                {selectedFile.text ? (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <FileSpreadsheet size={24} className="text-emerald-400/50" />
                  </div>
                ) : selectedFile.file.type === 'application/pdf' ? (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <FileText size={24} className="text-white/50" />
                  </div>
                ) : (
                  <img src={`data:${selectedFile.file.type};base64,${selectedFile.base64}`} className="w-full h-full object-cover" />
                )}
                <button onClick={() => setSelectedFile(null)} className="absolute top-0 right-0 bg-rose-500 text-white p-1 rounded-bl-md shadow-md">
                  <X size={10} />
                </button>
              </div>
            )}
            <div className="relative flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"
                title="ファイルを追加"
              >
                <Camera size={18} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.xlsx,.xls,.csv" />

              <div className="relative flex-1">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="係長に聞く..."
                  className="w-full pl-4 pr-10 py-3 bg-slate-100 border-none rounded-xl text-xs font-black placeholder:text-slate-400 outline-none"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-md"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[2rem] flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95 ${isOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white ring-4 ring-blue-100'}`}
      >
        {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
      </button>
    </div>
  );
};
