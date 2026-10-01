import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  BookOpen,
  Calculator,
  Camera,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Paperclip,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import CalculatorPanel from './CalculatorPanel';
import CameraCapture from './CameraCapture';
import GraphingTool from './GraphingTool';
import HandwritingCanvas from './HandwritingCanvas';
import LessonLibrary from './LessonLibrary';
import { formatAIReply } from '../lib/formatAIReply';
import { mathdeskAI } from '../services/mathdeskAI';
import { loadChatHistory, onAuthChange, saveChatHistory, type ChatMessageRecord } from '../services/supabase';
import type { MathDeskImage, MathDeskMode } from '../types/ai';

interface PendingImage extends MathDeskImage {
  preview: string;
}

interface ConversationTab {
  id: string;
  title: string;
  mode: MathDeskMode;
  messages: ChatMessageRecord[];
  draft: string;
  pendingImages: PendingImage[];
  notice: string;
}

interface ChatWorkspaceProps {
  initialMode?: MathDeskMode;
  initialPrompt?: string;
}

const PRIMARY_TAB_ID = 'main';
const modes: Array<{ id: MathDeskMode; label: string; hint: string }> = [
  { id: 'solve', label: 'Solve a Problem', hint: 'Work step by step' },
  { id: 'learn', label: 'Learn a Concept', hint: 'Understand the idea' },
  { id: 'practice', label: 'Practice Problems', hint: 'Build confidence' },
];
const placeholders: Record<MathDeskMode, string> = {
  solve: 'Type a problem or paste a lesson...',
  learn: 'Describe the concept you want to understand...',
  practice: 'Enter a topic for practice problems...',
  deskbot: 'Ask Desky how MathDesk works…',
};

function draftStorageKey(id: string) {
  return id === PRIMARY_TAB_ID ? 'mathdesk:draft:main' : `mathdesk:draft:${id}`;
}

function createConversationTab(mode: MathDeskMode, id?: string, initialPrompt = ''): ConversationTab {
  const tabId = id ?? `chat-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  let draft = initialPrompt;
  try {
    draft = localStorage.getItem(draftStorageKey(tabId)) ?? initialPrompt;
  } catch {
    // Browser storage may be unavailable in private contexts.
  }
  return {
    id: tabId,
    title: 'New conversation',
    mode,
    messages: [],
    draft,
    pendingImages: [],
    notice: '',
  };
}

function titleForMessage(message: string) {
  const title = message.trim().replace(/\s+/g, ' ');
  return title.slice(0, 40) || 'Image problem';
}

export default function ChatWorkspace({ initialMode = 'solve', initialPrompt = '' }: ChatWorkspaceProps) {
  const [tabs, setTabs] = useState<ConversationTab[]>(() => [
    createConversationTab(initialMode, PRIMARY_TAB_ID, initialPrompt),
  ]);
  const [activeTabId, setActiveTabId] = useState(PRIMARY_TAB_ID);
  const [busyTabIds, setBusyTabIds] = useState<Set<string>>(() => new Set());
  const [tool, setTool] = useState<'calculator' | 'graph' | 'handwriting' | 'camera' | 'lessons' | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestsRef = useRef(new Map<string, AbortController>());
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  useEffect(() => {
    let mounted = true;
    const applySavedHistory = (saved: ChatMessageRecord[]) => {
      if (!mounted || saved.length === 0) return;
      const firstUserMessage = saved.find((message) => message.role === 'user')?.content ?? '';
      setTabs((current) => current.map((tab) => tab.id === PRIMARY_TAB_ID
        ? { ...tab, messages: saved, title: firstUserMessage ? titleForMessage(firstUserMessage) : 'Recent conversation' }
        : tab));
    };

    loadChatHistory().then(applySavedHistory).catch(() => {
      if (mounted) setTabs((current) => current.map((tab) => tab.id === PRIMARY_TAB_ID
        ? { ...tab, notice: 'Saved history could not be loaded. Local chat still works.' }
        : tab));
    });
    const auth = onAuthChange((_event, session) => {
      if (!session) return;
      loadChatHistory().then(applySavedHistory).catch(() => {
        if (mounted) setTabs((current) => current.map((tab) => tab.id === PRIMARY_TAB_ID
          ? { ...tab, notice: 'Cloud history is unavailable.' }
          : tab));
      });
    });
    return () => {
      mounted = false;
      auth.data.subscription.unsubscribe();
      requestsRef.current.forEach((controller) => controller.abort());
      requestsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const setOnlineStatus = () => setOnline(true);
    const setOfflineStatus = () => setOnline(false);
    window.addEventListener('online', setOnlineStatus);
    window.addEventListener('offline', setOfflineStatus);
    return () => {
      window.removeEventListener('online', setOnlineStatus);
      window.removeEventListener('offline', setOfflineStatus);
    };
  }, []);

  function updateTab(tabId: string, update: (tab: ConversationTab) => ConversationTab) {
    setTabs((current) => current.map((tab) => tab.id === tabId ? update(tab) : tab));
  }

  function updateDraft(tabId: string, value: string) {
    updateTab(tabId, (tab) => ({ ...tab, draft: value }));
    try {
      if (value) localStorage.setItem(draftStorageKey(tabId), value);
      else localStorage.removeItem(draftStorageKey(tabId));
    } catch {
      // Keep the composer usable if browser storage is unavailable.
    }
  }

  function markBusy(tabId: string, busy: boolean) {
    setBusyTabIds((current) => {
      const next = new Set(current);
      if (busy) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }

  function addFiles(files: FileList | File[], tabId = activeTabId) {
    Array.from(files).filter((file) => file.type.startsWith('image/')).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const [, data] = dataUrl.split(',');
        updateTab(tabId, (tab) => ({
          ...tab,
          pendingImages: [...tab.pendingImages, { mimeType: file.type, data, preview: dataUrl }],
        }));
      };
      reader.readAsDataURL(file);
    });
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))?.getAsFile();
    if (!image) return;
    event.preventDefault();
    addFiles([image], activeTabId);
  }

  function switchTab(tabId: string) {
    if (!tabs.some((tab) => tab.id === tabId)) return;
    setActiveTabId(tabId);
    setToolbarOpen(false);
  }

  function newConversation() {
    const tab = createConversationTab(activeTab?.mode ?? initialMode);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setToolbarOpen(false);
  }

  function closeTab(tabId: string, event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    const index = tabs.findIndex((tab) => tab.id === tabId);
    if (index < 0) return;

    requestsRef.current.get(tabId)?.abort();
    requestsRef.current.delete(tabId);
    markBusy(tabId, false);
    try {
      localStorage.removeItem(draftStorageKey(tabId));
    } catch {
      // Closing a tab should still work if storage is unavailable.
    }

    if (tabs.length === 1) {
      const replacement = createConversationTab(activeTab?.mode ?? initialMode);
      setTabs([replacement]);
      setActiveTabId(replacement.id);
      return;
    }

    const remaining = tabs.filter((tab) => tab.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      const nextIndex = Math.min(index, remaining.length - 1);
      setActiveTabId(remaining[nextIndex].id);
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    switchTab(nextTab.id);
    window.requestAnimationFrame(() => document.getElementById(`chat-tab-${nextTab.id}`)?.focus());
  }

  function chooseTool(next: typeof tool) {
    setTool(next);
    setToolbarOpen(false);
  }

  function chooseRecentChat(prompt: string) {
    updateDraft(activeTab.id, prompt);
    textareaRef.current?.focus();
  }

  function useImage(image: PendingImage) {
    updateTab(activeTab.id, (tab) => ({
      ...tab,
      pendingImages: [...tab.pendingImages, image],
      draft: tab.draft || 'Solve this problem from the image.',
    }));
  }

  async function send() {
    const current = tabs.find((tab) => tab.id === activeTabId);
    if (!current || busyTabIds.has(current.id)) return;
    const text = current.draft.trim();
    if (!text && current.pendingImages.length === 0) return;
    if (!online) {
      updateTab(current.id, (tab) => ({
        ...tab,
        notice: 'You are offline. Your draft is saved; reconnect to request a new AI response.',
      }));
      return;
    }

    const userMessage: ChatMessageRecord = {
      role: 'user',
      content: text || 'Solve this problem from the uploaded image.',
      imagePreviews: current.pendingImages.map((image) => image.preview),
    };
    const nextMessages = [...current.messages, userMessage];
    const nextTitle = current.messages.some((message) => message.role === 'user')
      ? current.title
      : titleForMessage(text || userMessage.content);
    const images = current.pendingImages.map(({ preview: _preview, ...image }) => image);

    updateTab(current.id, (tab) => ({
      ...tab,
      messages: nextMessages,
      title: nextTitle,
      draft: '',
      pendingImages: [],
      notice: '',
    }));
    try {
      localStorage.removeItem(draftStorageKey(current.id));
    } catch {
      // The message is already in the active tab state.
    }

    const controller = new AbortController();
    requestsRef.current.set(current.id, controller);
    markBusy(current.id, true);
    try {
      const reply = await mathdeskAI.request(
        {
          message: userMessage.content,
          mode: current.mode,
          ...(images.length ? { hasImages: true, images } : {}),
        },
        { signal: controller.signal },
      );
      const updatedMessages: ChatMessageRecord[] = [
        ...nextMessages,
        { role: 'ai', content: reply },
      ];
      updateTab(current.id, (tab) => ({ ...tab, messages: updatedMessages }));
      // The existing Supabase API stores one active conversation per user. Extra open tabs stay session-local.
      await saveChatHistory(updatedMessages);
    } catch (error) {
      if (!controller.signal.aborted) {
        updateTab(current.id, (tab) => ({
          ...tab,
          notice: error instanceof Error ? error.message : 'Could not reach MathDesk AI.',
        }));
      }
    } finally {
      if (requestsRef.current.get(current.id) === controller) requestsRef.current.delete(current.id);
      markBusy(current.id, false);
    }
  }

  if (!activeTab) return null;
  const currentModeLabel = modes.find((item) => item.id === activeTab.mode)?.label || 'Math Assistant';
  const currentBusy = busyTabIds.has(activeTab.id);

  return (
    <section
      className={`legacy-chat-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      aria-label="MathDesk AI chatbox"
    >
      <aside className="legacy-chat-sidebar">
        <div className="legacy-sidebar-header">
          <div className="legacy-sidebar-heading">
            <span className="legacy-ai-mark" aria-hidden="true">∑</span>
            <div>
              <h3>AI Math Assistant</h3>
              <small>{online ? 'Online and ready to help' : 'Offline draft mode'}</small>
            </div>
          </div>
          <button
            className="legacy-sidebar-toggle"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="legacy-mode-select">
          {modes.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`legacy-mode-btn ${activeTab.mode === item.id ? 'active' : ''}`}
              aria-pressed={activeTab.mode === item.id}
              onClick={() => updateTab(activeTab.id, (tab) => ({ ...tab, mode: item.id }))}
            >
              <span className="legacy-mode-icon" aria-hidden="true">
                {item.id === 'solve' ? '⌕' : item.id === 'learn' ? '▱' : '✎'}
              </span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
            </button>
          ))}
          <button type="button" className="legacy-mode-btn" onClick={() => chooseTool('calculator')}>
            <Calculator size={18} />
            <span><strong>Calculator</strong><small>Compute and send to chat</small></span>
          </button>
        </div>

        <div className="legacy-sidebar-history">
          <div className="legacy-history-title">
            <h4>Recent Chats</h4>
            <button type="button" onClick={newConversation} aria-label="New conversation">
              <Plus size={15} />
            </button>
          </div>
          {['Quadratic formula help', 'Integral of sin(x)dx', 'Matrix multiplication', 'Probability basics'].map((item) => (
            <button
              type="button"
              className="legacy-history-item"
              key={item}
              onClick={() => chooseRecentChat(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="legacy-sidebar-bottom">
          <button type="button" className="legacy-lessons-link" onClick={() => chooseTool('lessons')}>
            <BookOpen size={16} /> Saved lessons
          </button>
          <p>MathDesk helps you understand the why, not just the answer.</p>
        </div>
      </aside>

      <main className="legacy-chat-main">
        <header className="legacy-chat-header">
          {sidebarCollapsed && (
            <button
              className="legacy-expand-btn"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <ChevronRight size={19} />
            </button>
          )}
          <div className="legacy-chat-header-info">
            <div className="legacy-header-title">
              <span className="legacy-ai-mark small" aria-hidden="true">∑</span>
              <div>
                <h3>MathDesk AI</h3>
                <p>Upload or type a problem to get started</p>
              </div>
            </div>
            <span className={`legacy-online-badge ${online ? '' : 'offline'}`}>
              <span />{online ? 'Online' : 'Offline'}
            </span>
          </div>
          <span className="legacy-mode-badge">{currentModeLabel}</span>
        </header>

        <div className="legacy-tab-bar" role="tablist" aria-label="Conversations">
          {tabs.map((tab, index) => {
            const selected = tab.id === activeTab.id;
            return (
              <div className={`legacy-tab-item ${selected ? 'active' : ''}`} key={tab.id}>
                <button
                  type="button"
                  className={`legacy-tab ${selected ? 'active' : ''}`}
                  id={`chat-tab-${tab.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls="conversation-panel"
                  title={tab.title}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => switchTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{tab.title}</span>
                </button>
                <button
                  type="button"
                  className="legacy-tab-close"
                  title={`Close ${tab.title}`}
                  aria-label={`Close ${tab.title}`}
                  onClick={(event) => closeTab(tab.id, event)}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className="legacy-new-tab"
            onClick={newConversation}
            title="New conversation"
            aria-label="New conversation"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="legacy-chat-messages" id="conversation-panel" role="tabpanel" aria-labelledby={`chat-tab-${activeTab.id}`} aria-live="polite">
          {activeTab.messages.length === 0 && (
            <div className="legacy-chat-empty">
              <div className="legacy-empty-orbit" aria-hidden="true"><span>∫</span><span>π</span><span>Σ</span></div>
              <h2>Pick a mode, then start typing</h2>
              <p>Upload a problem, take a photo, or ask Desky to explain a concept.</p>
            </div>
          )}
          {activeTab.messages.map((message, index) => (
            <article className={`legacy-message ${message.role}`} key={`${activeTab.id}-${message.role}-${index}`}>
              <div className="legacy-msg-avatar" aria-hidden="true">
                {message.role === 'ai' ? '∑' : <UserRound size={15} />}
              </div>
              <div className="legacy-msg-bubble">
                {message.imagePreviews?.map((preview) => (
                  <img className="message-image" src={preview} alt="Uploaded math problem" key={preview} />
                ))}
                {message.role === 'ai'
                  ? <div dangerouslySetInnerHTML={{ __html: formatAIReply(message.content) }} />
                  : <p>{message.content}</p>}
              </div>
            </article>
          ))}
          {currentBusy && (
            <div className="legacy-message ai">
              <div className="legacy-msg-avatar" aria-hidden="true">∑</div>
              <div className="legacy-msg-bubble">
                <div className="legacy-typing"><i /><i /><i /><span>Desky is thinking…</span></div>
              </div>
            </div>
          )}
        </div>

        {activeTab.notice && <p className="chat-notice" role="alert">{activeTab.notice}</p>}
        <div className="legacy-upload-strip" onClick={() => fileInputRef.current?.click()}>
          <Upload size={15} /> Click to upload an image or file
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt"
            hidden
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files, activeTab.id);
              event.target.value = '';
            }}
          />
        </div>

        {activeTab.pendingImages.length > 0 && (
          <div className="pending-images legacy-pending">
            {activeTab.pendingImages.map((image, index) => (
              <div className="pending-image" key={image.preview}>
                <img src={image.preview} alt="Pending upload" />
                <button
                  type="button"
                  onClick={() => updateTab(activeTab.id, (tab) => ({
                    ...tab,
                    pendingImages: tab.pendingImages.filter((_item, itemIndex) => itemIndex !== index),
                  }))}
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="legacy-composer">
          <div className="legacy-input-row">
            <button
              type="button"
              className="legacy-plus-btn"
              onClick={() => setToolbarOpen((open) => !open)}
              aria-label="More tools"
              aria-expanded={toolbarOpen}
            >
              <Plus size={21} />
            </button>
            <textarea
              ref={textareaRef}
              value={activeTab.draft}
              onChange={(event) => updateDraft(activeTab.id, event.target.value)}
              onPaste={handlePaste}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={placeholders[activeTab.mode]}
              rows={1}
              disabled={currentBusy}
              aria-label="Message MathDesk AI"
            />
            <button
              type="button"
              className="legacy-camera-btn"
              onClick={() => chooseTool('camera')}
              aria-label="Take a photo"
            >
              <Camera size={20} />
            </button>
            <button
              type="button"
              className="legacy-send-btn"
              onClick={() => void send()}
              disabled={currentBusy || (!activeTab.draft.trim() && activeTab.pendingImages.length === 0)}
              aria-label="Send message"
            >
              {currentBusy ? <LoaderCircle className="spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
          <div className="legacy-composer-hint">
            <span>Shift + Enter for a new line</span>
            <span>{online ? 'AI responses are generated online' : 'Draft saved locally'}</span>
          </div>
          {toolbarOpen && (
            <div className="legacy-toolbar-popup">
              <button type="button" onClick={() => chooseTool('camera')}><Camera size={17} /> Take a photo</button>
              <button type="button" onClick={() => chooseTool('handwriting')}><PenLine size={17} /> Handwrite math</button>
              <button type="button" onClick={() => { fileInputRef.current?.click(); setToolbarOpen(false); }}><Paperclip size={17} /> Upload from device</button>
              <button type="button" onClick={() => { setToolbarOpen(false); textareaRef.current?.focus(); }}><span>∑</span> Insert math symbols</button>
              <button type="button" onClick={() => chooseTool('calculator')}><Calculator size={17} /> Open calculator</button>
              <button type="button" onClick={() => chooseTool('graph')}><span>⌁</span> Graphing tool</button>
              <div />
              <button type="button" onClick={newConversation}><Plus size={17} /> New conversation</button>
            </div>
          )}
        </div>
      </main>

      {tool === 'calculator' && (
        <CalculatorPanel
          onClose={() => setTool(null)}
          onSendToChat={(value) => { updateDraft(activeTab.id, value); setTool(null); textareaRef.current?.focus(); }}
        />
      )}
      {tool === 'graph' && <GraphingTool onClose={() => setTool(null)} />}
      {tool === 'handwriting' && <HandwritingCanvas onClose={() => setTool(null)} onUseImage={useImage} />}
      {tool === 'camera' && <CameraCapture onClose={() => setTool(null)} onUseImage={useImage} />}
      {tool === 'lessons' && (
        <LessonLibrary onClose={() => setTool(null)} initialContent={activeTab.draft} />
      )}
    </section>
  );
}
