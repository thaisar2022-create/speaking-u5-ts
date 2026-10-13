import { useState, useEffect, useRef } from 'react';
import {
  words,
  sentences,
  unit5GrammarPatterns,
  schoolPhonetics,
  qaLessons,
  rearrangeLessons,
  quizQuestions,
  blanks,
  fillVocabulary,
  WordItem
} from './data/unit5Data';

type Page = 'home' | 'learn' | 'practice' | 'flash' | 'settings';
type LearnTab = 'Words' | 'Sentences' | 'Q & A' | 'Grammar';
type PracticeMode = 'quiz' | 'blank' | 'rearrange';

interface QuizResponse {
  index: number;
  choice: number;
  correct: boolean;
}

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [learnTab, setLearnTab] = useState<LearnTab>('Words');
  const [learnIndex, setLearnIndex] = useState(0);
  const [qaIndex, setQaIndex] = useState(0);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashBack, setFlashBack] = useState(false);
  const [practice, setPractice] = useState<PracticeMode>('quiz');

  // Quiz State
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizResponses, setQuizResponses] = useState<QuizResponse[]>([]);

  // Listen & Fill State
  const [fillIndex, setFillIndex] = useState(0);
  const [fillChoice, setFillChoice] = useState<number | null>(null);
  const [fillChecked, setFillChecked] = useState(false);

  // Rearrange Sentence State
  const [reorderIndex, setReorderIndex] = useState(0);
  const [reorderPicked, setReorderPicked] = useState<number[]>([]);
  const [reorderChecked, setReorderChecked] = useState(false);

  // Settings & Audio State
  const [speed, setSpeed] = useState<number>(() => {
    return parseFloat(localStorage.getItem('thaiSpeed') || '0.85');
  });
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('thaiDoneUnit5V4') || '[]');
    } catch {
      return [];
    }
  });
  const [statusText, setStatusText] = useState('');
  const [detectedVoices, setDetectedVoices] = useState<string>('');

  // Audio Recording State
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [recordedAudios, setRecordedAudios] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Calculate Progress
  const totalActivities =
    words.length +
    sentences.length +
    qaLessons.length +
    rearrangeLessons.length +
    quizQuestions.length +
    blanks.length;
  const progressPct = Math.min(100, Math.round((done.length / Math.max(1, totalActivities)) * 100));

  const markDone = (key: string) => {
    if (!done.includes(key)) {
      const updated = [...done, key];
      setDone(updated);
      localStorage.setItem('thaiDoneUnit5V4', JSON.stringify(updated));
    }
  };

  // Speech Synthesis Helper
  const speak = (text: string, customSpeed?: number) => {
    if (!('speechSynthesis' in window)) {
      alert('ဤဖုန်းတွင် စာသားမှ အသံဖတ်သည့်စနစ် မရရှိပါ။');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'th-TH';
    u.rate = customSpeed !== undefined ? customSpeed : speed;

    const voices = window.speechSynthesis.getVoices();
    const v =
      voices.find(voc => voc.lang.toLowerCase() === 'th-th') ||
      voices.find(voc => voc.lang.toLowerCase().startsWith('th'));

    if (v) {
      u.voice = v;
    } else {
      setStatusText(
        'Thai voice not found. Your phone may use a fallback voice. For accurate Thai tones, use recorded audio in the production app.'
      );
    }
    window.speechSynthesis.speak(u);
  };

  // Update voices on voice list change
  useEffect(() => {
    const updateVoiceList = () => {
      if ('speechSynthesis' in window) {
        const vs = window.speechSynthesis.getVoices() || [];
        const thaiVoices = vs.filter(x => x.lang.toLowerCase().startsWith('th'));
        if (thaiVoices.length > 0) {
          setDetectedVoices(thaiVoices.map(x => `${x.name} (${x.lang})`).join(', '));
        } else {
          setDetectedVoices('No Thai voice is currently detected on this device.');
        }
      }
    };
    updateVoiceList();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }
  }, []);

  // Voice Recording Toggle
  const toggleRecord = async (id: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setActiveRecordingId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Recording requires HTTPS (or localhost) and a compatible browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setActiveRecordingId(id);

      rec.ondataavailable = e => {
        if (e.data.size) audioChunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedAudios(prev => {
          if (prev[id]) URL.revokeObjectURL(prev[id]);
          return { ...prev, [id]: url };
        });
        setActiveRecordingId(null);
      };

      mediaRecorderRef.current = rec;
      rec.start();
    } catch (e: any) {
      alert('Microphone permission unavailable: ' + (e?.message || 'Access denied'));
      setActiveRecordingId(null);
    }
  };

  const navigate = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  // Step Learn
  const stepLearn = (delta: number) => {
    const arr = learnTab === 'Words' ? words : sentences;
    markDone(`learn-${learnTab}-${learnIndex}`);
    setLearnIndex((learnIndex + delta + arr.length) % arr.length);
  };

  // Step QA
  const stepQA = (delta: number) => {
    markDone(`learn-qa-${qaIndex}`);
    setQaIndex((qaIndex + delta + qaLessons.length) % qaLessons.length);
  };

  // Flashcards
  const flip = () => {
    setFlashBack(!flashBack);
    markDone(`card-${flashIndex}`);
  };

  const nextFlash = (delta: number) => {
    setFlashIndex((flashIndex + delta + words.length) % words.length);
    setFlashBack(false);
  };

  // Practice Modes Switch
  const switchPractice = (mode: PracticeMode) => {
    setPractice(mode);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizResponses([]);
    setFillChoice(null);
    setFillChecked(false);
    setReorderIndex(0);
    setReorderPicked([]);
    setReorderChecked(false);
  };

  // Quiz Handlers
  const chooseQuiz = (choice: number) => {
    if (quizResponses.some(r => r.index === quizIndex)) return;
    const currentQ = quizQuestions[quizIndex];
    const isCorrect = choice === currentQ.correct;
    setQuizResponses(prev => [...prev, { index: quizIndex, choice, correct: isCorrect }]);
    if (isCorrect) setQuizScore(s => s + 1);
  };

  const nextQuiz = () => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(i => i + 1);
    } else {
      markDone('unit5-quiz-completed');
      setQuizIndex(quizQuestions.length);
    }
  };

  // Listen & Fill Handlers
  const currentBlank = blanks[fillIndex % blanks.length];
  const chooseFill = (choice: number) => {
    if (fillChecked) return;
    setFillChoice(choice);
  };

  const checkBlank = () => {
    if (fillChecked || fillChoice === null) return;
    setFillChecked(true);
    if (currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${fillIndex}`);
    }
  };

  const retryFill = () => {
    setFillChoice(null);
    setFillChecked(false);
  };

  const nextFill = () => {
    if (fillChecked && fillChoice !== null && currentBlank.choices[fillChoice] === currentBlank.answer) {
      markDone(`blank-${fillIndex}`);
    }
    setFillIndex(i => (i + 1) % blanks.length);
    setFillChoice(null);
    setFillChecked(false);
  };

  // Rearrange Handlers
  const currentRearrange = rearrangeLessons[reorderIndex % rearrangeLessons.length];
  const rearrangeBankOrder = (idx: number) => {
    const n = rearrangeLessons[idx].parts.length;
    return Array.from({ length: n }, (_, i) => n - 1 - i);
  };
  const availableRearrangeTokens = rearrangeBankOrder(reorderIndex).filter(
    id => !reorderPicked.includes(id)
  );

  const pickRearranged = (id: number) => {
    if (reorderPicked.includes(id) || reorderPicked.length >= currentRearrange.parts.length) return;
    setReorderPicked([...reorderPicked, id]);
    setReorderChecked(false);
  };

  const removeRearranged = (id: number) => {
    setReorderPicked(reorderPicked.filter(p => p !== id));
    setReorderChecked(false);
  };

  const checkRearranged = () => {
    if (reorderPicked.length !== currentRearrange.parts.length) return;
    setReorderChecked(true);
    if (reorderPicked.every((id, j) => id === j)) {
      markDone(`rearrange-${reorderIndex}`);
    }
  };

  const resetRearranged = () => {
    setReorderPicked([]);
    setReorderChecked(false);
  };

  const nextRearranged = () => {
    setReorderIndex((reorderIndex + 1) % rearrangeLessons.length);
    resetRearranged();
  };

  // Render Actions Buttons
  const renderActions = (thai: string, recId: string, withRecord = true) => {
    const isRecording = activeRecordingId === recId;
    return (
      <>
        <div className="controls">
          <button className="btn" onClick={() => speak(thai)}>
            🔊 နားထောင်ပါ
          </button>
          <button className="btn secondary" onClick={() => speak(thai, 0.7)}>
            🐢 ဖြည်းဖြည်း
          </button>
          {withRecord && (
            <button
              className={`btn ghost ${isRecording ? 'recording' : ''}`}
              onClick={() => toggleRecord(recId)}
            >
              {isRecording ? '⏹️ Stop recording' : '🎙️ အသံသွင်းပါ'}
            </button>
          )}
        </div>
        {withRecord && recordedAudios[recId] && (
          <div>
            <p className="muted" style={{ margin: '8px 0 4px', fontSize: 13 }}>
              သင့်အသံကို ပြန်နားထောင်ပါ
            </p>
            <audio controls src={recordedAudios[recId]} />
          </div>
        )}
      </>
    );
  };

  // Render Learn Tab Bar
  const renderTabBar = () => {
    const tabs: LearnTab[] = ['Words', 'Sentences', 'Q & A', 'Grammar'];
    return (
      <div className="controls" style={{ marginBottom: 16 }}>
        {tabs.map(tabName => (
          <button
            key={tabName}
            className={`btn ${learnTab === tabName ? '' : 'secondary'}`}
            onClick={() => {
              setLearnTab(tabName);
              setLearnIndex(0);
            }}
          >
            {tabName}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="app">
      {/* Hero Header */}
      <header className="hero">
        <div className="top">
          <div className="brandwrap">
            <img
              className="school-logo"
              src="/school-logo.svg"
              onError={e => {
                e.currentTarget.src = '/school-logo.png';
              }}
              alt="ThaiSar school logo"
            />
            <div>
              <div className="brand-title">THAISAR</div>
              <div className="logo-label">Thai · Myanmar Speaking School</div>
            </div>
          </div>
          <div className="pill">🇹🇭 + 🇲🇲</div>
        </div>
        <h1>အခန်း (၅) · အချိန်</h1>
        <p>Unit 5 · Listening & Speaking · Beginner</p>
        <div className="progress">
          <span style={{ width: `${progressPct}%` }}></span>
        </div>
        <div id="progressLabel" className="small" style={{ marginTop: 7, color: '#e2f9f0' }}>
          သင်ယူမှု တိုးတက်မှု · {progressPct}% ({done.length} activities)
        </div>
      </header>

      {/* Main Page Content */}
      <main id="main" className="content">
        {/* PAGE 1: HOME */}
        {page === 'home' && (
          <>
            <div className="section-head">
              <h2>စတင်လေ့လာပါ 🌼</h2>
              <span className="muted">အခန်း ၄</span>
            </div>
            <div className="notice">
              အသံကို နားထောင်ပါ → လိုက်ပြောပါ → စာကြောင်းကို လေ့ကျင့်ပါ။ ထိုင်းအက္ခရာ အရင်ကျက်ရန် မလိုပါ။
            </div>
            <div className="rows" style={{ marginTop: 14 }}>
              <button
                className="tile"
                onClick={() => {
                  navigate('learn');
                  setLearnTab('Words');
                  setLearnIndex(0);
                }}
              >
                <span className="emoji">📖</span>
                <strong>စကားလုံးများ</strong>
                <small>Vocabulary · {words.length} items</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigate('learn');
                  setLearnTab('Sentences');
                  setLearnIndex(0);
                }}
              >
                <span className="emoji">🎧</span>
                <strong>ဝါကျများ</strong>
                <small>Listen & repeat · {sentences.length}</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigate('learn');
                  setLearnTab('Grammar');
                }}
              >
                <span className="emoji">🧩</span>
                <strong>သဒ္ဒါ</strong>
                <small>Tap to see examples</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigate('learn');
                  setLearnTab('Q & A');
                  setQaIndex(0);
                }}
              >
                <span className="emoji">💬</span>
                <strong>အမေး / အဖြေ</strong>
                <small>10 learn-only dialogue pairs</small>
              </button>
              <button
                className="tile"
                onClick={() => {
                  navigate('practice');
                  switchPractice('quiz');
                }}
              >
                <span className="emoji">📝</span>
                <strong>Unit 5 Quiz</strong>
                <small>12 comprehension questions</small>
              </button>
            </div>

            <h3 style={{ marginTop: 24 }}>ဒီနေ့ လေ့လာမယ့် ဝါကျ</h3>
            <div className="card">
              <span className="tag">Listen & repeat</span>
              <div className="thai" lang="th">
                {sentences[0].thai}
              </div>
              <div className="phonetic">{sentences[0].phonetic}</div>
              <div className="mm" lang="my">
                {sentences[0].myanmar}
              </div>
              <div className="controls">
                <button className="btn" onClick={() => speak(sentences[0].thai)}>
                  🔊 နားထောင်ပါ
                </button>
                <button className="btn secondary" onClick={() => speak(sentences[0].thai, 0.7)}>
                  🐢 ဖြည်းဖြည်း
                </button>
              </div>
            </div>
            <button className="btn wide" onClick={() => navigate('learn')}>
              သင်ခန်းစာ စတင်ရန် →
            </button>
          </>
        )}

        {/* PAGE 2: LEARN */}
        {page === 'learn' && (
          <>
            {learnTab === 'Words' && (
              <>
                <div className="section-head">
                  <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
                  <span className="counter">
                    {learnIndex + 1} / {words.length}
                  </span>
                </div>
                {renderTabBar()}
                <div className="card">
                  <span className="tag">{words[learnIndex].category}</span>
                  <div className="thai" lang="th">
                    {words[learnIndex].thai}
                  </div>
                  <div className="phonetic">{words[learnIndex].phonetic}</div>
                  <div className="mm" lang="my">
                    {words[learnIndex].myanmar}
                  </div>
                  {renderActions(words[learnIndex].thai, `word-${learnIndex}`)}
                </div>
                <div className="controls">
                  <button className="btn secondary" onClick={() => stepLearn(-1)}>
                    ← ရှေ့သို့
                  </button>
                  <button className="btn" onClick={() => stepLearn(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusText && <p className="footnote">{statusText}</p>}
              </>
            )}

            {learnTab === 'Sentences' && (
              <>
                <div className="section-head">
                  <h2>နားထောင်ပြီး လိုက်ပြောပါ</h2>
                  <span className="counter">
                    {learnIndex + 1} / {sentences.length}
                  </span>
                </div>
                {renderTabBar()}
                <div className="card">
                  <span className="tag">{sentences[learnIndex].category}</span>
                  <div className="thai" lang="th">
                    {sentences[learnIndex].thai}
                  </div>
                  <div className="phonetic">{sentences[learnIndex].phonetic}</div>
                  <div className="mm" lang="my">
                    {sentences[learnIndex].myanmar}
                  </div>
                  {renderActions(sentences[learnIndex].thai, `sentence-${learnIndex}`)}
                </div>
                <div className="controls">
                  <button className="btn secondary" onClick={() => stepLearn(-1)}>
                    ← ရှေ့သို့
                  </button>
                  <button className="btn" onClick={() => stepLearn(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusText && <p className="footnote">{statusText}</p>}
              </>
            )}

            {learnTab === 'Q & A' && (
              <>
                <div className="section-head">
                  <h2>မေးခွန်းနှင့် အဖြေ · Q & A</h2>
                  <span className="counter">
                    {qaIndex + 1} / {qaLessons.length}
                  </span>
                </div>
                {renderTabBar()}
                <p className="section-intro">
                  ဤအမေး/အဖြေ ၁၀ တွဲသည် အခန်း (၅) စာအုပ်တွင် ပါရှိသော မူရင်း အမေးအဖြေများဖြစ်သည်။ တစ်ကြောင်းချင်း နားထောင်ပြီး လိုက်ပြောပါ။ ဖြေရန် မလိုပါ။
                </p>
                <div className="card">
                  {/* Question */}
                  <div className="qa-item">
                    <span className="tag">Q · မေးခွန်း</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][0]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][0]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][2]}
                    </div>
                    {renderActions(qaLessons[qaIndex][0], `qaQ-${qaIndex}`)}
                  </div>
                  <div className="qa-divider">↓ Answer · အဖြေ</div>
                  {/* Answer */}
                  <div className="qa-item">
                    <span className="tag">A · အဖြေ</span>
                    <div className="thai" lang="th">
                      {qaLessons[qaIndex][1]}
                    </div>
                    <div className="phonetic">{schoolPhonetics[qaLessons[qaIndex][1]] || ''}</div>
                    <div className="mm" lang="my">
                      {qaLessons[qaIndex][3]}
                    </div>
                    {renderActions(qaLessons[qaIndex][1], `qaA-${qaIndex}`)}
                  </div>
                </div>
                <div className="controls">
                  <button className="btn secondary" onClick={() => stepQA(-1)}>
                    ← အရင်တစ်ခု
                  </button>
                  <button className="btn" onClick={() => stepQA(1)}>
                    နောက်တစ်ခု →
                  </button>
                </div>
                {statusText && <p className="footnote">{statusText}</p>}
              </>
            )}

            {learnTab === 'Grammar' && (
              <>
                <div className="section-head">
                  <h2>သဒ္ဒါ · Grammar</h2>
                  <span className="counter">{unit5GrammarPatterns.length} patterns</span>
                </div>
                {renderTabBar()}
                <p className="section-intro">
                  အခန်း (၅) စာအုပ်မှ ဝါကျများတွင် ပါဝင်သော သဒ္ဒါပုံစံများကို စုစည်းထားပါသည်။ ခေါင်းစဉ်ကို နှိပ်ပြီး ထိုင်းစာ၊ အသံထွက်နှင့် မြန်မာအဓိပ္ပာယ်ကို လေ့လာပါ။
                </p>
                {unit5GrammarPatterns.map((g, j) => {
                  const examples = g.examples
                    .map(t => sentences.find(s => s.thai === t) || words.find(w => w.thai === t))
                    .filter((x): x is WordItem => Boolean(x));
                  return (
                    <details className="grammar-accordion" key={j} open={j === 0 ? true : undefined}>
                      <summary>
                        {j + 1}. {g.title}
                      </summary>
                      <div className="grammar-body">
                        <h3 style={{ marginTop: 15 }}>{g.formula}</h3>
                        <p className="muted">{g.explain}</p>
                        {examples.map((ex, k) => (
                          <div key={k} style={{ padding: '15px 0', borderTop: '1px solid #efe7f1' }}>
                            <div className="thai" style={{ fontSize: 23 }}>
                              {ex.thai}
                            </div>
                            <div className="phonetic">{ex.phonetic}</div>
                            <div className="mm">{ex.myanmar}</div>
                            <div className="controls">
                              <button className="btn" onClick={() => speak(ex.thai)}>
                                🔊 နားထောင်ပါ
                              </button>
                              <button className="btn secondary" onClick={() => speak(ex.thai, 0.7)}>
                                🐢 ဖြည်းဖြည်း
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* PAGE 3: PRACTICE */}
        {page === 'practice' && (
          <>
            <div className="section-head">
              <h2>Practice · လေ့ကျင့်ခန်း</h2>
            </div>
            <div className="rows practice-tiles">
              <button
                className={`tile ${practice === 'quiz' ? 'selected' : ''}`}
                onClick={() => switchPractice('quiz')}
              >
                📝 <strong>Unit 5 Quiz</strong>
                <small>သင်ယူထားသည်ကို စမ်းစစ်ပါ</small>
              </button>
              <button
                className={`tile ${practice === 'blank' ? 'selected' : ''}`}
                onClick={() => switchPractice('blank')}
              >
                🎧 <strong>Listen & Fill</strong>
                <small>နားထောင်ပြီး ဖြည့်ပါ</small>
              </button>
              <button
                className={`tile ${practice === 'rearrange' ? 'selected' : ''}`}
                onClick={() => switchPractice('rearrange')}
              >
                🧩 <strong>Rearrange Sentence</strong>
                <small>စကားလုံးများကို အစီအစဉ်မှန် စီပါ</small>
              </button>
            </div>

            {/* Exercise Content */}
            <div id="exercise" style={{ marginTop: 14 }}>
              {/* PRACTICE SUBMODE 1: QUIZ */}
              {practice === 'quiz' && (
                <>
                  {quizIndex >= quizQuestions.length ? (
                    <div className="card quiz-finish">
                      <div className="bigscore">
                        {Math.round((quizScore / quizQuestions.length) * 100)}%
                      </div>
                      <h2>Unit 5 Quiz ပြီးပါပြီ!</h2>
                      <p className="mm">
                        {quizScore} / {quizQuestions.length} မှန်ပါတယ်။
                      </p>
                      <p className="muted">
                        မှားခဲ့သော မေးခွန်းများကို ပြန်ကြည့်ပြီး နောက်တစ်ကြိမ် စမ်းကြည့်နိုင်ပါတယ်။
                      </p>
                      {quizResponses
                        .filter(r => !r.correct)
                        .map((r, k) => (
                          <div key={k} className="quiz-review">
                            <strong>{quizQuestions[r.index].q}</strong>
                            <p className="muted">{quizQuestions[r.index].why}</p>
                          </div>
                        ))}
                      <button className="btn wide" onClick={() => switchPractice('quiz')}>
                        🔄 Quiz ပြန်ဖြေရန်
                      </button>
                    </div>
                  ) : (
                    <div className="card">
                      <span className="tag">
                        Unit 5 Quiz · {quizIndex + 1} / {quizQuestions.length}
                      </span>
                      <div className="quiz-progress">
                        <span
                          style={{
                            width: `${(100 * quizIndex) / quizQuestions.length}%`
                          }}
                        ></span>
                      </div>
                      <h3 className="quiz-question">{quizQuestions[quizIndex].q}</h3>
                      {quizQuestions[quizIndex].audio && (
                        <div className="controls">
                          <button
                            className="btn"
                            onClick={() => speak(quizQuestions[quizIndex].audio!)}
                          >
                            🔊 အသံနားထောင်ပါ
                          </button>
                          <button
                            className="btn secondary"
                            onClick={() => speak(quizQuestions[quizIndex].audio!, 0.7)}
                          >
                            🐢 ဖြည်းဖြည်း
                          </button>
                        </div>
                      )}
                      <div className="stack" style={{ marginTop: 17 }}>
                        {quizQuestions[quizIndex].choices.map((opt, j) => {
                          const pickedResponse = quizResponses.find(r => r.index === quizIndex);
                          let optClass = '';
                          if (pickedResponse) {
                            if (j === quizQuestions[quizIndex].correct) {
                              optClass = 'correct';
                            } else if (j === pickedResponse.choice) {
                              optClass = 'incorrect';
                            }
                          }
                          return (
                            <button
                              key={j}
                              className={`quiz-option ${optClass}`}
                              disabled={Boolean(pickedResponse)}
                              onClick={() => chooseQuiz(j)}
                            >
                              {String.fromCharCode(65 + j)}. {opt}
                            </button>
                          );
                        })}
                      </div>

                      {quizResponses.some(r => r.index === quizIndex) ? (
                        <>
                          <div className="quiz-feedback">
                            {quizResponses.find(r => r.index === quizIndex)?.correct
                              ? '✅ မှန်ပါတယ်!'
                              : '❌ လေ့လာပြီး ထပ်စမ်းကြည့်ပါ။'}
                            <p>{quizQuestions[quizIndex].why}</p>
                          </div>
                          <button className="btn wide" onClick={nextQuiz}>
                            {quizIndex === quizQuestions.length - 1
                              ? 'ရလဒ် ကြည့်ရန် →'
                              : 'နောက်မေးခွန်း →'}
                          </button>
                        </>
                      ) : (
                        <p className="muted" style={{ marginTop: 12 }}>
                          အဖြေတစ်ခုကို ရွေးပါ။
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* PRACTICE SUBMODE 2: LISTEN & FILL */}
              {practice === 'blank' && (
                <div className="card fill-card">
                  <span className="tag">
                    🎧 Listen & Fill · {(fillIndex % blanks.length) + 1} / {blanks.length}
                  </span>
                  <p className="section-intro">
                    အသံကို နားထောင်ပြီး အဖြေမှန်ကို ရွေးပါ။ <strong>ထိုင်းစာဖတ်တတ်ရန် မလိုပါ။</strong>{' '}
                    ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic၊ မြန်မာအသံထွက်နှင့် မြန်မာအဓိပ္ပာယ် ပါရှိသည်။
                  </p>
                  <div className="fill-prompt">
                    <span className="fill-prompt-label">မြန်မာအဓိပ္ပာယ်</span>
                    <div className="mm" lang="my">
                      {currentBlank.meaning}
                    </div>
                    <div className="fill-blank-line" lang="th">
                      {currentBlank.blank}
                    </div>
                  </div>
                  <div className="controls">
                    <button className="btn" onClick={() => speak(currentBlank.full)}>
                      🔊 နားထောင်ပါ
                    </button>
                    <button className="btn secondary" onClick={() => speak(currentBlank.full, 0.7)}>
                      🐢 ဖြည်းဖြည်း
                    </button>
                  </div>

                  <h3 className="fill-heading">အဖြေတစ်ခုကို ရွေးပါ။</h3>
                  <div className="fill-options" role="group" aria-label="Listen and Fill multiple choices">
                    {currentBlank.choices.map((word, j) => {
                      const entry = fillVocabulary[word] || ['/—/', '—', '—'];
                      const isCorrectChoice = word === currentBlank.answer;
                      let choiceState = '';
                      if (fillChecked) {
                        if (isCorrectChoice) choiceState = ' is-correct';
                        else if (fillChoice === j) choiceState = ' is-wrong';
                      } else if (fillChoice === j) {
                        choiceState = ' is-selected';
                      }

                      return (
                        <button
                          key={j}
                          type="button"
                          className={`fill-choice${choiceState}`}
                          onClick={() => chooseFill(j)}
                          disabled={fillChecked}
                          aria-pressed={fillChoice === j}
                          aria-label={`${word} · ${entry[2]}`}
                        >
                          <span className="fill-number">{String.fromCharCode(65 + j)}</span>
                          <span className="fill-lines">
                            <span className="fill-thai" lang="th">
                              {word}
                            </span>
                            <span className="fill-phonetic">{entry[0]}</span>
                            <span className="fill-pronunciation" lang="my">
                              {entry[1]}
                            </span>
                            <span className="fill-meaning" lang="my">
                              {entry[2]}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {!fillChecked ? (
                    <button
                      className="btn wide"
                      onClick={checkBlank}
                      disabled={fillChoice === null}
                    >
                      အဖြေစစ်ဆေးပါ
                    </button>
                  ) : (
                    <>
                      <div
                        className={`fill-feedback ${
                          currentBlank.choices[fillChoice!] === currentBlank.answer
                            ? 'good'
                            : 'retry'
                        }`}
                        role="status"
                      >
                        <strong>
                          {currentBlank.choices[fillChoice!] === currentBlank.answer
                            ? '✅ မှန်ပါတယ်!'
                            : '📖 အဖြေမှန်ကို လေ့လာပါ။'}
                        </strong>
                        <p>
                          {currentBlank.choices[fillChoice!] === currentBlank.answer
                            ? 'အသံကို မှန်ကန်စွာ ရွေးချယ်နိုင်ပါတယ်။'
                            : 'မှားသောအဖြေကို ပြထားပြီး အဖြေမှန်ကို အစိမ်းရောင်ဖြင့် ပြထားပါတယ်။'}
                        </p>
                        <div className="fill-fully">
                          <div className="thai" lang="th">
                            {currentBlank.full}
                          </div>
                          <div className="phonetic">
                            {schoolPhonetics[currentBlank.full] || ''}
                          </div>
                          <div className="mm" lang="my">
                            {currentBlank.meaning}
                          </div>
                        </div>
                      </div>
                      <div className="controls">
                        <button className="btn secondary" onClick={retryFill}>
                          ↺ ပြန်လေ့ကျင့်ရန်
                        </button>
                        <button className="btn" onClick={nextFill}>
                          {fillIndex === blanks.length - 1
                            ? 'အစက ပြန်လေ့ကျင့်ရန်'
                            : 'နောက်မေးခွန်း →'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PRACTICE SUBMODE 3: REARRANGE */}
              {practice === 'rearrange' && (
                <div className="card">
                  <span className="tag">
                    Rearrange Sentence · {reorderIndex + 1} / {rearrangeLessons.length}
                  </span>
                  <p className="section-intro">
                    မြန်မာအဓိပ္ပာယ်ကို ဖတ်ပြီး ထိုင်းစကားလုံးများကို အစီအစဉ်မှန် စီပါ။ ကတ်တစ်ခုစီတွင် ထိုင်းစာ၊ စာအုပ်သုံး phonetic နှင့် မြန်မာအသံထွက် ပါရှိသည်။
                  </p>
                  <div className="reorder-prompt">
                    <strong>မြန်မာအဓိပ္ပာယ်</strong>
                    <div className="mm">{currentRearrange.meaning}</div>
                  </div>
                  <div className="controls">
                    <button
                      className="btn secondary"
                      onClick={() =>
                        speak(currentRearrange.parts.map(p => p[0]).join(''))
                      }
                    >
                      🔊 နားထောင်ပါ
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() =>
                        speak(currentRearrange.parts.map(p => p[0]).join(''), 0.7)
                      }
                    >
                      🐢 အနှေးအသံ
                    </button>
                  </div>

                  <div className="reorder-area">
                    <h4>၁။ စီထားသော စကားလုံးများ (နှိပ်၍ ပြန်ဖြုတ်နိုင်ပါသည်)</h4>
                    <div className="reorder-tiles" id="reorderAnswer">
                      {reorderPicked.length > 0 ? (
                        reorderPicked.map(id => {
                          const part = currentRearrange.parts[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className="reorder-token selected"
                              onClick={() => removeRearranged(id)}
                              aria-label={`Remove ${part[0]}`}
                            >
                              <span className="reorder-thai" lang="th">
                                {part[0]}
                              </span>
                              <span className="reorder-phon">{part[1]}</span>
                              <span className="reorder-my" lang="my">
                                {part[2]}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="reorder-empty">
                          အောက်က ကတ်များကို အစဉ်လိုက် နှိပ်ပါ။
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="reorder-bank">
                    <h4>၂။ စကားလုံးကတ်များ</h4>
                    <div className="reorder-tiles" id="reorderChoices">
                      {availableRearrangeTokens.length > 0 ? (
                        availableRearrangeTokens.map(id => {
                          const part = currentRearrange.parts[id];
                          return (
                            <button
                              key={id}
                              type="button"
                              className="reorder-token"
                              onClick={() => pickRearranged(id)}
                              aria-label={`Choose ${part[0]}`}
                            >
                              <span className="reorder-thai" lang="th">
                                {part[0]}
                              </span>
                              <span className="reorder-phon">{part[1]}</span>
                              <span className="reorder-my" lang="my">
                                {part[2]}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <span className="muted">စကားလုံးအားလုံး စီပြီးပါပြီ။</span>
                      )}
                    </div>
                  </div>

                  {reorderChecked && (
                    <>
                      {reorderPicked.every((id, j) => id === j) ? (
                        <>
                          <div className="reorder-status good" role="status">
                            <strong>✅ မှန်ပါတယ်!</strong> စာကြောင်းကို မှန်ကန်စွာ စီထားပါတယ်။
                          </div>
                          <div className="reorder-complete">
                            <div className="thai" lang="th">
                              {currentRearrange.parts.map(p => p[0]).join('')}
                            </div>
                            <div className="phonetic">
                              {`/${currentRearrange.parts
                                .map(p => p[1].replaceAll('/', ''))
                                .join('-')}/`}
                            </div>
                            <div className="mm">{currentRearrange.meaning}</div>
                          </div>
                        </>
                      ) : (
                        <div className="reorder-status try" role="status">
                          အစီအစဉ် မမှန်သေးပါ။ စကားလုံးကို နှိပ်ပြီး ပြန်ရွှေ့နိုင်ပါတယ်။
                        </div>
                      )}
                    </>
                  )}

                  <div className="reorder-controls">
                    <button className="btn secondary" onClick={resetRearranged}>
                      ↺ ပြန်စီရန်
                    </button>
                    {reorderChecked && reorderPicked.every((id, j) => id === j) ? (
                      <button className="btn" onClick={nextRearranged}>
                        {reorderIndex === rearrangeLessons.length - 1
                          ? 'နောက်တစ်ကြိမ် လေ့ကျင့်ရန်'
                          : 'နောက်ဝါကျ →'}
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={checkRearranged}
                        disabled={reorderPicked.length !== currentRearrange.parts.length}
                      >
                        ✓ အဖြေစစ်ရန်
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* PAGE 4: FLASHCARDS */}
        {page === 'flash' && (
          <>
            <div className="section-head">
              <h2>Flashcards · မှတ်သားလေ့ကျင့်</h2>
              <span className="counter">
                {flashIndex + 1} / {words.length}
              </span>
            </div>
            <div
              className="card"
              style={{
                textAlign: 'center',
                minHeight: 310,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onClick={flip}
            >
              <span className="tag">{flashBack ? 'Meaning' : 'Thai word'}</span>
              {flashBack ? (
                <div className="mm" style={{ fontSize: 26 }}>
                  {words[flashIndex].myanmar}
                </div>
              ) : (
                <>
                  <div className="thai">{words[flashIndex].thai}</div>
                  <div className="phonetic">{words[flashIndex].phonetic}</div>
                </>
              )}
              <p className="muted" style={{ marginTop: 12 }}>
                ကတ်ကိုနှိပ်ပြီး လှန်ကြည့်ပါ
              </p>
            </div>
            <div className="controls">
              <button
                className="btn secondary"
                onClick={() => speak(words[flashIndex].thai)}
              >
                🔊 နားထောင်ပါ
              </button>
              <button className="btn ghost" onClick={() => nextFlash(-1)}>
                ← ရှေ့သို့
              </button>
              <button className="btn" onClick={() => nextFlash(1)}>
                နောက်တစ်ခု →
              </button>
            </div>
          </>
        )}

        {/* PAGE 5: SETTINGS */}
        {page === 'settings' && (
          <>
            <h2>⚙️ အသံနှင့် app settings</h2>
            <div className="card">
              <h3>Thai voice · အသံ</h3>
              <p className="muted">
                Thai voice selection depends on the browser and operating system.
              </p>
              <div id="voiceState" className="notice" style={{ margin: '10px 0' }}>
                {detectedVoices || 'Checking Thai voices...'}
              </div>
              <label htmlFor="rate" style={{ display: 'block', marginTop: 12 }}>
                Audio speed · <span id="speedLabel">{speed}</span>×
              </label>
              <input
                id="rate"
                type="range"
                min="0.5"
                max="1.1"
                step="0.05"
                value={speed}
                style={{ width: '100%', margin: '10px 0' }}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setSpeed(val);
                  localStorage.setItem('thaiSpeed', String(val));
                }}
              />
              <div className="controls">
                <button className="btn" onClick={() => speak('สวัสดีครับ')}>
                  🔊 Thai အသံ စမ်းနားထောင်ရန်
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Install on phone</h3>
              <p className="muted">
                Open the hosted site in Chrome on Android or Safari on iPhone, then use Add to Home Screen / Install App.
              </p>
              <p className="small" style={{ color: '#687b74', marginTop: 8 }}>
                A PWA needs HTTPS or localhost. The current downloaded HTML file can be opened as a preview, but installation and offline caching require hosting.
              </p>
            </div>

            <div className="card">
              <h3>Student progress</h3>
              <p className="muted">
                Saved on this device, not synchronized with a school account.
              </p>
              <button
                className="btn secondary"
                style={{ marginTop: 10 }}
                onClick={() => {
                  if (confirm('Reset your progress?')) {
                    setDone([]);
                    localStorage.removeItem('thaiDoneUnit5V4');
                  }
                }}
              >
                Reset progress
              </button>
            </div>
          </>
        )}
      </main>

      {/* Bottom Fixed Navigation */}
      <nav className="nav" id="nav">
        <button
          className={page === 'home' ? 'active' : ''}
          onClick={() => navigate('home')}
        >
          <span className="ico">⌂</span>ပင်မ
        </button>
        <button
          className={page === 'learn' ? 'active' : ''}
          onClick={() => navigate('learn')}
        >
          <span className="ico">◉</span>လေ့လာ
        </button>
        <button
          className={page === 'practice' ? 'active' : ''}
          onClick={() => navigate('practice')}
        >
          <span className="ico">✦</span>လေ့ကျင့်
        </button>
        <button
          className={page === 'flash' ? 'active' : ''}
          onClick={() => navigate('flash')}
        >
          <span className="ico">▣</span>ကတ်များ
        </button>
        <button
          className={page === 'settings' ? 'active' : ''}
          onClick={() => navigate('settings')}
        >
          <span className="ico">⚙</span>ချိန်ညှိ
        </button>
      </nav>
    </div>
  );
}
