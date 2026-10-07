import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Lightbulb,
  Menu,
  Sigma,
  Target,
  Upload,
  X,
} from 'lucide-react';
import AuthPanel from './components/AuthPanel';
import BackgroundClickWave from './components/BackgroundClickWave';
import ChatWorkspace from './components/ChatWorkspace';
import CursorParticleField from './components/CursorParticleField';
import DeskbotHelpWidget from './components/DeskbotHelpWidget';
import DeskyParticleLogo from './components/DeskyParticleLogo';
import HomepageMotionChrome from './components/HomepageMotionChrome';
import MotionToggle from './components/MotionToggle';
import SamplePromptCarousel from './components/SamplePromptCarousel';
import SharedConversationPage from './components/SharedConversationPage';
import VisitorCounterBadge from './components/VisitorCounterBadge';
import ToolsDirectory from './components/ToolsDirectory';
import { ThemeProvider } from './components/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';
import { useAuthUser } from './hooks/useAuthUser';
import { mathdeskAI } from './services/mathdeskAI';
import type { MathDeskMode } from './types/ai';

const modes: Array<{ id: MathDeskMode; label: string; description: string; Icon: typeof Sigma }> = [
  { id: 'solve', label: 'Solve', description: 'Work through a problem step by step.', Icon: Sigma },
  { id: 'learn', label: 'Learn', description: 'Understand the idea behind the answer.', Icon: Lightbulb },
  { id: 'practice', label: 'Practice', description: 'Generate exercises at your pace.', Icon: Target },
];

const PENDING_SHARE_KEY = 'mathdesk.pending-share-token';

function shareTokenFromHash() {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('share') || '';
}

function initialShareToken() {
  const token = shareTokenFromHash();
  if (token) return token;
  try { return sessionStorage.getItem(PENDING_SHARE_KEY) || ''; } catch { return ''; }
}

function AppContent() {
  const { ready: authReady, userId } = useAuthUser();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mode, setMode] = useState<MathDeskMode>('solve');
  const [prompt, setPrompt] = useState('');
  const [autoSendInitialPrompt, setAutoSendInitialPrompt] = useState(false);
  const [initialFiles, setInitialFiles] = useState<File[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const homeUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('revealed'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.14 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleHashChange = () => setShareToken(shareTokenFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function openWorkspace(nextMode: MathDeskMode, nextPrompt = '', autoSend = false) {
    setMode(nextMode);
    setPrompt(nextPrompt);
    setInitialFiles([]);
    setAutoSendInitialPrompt(autoSend);
    setMobileNavOpen(false);
    setWorkspaceOpen(true);
  }

  function navigateHome() {
    setInitialFiles([]);
    setWorkspaceOpen(false);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateTools() {
    setInitialFiles([]);
    setWorkspaceOpen(false);
    setMobileNavOpen(false);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>('.tools-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function startPhotoUpload() {
    const picker = homeUploadInputRef.current;
    if (!picker) return;
    picker.value = '';
    // Called directly from the user's click so browsers allow the native file picker.
    picker.click();
  }

  function leaveShare() {
    try { sessionStorage.removeItem(PENDING_SHARE_KEY); } catch { /* Storage may be disabled. */ }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setShareToken('');
    setWorkspaceOpen(false);
  }

  if (shareToken) {
    return (
      <div className="app-shell shared-view-shell">
        <SharedConversationPage
          token={shareToken}
          authReady={authReady}
          userId={userId}
          onHome={leaveShare}
        />
      </div>
    );
  }

  if (workspaceOpen) {
    return (
      <div className="app-shell restored-chat-page">
        {authReady ? (
          <ChatWorkspace
            key={userId ?? 'anonymous'}
            initialMode={mode}
            initialPrompt={prompt}
            autoSendInitialPrompt={autoSendInitialPrompt}
            initialFiles={initialFiles}
            userId={userId}
            onNavigateHome={navigateHome}
            onNavigateTools={navigateTools}
          />
        ) : <p className="chat-loading" role="status">Loading your workspace…</p>}
      </div>
    );
  }

  return (
    <main className="shell homepage-shell" id="top">
      <CursorParticleField />
      <BackgroundClickWave />
      <input
        ref={homeUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []).filter((file) => file.type.startsWith('image/'));
          event.currentTarget.value = '';
          if (files.length === 0) return;
          setInitialFiles(files);
          setMode('solve');
          setPrompt('');
          setAutoSendInitialPrompt(false);
          setWorkspaceOpen(true);
        }}
      />

      <nav className={`topbar home-topbar ${mobileNavOpen ? 'menu-open' : ''}`} aria-label="Main navigation">
        <a className="home-brand" href="#top" aria-label="MathDesk home" onClick={() => setMobileNavOpen(false)}>
          <img src="/desky-mascot.webp" alt="" aria-hidden="true" />
          <span>Math<span>Desk</span></span>
        </a>
        <button
          type="button"
          className="home-nav-toggle"
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        <div className={`home-nav-menu ${mobileNavOpen ? 'is-open' : ''}`}>
          <a className="home-nav-link active" href="#top" aria-current="page" onClick={() => setMobileNavOpen(false)}>Home</a>
          <button className="home-nav-link" type="button" onClick={navigateTools}>Tools</button>
          <button className="home-nav-link" type="button" onClick={() => openWorkspace(mode, prompt)}>AI Chatbox</button>
          <MotionToggle />
          <ThemeToggle />
          <AuthPanel compact />
        </div>
      </nav>

      <section className="hero hero-with-desky" aria-labelledby="home-title">
        <div className="hero-copy">
          <DeskyParticleLogo />
          <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" /> A calmer way to understand math</p>
          <h1 id="home-title">Ask. Learn. <em>Understand.</em></h1>
          <p className="lede">A learning workspace for students, tutors, and curious minds. Choose how you want to begin, then continue in the same MathDesk AI chatbox.</p>
        </div>
      </section>

      <section className="home-start-grid" aria-label="Start learning with MathDesk">
        <section className="workspace-card reveal-on-scroll" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">Interactive workspace</p>
              <h2 id="workspace-title">Start with a learning mode</h2>
            </div>
            <span className={`online-dot ${mathdeskAI.configured ? 'is-configured' : 'is-unavailable'}`}>
              {mathdeskAI.configured ? 'AI endpoint set' : 'AI unavailable'}
            </span>
          </div>
          <div className="mode-grid" role="tablist" aria-label="Learning modes">
            {modes.map(({ id, label, description, Icon }) => (
              <button
                className={`mode-card ${mode === id ? 'active' : ''}`}
                key={id}
                type="button"
                onClick={() => setMode(id)}
                role="tab"
                aria-selected={mode === id}
              >
                <span className="mode-card-icon" aria-hidden="true"><Icon size={19} /></span>
                <strong>{label}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>
          <div className="prompt-row">
            <label className="sr-only" htmlFor="homepage-prompt">Math question</label>
            <textarea
              id="homepage-prompt"
              value={prompt}
              maxLength={12000}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  openWorkspace(mode, prompt);
                }
              }}
              placeholder="Try: Explain why the derivative of x² is 2x"
              rows={2}
            />
            <button className="send-button" type="button" onClick={() => openWorkspace(mode, prompt)} aria-label="Open AI chatbox">
              <ArrowUpRight size={21} />
            </button>
          </div>
          <p className="status">Everything continues in the main AI chatbox, including uploads and saved history.</p>
          <button className="workspace-link" type="button" onClick={() => openWorkspace(mode, prompt)}>Open full workspace <ArrowUpRight size={15} /></button>
        </section>

        <SamplePromptCarousel onSelect={(nextMode, nextPrompt) => openWorkspace(nextMode, nextPrompt, true)} />
      </section>

      <section className="feature-strip reveal-on-scroll" aria-label="MathDesk capabilities">
        <div className="marquee-strip" aria-hidden="true">
          <div className="marquee-track">
            <span>Upload a lesson</span><span>→</span><span>Ask Desky</span><span>→</span><span>Practice with purpose</span><span>→</span><span>Save your progress</span><span>→</span>
            <span>Upload a lesson</span><span>→</span><span>Ask Desky</span><span>→</span><span>Practice with purpose</span><span>→</span><span>Save your progress</span>
          </div>
        </div>
        <div className="feature-strip-grid">
          <article className="feature-card">
            <span className="feature-icon"><Upload size={18} /></span>
            <h3>Bring the problem in</h3>
            <p>Type, upload, photograph, or handwrite a question without leaving the workspace.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><BookOpen size={18} /></span>
            <h3>See the reasoning</h3>
            <p>Switch between solve, learn, and practice modes to match the way you need help.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><Lightbulb size={18} /></span>
            <h3>Keep learning</h3>
            <p>Save lessons locally and sync your progress when your account and connection are available.</p>
          </article>
        </div>
      </section>

      <ToolsDirectory />

      <footer className="footer homepage-footer">
        <div className="footer-contact-group">
          <span className="footer-contact-label">Find me elsewhere</span>
          <nav className="footer-contact-links" aria-label="Chelsea’s contact links">
            <a className="footer-contact-button" href="https://github.com/Tselseya" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a className="footer-contact-button" href="https://www.linkedin.com/in/chelseaandreadominguez/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a className="footer-contact-button" href="https://chelseaandrea-dominguez.netlify.app/" target="_blank" rel="noopener noreferrer">Portfolio</a>
            <a className="footer-contact-button" href="mailto:chelseandrea99@gmail.com">Email</a>
          </nav>
        </div>
        <div className="footer-meta">
          <span>© MathDesk</span>
          <span><a href="./privacy.html">Privacy</a> · <a href="./terms.html">Terms</a></span>
        </div>
      </footer>

      <HomepageMotionChrome />
      <DeskbotHelpWidget
        onOpenChat={(initialPrompt = '') => openWorkspace('solve', initialPrompt)}
        onUploadPhoto={startPhotoUpload}
      />
      <VisitorCounterBadge />
    </main>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
