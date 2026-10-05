import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  BookOpen,
  Calculator,
  Camera,
  Coffee,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Paperclip,
  PenLine,
  Plus,
  Send,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import CalculatorPanel from './CalculatorPanel';
import CameraCapture from './CameraCapture';
import GraphingTool from './GraphingTool';
import HandwritingCanvas from './HandwritingCanvas';
import LessonLibrary from './LessonLibrary';
import { formatAIReply } from '../lib/formatAIReply';
import { newId } from '../lib/ids';
import { ImageRejected, prepareImage, type PreparedImage } from '../lib/images';
import { MAX_IMAGES_PER_MESSAGE, MAX_PROMPT_CHARS } from '../lib/limits';
import { draftKey, scopeOf } from '../lib/localScope';
import { mathdeskAI, validateRequest } from '../services/mathdeskAI';
import { deleteConversation, loadConversations, loadLegacyHistory, saveConversation, type ChatMessageRecord } from '../services/supabase';
import type { MathDeskMode } from '../types/ai';

type PendingImage = PreparedImage;

interface ConversationTab {
  id: string;
  /** Storage slot for the unsent draft: "main" for the first tab so a reload restores it, otherwise the tab id. */
  draftSlot: string;
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
  /** Signed-in user id, or null for anonymous use. The parent remounts this component when it changes. */
  userId: string | null;
}

const PRIMARY_DRAFT_SLOT = 'main';
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

function createConversationTab(scope: string, mode: MathDeskMode, slot?: string, initialPrompt = ''): ConversationTab {
  const tabId = newId();
  const draftSlot = slot ?? tabId;
  let draft = initialPrompt;
  try {
    draft = localStorage.getItem(draftKey(scope, draftSlot)) ?? initialPrompt;
  } catch {
    // Browser storage may be unavailable in private contexts.
  }
  return {
    id: tabId,
    draftSlot,
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

export default function ChatWorkspace({ initialMode = 'solve', initialPrompt = '', userId }: ChatWorkspaceProps) {
  const scope = scopeOf(userId);
  const [tabs, setTabs] = useState<ConversationTab[]>(() => [
    createConversationTab(scope, initialMode, PRIMARY_DRAFT_SLOT, initialPrompt),
  ]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [busyTabIds, setBusyTabIds] = useState<Set<string>>(() => new Set());
  const [tool, setTool] = useState<'calculator' | 'graph' | 'handwriting' | 'camera' | 'lessons' | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [autoSendPending, setAutoSendPending] = useState(false);
  const [graphFromCalculator, setGraphFromCalculator] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestsRef = useRef(new Map<string, AbortController>());
  const calculatorTabId = useRef<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const signedIn = Boolean(userId);

  // Load this account's saved conversations once. The parent remounts the workspace when the account changes,
  // so nothing from a previous account can ever be on screen here.
  useEffect(() => {
    let mounted = true;
    if (!userId) return undefined;
    const noticeOnPrimary = (notice: string) => {
      if (mounted) setTabs((current) => current.map((tab, index) => index === 0 ? { ...tab, notice } : tab));
    };
    loadConversations(userId).then(async (saved) => {
      if (!mounted) return;
      if (saved.length > 0) {
        const restored: ConversationTab[] = saved.map((row) => ({
          id: row.id,
          draftSlot: row.id,
          title: row.title,
          mode: row.mode,
          messages: row.messages,
          draft: '',
          pendingImages: [],
          notice: '',
        }));
        setTabs((current) => {
          const primary = current[0];
          const primaryInUse = primary && (primary.messages.length > 0 || primary.draft.trim() !== '' || primary.pendingImages.length > 0);
          return primaryInUse ? [primary, ...restored] : restored;
        });
        setActiveTabId((currentId) => {
          const primary = tabsRef.current[0];
          const primaryInUse = primary && primary.id === currentId && (primary.messages.length > 0 || primary.draft.trim() !== '' || primary.pendingImages.length > 0);
          return primaryInUse ? currentId : restored[0].id;
        });
        return;
      }
      const legacy = await loadLegacyHistory(userId);
      if (!mounted || legacy.length === 0) return;
      const firstUserMessage = legacy.find((message) => message.role === 'user')?.content ?? '';
      setTabs((current) => current.map((tab, index) => index === 0 && tab.messages.length === 0
        ? { ...tab, messages: legacy, title: firstUserMessage ? titleForMessage(firstUserMessage) : 'Recent conversation' }
        : tab));
    }).catch(() => noticeOnPrimary('Saved chats could not be loaded. Chatting still works.'));
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => () => {
    requestsRef.current.forEach((controller) => controller.abort());
    requestsRef.current.clear();
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
    const slot = tabsRef.current.find((tab) => tab.id === tabId)?.draftSlot ?? tabId;
    try {
      if (value) localStorage.setItem(draftKey(scope, slot), value);
      else localStorage.removeItem(draftKey(scope, slot));
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

  async function addFiles(files: FileList | File[], tabId = activeTabId) {
    const incoming = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (incoming.length === 0) return;
    for (const file of incoming) {
      const existing = tabsRef.current.find((tab) => tab.id === tabId)?.pendingImages.length ?? 0;
      if (existing >= MAX_IMAGES_PER_MESSAGE) {
        updateTab(tabId, (tab) => ({ ...tab, notice: `You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.` }));
        return;
      }
      try {
        const image = await prepareImage(file);
        updateTab(tabId, (tab) => tab.pendingImages.length >= MAX_IMAGES_PER_MESSAGE
          ? tab
          : { ...tab, notice: '', pendingImages: [...tab.pendingImages, image] });
      } catch (problem) {
        const message = problem instanceof ImageRejected ? problem.message : 'That image could not be used. Please try another one.';
        updateTab(tabId, (tab) => ({ ...tab, notice: message }));
      }
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))?.getAsFile();
    if (!image) return;
    event.preventDefault();
    void addFiles([image], activeTabId);
  }

  function switchTab(tabId: string) {
    if (!tabs.some((tab) => tab.id === tabId)) return;
    setActiveTabId(tabId);
    setToolbarOpen(false);
  }

  function newConversation() {
    const tab = createConversationTab(scope, activeTab?.mode ?? initialMode);
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
      localStorage.removeItem(draftKey(scope, tabs[index].draftSlot));
    } catch {
      // Closing a tab should still work if storage is unavailable.
    }
    // Closing a conversation also removes its saved copy, like closing a browser tab.
    if (userId && tabs[index].messages.length > 0) void deleteConversation(userId, tabId).catch(() => undefined);

    if (tabs.length === 1) {
      const replacement = createConversationTab(scope, activeTab?.mode ?? initialMode);
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
    if (next === 'calculator') calculatorTabId.current = activeTabId;
    setTool(next);
    setToolbarOpen(false);
  }

  function chooseRecentChat(prompt: string) {
    updateDraft(activeTab.id, prompt);
    textareaRef.current?.focus();
  }

  function useImage(image: PendingImage) {
    updateTab(activeTab.id, (tab) => tab.pendingImages.length >= MAX_IMAGES_PER_MESSAGE
      ? { ...tab, notice: `You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.` }
      : {
        ...tab,
        pendingImages: [...tab.pendingImages, image],
        draft: tab.draft || 'Solve this problem from the image.',
      });
  }

  // The calculator is not modal, so the conversation it was opened from may no longer be the active one.
  function addCalculatorExchange(problem: string, reply: string) {
    const targetId = tabsRef.current.some((tab) => tab.id === calculatorTabId.current) ? calculatorTabId.current! : activeTabId;
    const target = tabsRef.current.find((tab) => tab.id === targetId);
    if (!target) return;
    const messages: ChatMessageRecord[] = [...target.messages, { role: 'user', content: problem }, { role: 'ai', content: reply }];
    const title = target.messages.some((message) => message.role === 'user') ? target.title : titleForMessage(problem);
    updateTab(targetId, (tab) => ({ ...tab, messages, title }));
    if (userId) {
      void saveConversation(userId, { id: targetId, title, mode: target.mode, messages })
        .catch(() => updateTab(targetId, (tab) => ({ ...tab, notice: 'This calculation could not be saved to your account.' })));
    }
  }

  // Legacy behaviour: "Solve this" on the handwriting canvas adds the drawing and sends it straight away.
  function solveHandwriting(image: PendingImage) {
    useImage(image);
    setAutoSendPending(true);
  }

  useEffect(() => {
    if (!autoSendPending || activeTab.pendingImages.length === 0) return;
    setAutoSendPending(false);
    void send();
  }, [autoSendPending, tabs]);

  async function send() {
    const current = tabs.find((tab) => tab.id === activeTabId);
    if (!current || busyTabIds.has(current.id)) return;
    const text = current.draft.trim();
    if (!text && current.pendingImages.length === 0) return;
    const images = current.pendingImages.map(({ preview: _preview, ...image }) => image);
    const message = text || 'Solve this problem from the uploaded image.';
    // Check limits before touching state, so a rejected message never loses the draft.
    try {
      validateRequest({ message, mode: current.mode, ...(images.length ? { hasImages: true, images } : {}) });
    } catch (problem) {
      updateTab(current.id, (tab) => ({ ...tab, notice: problem instanceof Error ? problem.message : 'That message could not be sent.' }));
      return;
    }
    if (!online) {
      updateTab(current.id, (tab) => ({
        ...tab,
        notice: 'You are offline. Your draft is saved; reconnect to request a new AI response.',
      }));
      return;
    }

    const userMessage: ChatMessageRecord = {
      role: 'user',
      content: message,
      imagePreviews: current.pendingImages.map((image) => image.preview),
    };
    const nextMessages = [...current.messages, userMessage];
    const nextTitle = current.messages.some((message) => message.role === 'user')
      ? current.title
      : titleForMessage(text || userMessage.content);

    updateTab(current.id, (tab) => ({
      ...tab,
      messages: nextMessages,
      title: nextTitle,
      draft: '',
      pendingImages: [],
      notice: '',
    }));
    try {
      localStorage.removeItem(draftKey(scope, current.draftSlot));
    } catch {
      // The message is already in the active tab state.
    }

    const controller = new AbortController();
    requestsRef.current.set(current.id, controller);
    markBusy(current.id, true);
    let answered: ChatMessageRecord[] | null = null;
    try {
      const reply = await mathdeskAI.request(
        {
          message: userMessage.content,
          mode: current.mode,
          ...(images.length ? { hasImages: true, images } : {}),
        },
        { signal: controller.signal },
      );
      const updatedMessages: ChatMessageRecord[] = [...nextMessages, { role: 'ai', content: reply }];
      answered = updatedMessages;
      updateTab(current.id, (tab) => ({ ...tab, messages: updatedMessages }));
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
    // Saving is separate from answering: a save problem must not look like an AI failure.
    if (answered && userId && !controller.signal.aborted) {
      try {
        await saveConversation(userId, { id: current.id, title: nextTitle, mode: current.mode, messages: answered });
      } catch {
        updateTab(current.id, (tab) => ({ ...tab, notice: 'The answer could not be saved to your account. It is still here for this session.' }));
      }
    }
  }

  if (!activeTab) return null;
  const currentModeLabel = modes.find((item) => item.id === activeTab.mode)?.label || 'Math Assistant';
  const currentBusy = busyTabIds.has(activeTab.id);

  return (
    <section
      className={`legacy-chat-shell restored-chat ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      aria-label="MathDesk AI chatbox"
    >
      <aside className="legacy-chat-sidebar">
        <div className="legacy-sidebar-header"><div className="legacy-sidebar-heading"><h3>AI Math Assistant</h3></div><button type="button" className="legacy-sidebar-toggle" onClick={() => setSidebarCollapsed(true)} aria-label="Collapse sidebar"><ChevronLeft size={19} /></button></div>
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

        <div className="legacy-sidebar-history"><div className="legacy-history-title"><h4>Recent Chats</h4><button type="button" onClick={newConversation} aria-label="New conversation"><Plus size={15} /></button></div>
          {tabs.filter((tab) => tab.messages.length > 0).map((tab) => <button type="button" className="legacy-history-item" key={tab.id} onClick={() => switchTab(tab.id)}>{tab.title}</button>)}
          {!tabs.some((tab) => tab.messages.length > 0) && <p className="legacy-history-empty">{signedIn ? 'No saved chats yet.' : 'Log in to see your saved chats.'}</p>}
        </div>
        <div className="legacy-sidebar-bottom"><a className="legacy-support-link" href="https://ko-fi.com/mathdesk" target="_blank" rel="noopener noreferrer"><Coffee size={18} /> Support MathDesk</a></div>
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
            <div className="legacy-header-title"><div><h3>MathDesk AI</h3><p>Upload or type a problem to get started</p></div></div>
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
          <article className="legacy-message ai welcome-message"><div className="legacy-msg-avatar" aria-hidden="true">🤖</div><div className="legacy-msg-bubble"><p>👋 Hi! I'm MathDesk AI. I can help you in three ways:</p><p><strong>🔍 Solve:</strong> paste or photo a problem and I'll solve it with full steps<br /><strong>📖 Learn:</strong> upload a lesson and I'll explain it and give you examples<br /><strong>✏️ Practice:</strong> tell me a topic and I'll generate practice problems</p><p>Pick a mode on the left, or just start typing!</p></div></article>
          <div className="legacy-quick-actions"><button type="button" onClick={() => { updateTab(activeTab.id, (tab) => ({ ...tab, mode: 'solve' })); chooseRecentChat('Solve: x² + 5x + 6 = 0'); }}>Try a sample problem</button><button type="button" onClick={() => { updateTab(activeTab.id, (tab) => ({ ...tab, mode: 'practice' })); chooseRecentChat('Generate 3 practice problems on derivatives'); }}>Generate practice</button></div>
          {activeTab.messages.map((message, index) => (
            <article className={`legacy-message ${message.role}`} key={`${activeTab.id}-${message.role}-${index}`}>
              <div className="legacy-msg-avatar" aria-hidden="true">
                {message.role === 'ai' ? '🤖' : <UserRound size={18} />}
              </div>
              <div className="legacy-msg-bubble">
                {message.imagePreviews?.map((preview) => (
                  <img className="message-image" src={preview} alt="Uploaded math problem" key={preview} />
                ))}
                {message.role === 'ai'
                  ? <div className="formatted-reply" dangerouslySetInnerHTML={{ __html: formatAIReply(message.content) }} />
                  : <p>{message.content}</p>}
              </div>
            </article>
          ))}
          {currentBusy && (
            <div className="legacy-message ai">
              <div className="legacy-msg-avatar" aria-hidden="true">🤖</div>
              <div className="legacy-msg-bubble">
                <div className="legacy-typing"><i /><i /><i /><span>Desky is thinking…</span></div>
              </div>
            </div>
          )}
        </div>

        {activeTab.notice && <p className="chat-notice" role="alert">{activeTab.notice}</p>}
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files, activeTab.id); event.target.value = ''; }} />
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
              maxLength={MAX_PROMPT_CHARS}
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
            <span>
              {activeTab.draft.length > MAX_PROMPT_CHARS * 0.8 && <span className="chat-count">{activeTab.draft.length.toLocaleString()}/{MAX_PROMPT_CHARS.toLocaleString()} · </span>}
              {!mathdeskAI.configured ? 'AI is not available right now' : online ? 'AI responses are generated online' : 'Draft saved locally'}
            </span>
          </div>
          <p className="chat-privacy-note">Your messages and photos are sent to an AI service to write answers. Please don&apos;t share personal information. <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></p>
          {toolbarOpen && (
            <div className="legacy-toolbar-popup">
              <button type="button" onClick={() => chooseTool('camera')}><Camera size={17} /> Take a photo</button>
              <button type="button" onClick={() => chooseTool('handwriting')}><PenLine size={17} /> Handwrite math</button>
              <button type="button" onClick={() => { fileInputRef.current?.click(); setToolbarOpen(false); }}><Paperclip size={17} /> Upload from device</button>
              <button type="button" onClick={() => { setToolbarOpen(false); textareaRef.current?.focus(); }}><span>∑</span> Insert math symbols</button>
              <button type="button" onClick={() => chooseTool('calculator')}><Calculator size={17} /> Open calculator</button>
              <button type="button" onClick={() => chooseTool('graph')}><span>⌁</span> Graphing tool</button>
              <button type="button" onClick={() => chooseTool('lessons')}><BookOpen size={17} /> Saved lessons</button>
              <div />
              <button type="button" onClick={newConversation}><Plus size={17} /> New conversation</button>
            </div>
          )}
        </div>
      </main>

      {tool === 'calculator' && (
        <CalculatorPanel
          onClose={() => setTool(null)}
          onSendToChat={(value) => { updateDraft(activeTab.id, value); textareaRef.current?.focus(); }}
          onAddToChat={addCalculatorExchange}
          onOpenGraph={() => setGraphFromCalculator(true)}
        />
      )}
      {(tool === 'graph' || graphFromCalculator) && <GraphingTool onClose={() => { setGraphFromCalculator(false); setTool((current) => (current === 'graph' ? null : current)); }} />}
      {tool === 'handwriting' && <HandwritingCanvas onClose={() => setTool(null)} onUseImage={useImage} onSolve={solveHandwriting} />}
      {tool === 'camera' && <CameraCapture onClose={() => setTool(null)} onUseImage={useImage} />}
      {tool === 'lessons' && (
        <LessonLibrary onClose={() => setTool(null)} initialContent={activeTab.draft} userId={userId} />
      )}
    </section>
  );
}
