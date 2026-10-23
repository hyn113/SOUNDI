let STEP_COUNT = 64;
const STORAGE_KEY = 'soundi-v9-archive';
const SUPABASE_URL = 'https://xbkpqoeetjipjirslteq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XXiTr1iiq6HlZIvqXOqS1A_MHpTzf9u';
const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

const SCALE_KEYS = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
const MAX_OCTAVE = 8;
const MIN_OCTAVE = 1;
let highestOctave = MAX_OCTAVE;
let lowestOctave = MIN_OCTAVE;
const NOTE_ORDER = [
  ['si', 'B', 11],
  ['la', 'A', 9],
  ['sol', 'G', 7],
  ['fa', 'F', 5],
  ['mi', 'E', 4],
  ['re', 'D', 2],
  ['do', 'C', 0]
];
const SHARP_KEYS = new Set(['do', 're', 'fa', 'sol', 'la']);
const FLAT_KEYS = new Set(['re', 'mi', 'sol', 'la', 'si']);
const ACCIDENTAL_DRAG_THRESHOLD = 14;
const BPM = 120;
const LOOP_GAP_MS = 0;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.15;
const HARMONY_TYPES = {
  major: { label: { ko: '장3화음', en: 'Major Triad' }, intervals: [4, 7], maxSuggestions: 2, maxNotes: 3 },
  minor: { label: { ko: '단3화음', en: 'Minor Triad' }, intervals: [3, 7], maxSuggestions: 2, maxNotes: 3 },
  suspended: { label: { ko: '서스펜디드 코드', en: 'Suspended Chord' }, intervals: [5, 7], maxSuggestions: 2, maxNotes: 3 },
  fifth: { label: { ko: '완전5도', en: 'Perfect Fifth' }, intervals: [7], maxSuggestions: 1, maxNotes: 2 },
  octave: { label: { ko: '옥타브', en: 'Octave' }, intervals: [12], maxSuggestions: 1, maxNotes: 2 }
};

const TENSION_TYPES = {
  none: { label: { ko: '텐션 끄기', en: 'Tension Off' }, intervals: [] },
  major7: { label: { ko: '장7도', en: 'Major 7' }, intervals: [11] },
  add9: { label: { ko: '부가9도', en: 'Add 9' }, intervals: [14] }
};

const intervalLabels = {
  3: 'minor 3rd',
  4: 'major 3rd',
  5: '4th',
  7: '5th',
  11: 'major 7th',
  12: 'octave',
  14: '9th'
};

const HAPTIC_CHORD_MAP = {
  single: { label: 'Single Note', intensity: 0.40, sharpness: 0.35, pattern: 'sustained' },
  major3: { label: 'Major 3rd', intensity: 0.50, sharpness: 0.35, pattern: 'sustained' },
  minor3: { label: 'Minor 3rd', intensity: 0.45, sharpness: 0.25, pattern: 'sustained' },
  perfect5: { label: 'Perfect 5th', intensity: 0.70, sharpness: 0.30, pattern: 'sustained' },
  sus2: { label: 'Sus2', intensity: 0.58, sharpness: 0.50, pattern: 'slowWave' },
  sus4: { label: 'Sus4', intensity: 0.62, sharpness: 0.60, pattern: 'slowWave' },
  major7: { label: 'Major 7th', intensity: 0.50, sharpness: 0.62, pattern: 'finePulse' },
  strongTension: { label: 'Strong Tension', intensity: 0.70, sharpness: 0.90, pattern: 'densePulse' }
};

const noteColors = {
  do: '#ff3b30',
  re: '#ff7a00',
  mi: '#ffdc21',
  fa: '#00c900',
  sol: '#65d2ee',
  la: '#3f6df6',
  si: '#854cf5'
};

const palettes = {
  bright: {
    name: 'Bright rhythmic tone',
    vars: ['#fff7ad', '#f4f4f4', '#ffffff'],
    marks: ['#ffd92f', '#ff3f55', '#2a8bdc', '#32c6c2'],
    sphere: ['#fff4a5', '#bdf569', '#ffb36f', '#f6f6f6']
  },
  moon: {
    name: 'Slow blue tone',
    vars: ['#dcecff', '#f6f9ff', '#ffffff'],
    marks: ['#6f9fe7', '#a9c8ff', '#d7e7ff', '#5579b9'],
    sphere: ['#dbeaff', '#9dbdff', '#7b75c9', '#f7f8ff']
  },
  warm: {
    name: 'Warm balanced tone',
    vars: ['#fff0dc', '#f7f7f7', '#ffffff'],
    marks: ['#ff9d2e', '#f15b48', '#e7c62f', '#5aa576'],
    sphere: ['#ffe4b8', '#ffb0a7', '#f7d76f', '#f4f4f4']
  },
  sparse: {
    name: 'Quiet sparse tone',
    vars: ['#f6f6f6', '#ffffff', '#eef3f1'],
    marks: ['#c8ddd7', '#f1d7cf', '#90b7a9', '#efe681'],
    sphere: ['#eeeeee', '#d8e6e0', '#f1d7cf', '#ffffff']
  }
};

let notes = buildNotes();
const app = document.querySelector('.app');
const composeView = document.getElementById('composeView');
const scoreGrid = document.getElementById('scoreGrid');
const scoreScroll = document.querySelector('.score-scroll');
const pitchKeyboard = document.getElementById('pitchKeyboard');
const zoomOutButton = document.getElementById('zoomOutButton');
const zoomInButton = document.getElementById('zoomInButton');
const zoomLabel = document.getElementById('zoomLabel');
const resetZoomButton = document.getElementById('resetZoomButton');
const playButton = document.getElementById('playButton');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const volumeControl = document.getElementById('volumeControl');
const volumeButton = document.getElementById('volumeButton');
const volumePopover = document.getElementById('volumePopover');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValueLabel = document.getElementById('volumeValueLabel');
const middleNotesButton = document.getElementById('middleNotesButton');
const guideButton = document.getElementById('guideButton');
const harmonyTypeControl = document.getElementById('harmonyTypeControl');
const harmonyTypeButton = document.getElementById('harmonyTypeButton');
const harmonyTypeMenu = document.getElementById('harmonyTypeMenu');
const tensionControl = document.getElementById('tensionControl');
const tensionButton = document.getElementById('tensionButton');
const tensionMenu = document.getElementById('tensionMenu');
const exampleButton = document.getElementById('exampleButton');
const importExampleButton = document.getElementById('importExampleButton');
const exampleName = document.getElementById('exampleName');
const compositionDuration = document.getElementById('compositionDuration');
const archiveGrid = document.getElementById('archiveGrid');
const coverModal = document.getElementById('coverModal');
const coverPreviewRecord = document.getElementById('coverPreviewRecord');
const coverTitleInput = document.getElementById('coverTitleInput');
const coverCloseButton = document.getElementById('coverCloseButton');
const coverOptionButtons = document.querySelectorAll('[data-cover-type]');
const coverImageInput = document.getElementById('coverImageInput');
const publishCoverButton = document.getElementById('publishCoverButton');
const mySongsPanel = document.getElementById('mySongsPanel');
const mySongsToggle = document.getElementById('mySongsToggle');
const mySongsList = document.getElementById('mySongsList');
const newSongButton = document.getElementById('newSongButton');
const savedSongsTab = document.getElementById('savedSongsTab');
const publishedSongsTab = document.getElementById('publishedSongsTab');
const composePublishButton = document.getElementById('composePublishButton');
const playhead = document.getElementById('playhead');
const gridPlayhead = document.getElementById('gridPlayhead');
const visualStage = document.getElementById('visualStage');
const visualMarks = document.getElementById('visualMarks');
const visualCaption = document.getElementById('visualCaption');
const moodMetrics = document.getElementById('moodMetrics');
const hapticStatusUi = document.querySelector('.haptic-status-ui');
const hapticInfoButton = document.getElementById('hapticInfoButton');
const hapticConnectButton = document.getElementById('hapticConnectButton');
const hapticStatusText = document.getElementById('hapticStatusText');
const hapticInfoPopover = document.getElementById('hapticInfoPopover');
const hapticConnectPopover = document.getElementById('hapticConnectPopover');
const hapticConnectTitle = document.getElementById('hapticConnectTitle');
const hapticConnectMessage = document.getElementById('hapticConnectMessage');
const hapticDeviceRow = document.getElementById('hapticDeviceRow');
const hapticDeviceName = document.getElementById('hapticDeviceName');
const hapticPairingHostInput = document.getElementById('hapticPairingHostInput');
const hapticPairingCodeInput = document.getElementById('hapticPairingCodeInput');
const hapticPairingConnectButton = document.getElementById('hapticPairingConnectButton');
const hapticPairingMessage = document.getElementById('hapticPairingMessage');
const analysisTabs = document.querySelectorAll('[data-analysis-tab]');
const analysisPages = document.querySelectorAll('.analysis-page');
const feedbackCard = document.getElementById('feedbackCard');
const intentPrompt = document.getElementById('intentPrompt');
const intentStyle = document.getElementById('intentStyle');
const intentDirection = document.getElementById('intentDirection');
const aiNativeSelects = [intentStyle, intentDirection].filter(Boolean);
const aiAnalyzeButton = document.getElementById('aiAnalyzeButton');
const intentPromptError = document.getElementById('intentPromptError');
const aiFormMessage = document.getElementById('aiFormMessage');
const aiCoachResult = document.getElementById('aiCoachResult');
const aiCoachSource = document.getElementById('aiCoachSource');
const resizeHandle = document.getElementById('resizeHandle');
const siteHeader = document.querySelector('.site-header');
const lessonView = document.getElementById('lessonView');
const lessonDemo = document.getElementById('lessonDemo');
const lessonRhythmGrid = document.getElementById('lessonRhythmGrid');
const lessonMoodOrb = document.getElementById('lessonMoodOrb');
const lessonMoodText = document.getElementById('lessonMoodText');
const lessonStepLabel = document.getElementById('lessonStepLabel');
const lessonTitle = document.getElementById('lessonTitle');
const lessonText = document.getElementById('lessonText');
const lessonPrevButton = document.getElementById('lessonPrevButton');
const lessonNextButton = document.getElementById('lessonNextButton');
const lessonStartButton = document.getElementById('lessonStartButton');
const lessonTrackButtons = document.querySelectorAll('[data-lesson-track]');
const lessonNoteButtons = document.querySelectorAll('[data-lesson-note]');
const lessonTensionToggle = document.getElementById('lessonTensionToggle');
const languageToggle = document.getElementById('languageToggle');
const revealItems = document.querySelectorAll('.reveal');
const sideTabButton = document.getElementById('sideTabButton');
const sidePanel = document.getElementById('sidePanel');
const closePanelButton = document.getElementById('closePanelButton');
const customCursor = document.getElementById('customCursor');
const loginModal = document.getElementById('loginModal');
const nicknameInput = document.getElementById('nicknameInput');
const loginInputLabel = document.getElementById('loginInputLabel');
const generalUserButton = document.getElementById('generalUserButton');
const adminUserButton = document.getElementById('adminUserButton');
const loginMessage = document.getElementById('loginMessage');
const loginSubmitButton = document.getElementById('loginSubmitButton');
const googleLoginButton = document.getElementById('googleLoginButton');
const adminLoginButton = document.getElementById('adminLoginButton');
const adminLoginPanel = document.getElementById('adminLoginPanel');
const userStatusButton = document.getElementById('userStatusButton');
const userStatusArea = document.getElementById('userStatusArea');
const userStatusName = document.getElementById('userStatusName');
const userMenu = document.getElementById('userMenu');
const userMenuName = document.getElementById('userMenuName');
const userMenuRole = document.getElementById('userMenuRole');
const themeMenuButton = document.getElementById('themeMenuButton');
const currentThemeLabel = document.getElementById('currentThemeLabel');
const themePicker = document.getElementById('themePicker');
const logoutButton = document.getElementById('logoutButton');
const dashboardButton = document.getElementById('dashboardButton');
const dashboardModal = document.getElementById('dashboardModal');
const dashboardOverviewPage = document.getElementById('dashboardOverviewPage');
const dashboardProfilePage = document.getElementById('dashboardProfilePage');
const dashboardNicknameInput = document.getElementById('dashboardNicknameInput');
const dashboardNicknameSaveButton = document.getElementById('dashboardNicknameSaveButton');
const dashboardNicknameStatus = document.getElementById('dashboardNicknameStatus');
const dashboardNicknameNextDate = document.getElementById('dashboardNicknameNextDate');
const dashboardCloseButton = document.getElementById('dashboardCloseButton');
const dashboardRole = document.getElementById('dashboardRole');
const dashboardTitle = document.getElementById('dashboardTitle');
const dashboardStats = document.getElementById('dashboardStats');
const dashboardContent = document.getElementById('dashboardContent');
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmCancelButton = document.getElementById('deleteConfirmCancelButton');
const deleteConfirmDeleteButton = document.getElementById('deleteConfirmDeleteButton');


let composition = [];
let audioContext = null;
let masterGainNode = null;
let archiveAnalyser = null;
let archiveSpectrum = null;
let volumeLevel = 1;
let playTimer = null;
let playStep = 0;
let isPlaying = false;
let isMuted = false;
let isResizing = false;
let volumeAdjustTimer = null;
let cursorHintTimer = null;
let controlHintExitTimer = null;
let activeCursorHintGroup = null;
let scoreHintTarget = null;
let lastPointerX = 0;
let lastPointerY = 0;
let cursorFrame = null;
let cursorHintFrame = null;
let pendingScoreHintEvent = null;
let scoreHintFrame = null;
let archiveItems = loadArchive();
let editingArchiveId = null;
let draftCover = { type: 'block', color: '#ffdc21', image: '' };
let playbackAnalysis = null;
let captionTimer = null;
let captionIndex = 0;
let currentLanguage = 'ko';
let guideEnabled = true;
let harmonyType = 'major';
let tensionType = 'none';
let lastSelectedNoteId = null;
let lastSelectedStep = null;
let currentExampleIndex = 0;
let isExampleMode = false;
let draftComposition = [];
let draftStepCount = STEP_COUNT;
let draftTitle = 'Untitled';
let compositionTitle = 'Untitled';
let undoStack = [];
let gridDragState = null;
let composeZoom = 1;
let hasCenteredComposeOnEntry = false;
let isSectionScrolling = false;
let lessonTrack = 'pitch';
let lessonStep = 0;
let lessonTensionEnabled = true;
let aiCoachStatus = 'idle';
let aiCoachFeedback = null;
let aiAnalyzeLockedUntilEdit = false;
let lessonMoodIndex = 0;
let lessonMoodTimer = null;
let lessonRhythmTimer = null;
let visualCaptionTimer = null;
let lastVisualCaptionText = '';
let selectedLoginRole = 'general';
let currentUser = null;
let currentUserId = null;
let currentSongId = null;
let mySongItems = [];
let mySongsFilter = 'saved';
let selectedMySongIds = new Set();
let lastSelectedMySongIndex = null;
let archivePlayerActive = false;
let archivePausedStep = null;
let playbackGeneration = 0;
let archiveProgressFrame = 0;
let archiveProgressAnchor = 0;
let archiveProgressPosition = 0;
let isArchivePreviewMode = false;
let archivePreviewItemId = null;
let archivePreviewDraft = null;
let isPublishedLocked = false;
let clearHistorySnapshot = null;
let restoringClearFromHistory = false;
let pendingDeleteSongId = null;
const SESSION_VIEW_KEY = 'soundi:lastView';
const SESSION_ANALYSIS_TAB_KEY = 'soundi:lastAnalysisTab';
const LANGUAGE_STORAGE_KEY = 'soundi:language';
const THEME_STORAGE_KEY = 'soundi:theme';
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentThemePreference = document.documentElement.dataset.themePreference || 'system';
const USER_SESSION_KEY = 'soundi:userSession';
const USER_ID_KEY = 'soundi:userId';
const NICKNAME_CHANGE_COOLDOWN_DAYS = 7;
const RESERVED_NICKNAMES = ['관리자', 'admin', 'administrator', 'soundi'];
const COMPOSE_TIME_STORAGE_PREFIX = 'soundi:composeTime:';
const COMPOSE_DAILY_STORAGE_PREFIX = 'soundi:composeDaily:';
let composeTimeStartedAt = null;
const viewNames = ['home', 'lesson', 'compose', 'archive'];
const analysisTabNames = ['visual', 'coach'];

const lessonTrackOrder = ['pitch', 'rhythmLength', 'colorHarmony', 'feedback'];

const aiPromptExamples = {
  ko: [
    '예: 비 오는 날 조용한 피아노 음악',
    '예: 밝고 짧게 움직이는 동요',
    '예: 밤에 듣는 차분한 멜로디',
    '예: 조금 긴장감 있는 OST',
    '예: 따뜻하고 느린 어쿠스틱 곡',
    '예: 가볍고 리듬이 살아있는 음악'
  ],
  en: [
    'e.g. quiet piano music on a rainy day',
    'e.g. a bright short children’s melody',
    'e.g. a calm melody for night',
    'e.g. a slightly tense soundtrack cue',
    'e.g. warm and slow acoustic music',
    'e.g. light music with a clear rhythm'
  ]
};
let lastPromptExample = '';

const lessonTracks = {
  pitch: {
    label: '',
    title: { ko: '색으로 표현한 음계', en: 'Notes Shown in Color' },
    text: {
      ko: '각 계이름은 서로 다른 색으로 표현돼요. 같은 계이름은 옥타브가 달라도 같은 색을 사용해 음의 반복과 흐름을 쉽게 알아볼 수 있어요.',
      en: 'Each note is shown with its own color. The same note name keeps the same color across octaves, making repetition and flow easier to see.'
    }
  },
  colorHarmony: {
    label: '',
    title: { ko: '겹쳐진 음의 조화', en: 'Layered Note Harmony' },
    text: {
      ko: '같은 세로선에 놓인 음은 동시에 연주돼요. 색 조합을 통해 화음의 조화를 확인해보세요.',
      en: 'Notes on the same vertical line play together. Use the color combinations to see how the harmony works.'
    }
  },
  rhythmLength: {
    label: '',
    title: { ko: '길이로 표현한 리듬', en: 'Rhythm Shown by Length' },
    text: {
      ko: '한 블록은 한 박자를 의미해요. 같은 음의 블록이 이어지면 하나의 긴 음이 돼요.',
      en: 'One block means one beat. When blocks of the same note continue, they become one long note.'
    }
  },
  feedback: {
    label: '',
    title: { ko: '곡의 분위기', en: 'Song Mood' },
    text: {
      ko: '완성된 곡의 분위기는 색과 움직임으로 표현돼요. 완성된 곡이 어떤 분위기인지 분석해 한눈에 보여줘요.',
      en: 'A finished song mood is expressed through color and movement. The analysis shows the overall atmosphere at a glance.'
    }
  }
};

const lessonRhythmRows = [
  {
    id: 'short',
    label: { ko: '짧은 음', en: 'Short notes' },
    noteId: 're4',
    beatCount: 12,
    blocks: [
      { start: 1, length: 1 },
      { start: 3, length: 1 },
      { start: 5, length: 1 },
      { start: 7, length: 1 },
      { start: 9, length: 1 },
      { start: 11, length: 1 }
    ]
  },
  {
    id: 'mixed',
    label: { ko: '긴 음', en: 'Long notes' },
    noteId: 'si3',
    beatCount: 12,
    blocks: [
      { start: 1, length: 3 },
      { start: 5, length: 3 },
      { start: 9, length: 3 }
    ]
  }
];

const lessonMoodStates = [
  {
    className: 'mood-bright',
    colors: ['#fff4a5', '#bdf569', '#ffb36f'],
    text: { ko: '밝고 가볍게 움직이는 분위기예요.', en: 'A bright, light-moving mood.' }
  },
  {
    className: 'mood-calm',
    colors: ['#dbeaff', '#9dbdff', '#7b75c9'],
    text: { ko: '차분하고 여백이 느껴지는 분위기예요.', en: 'A calm mood with open space.' }
  },
  {
    className: 'mood-warm',
    colors: ['#ffe4b8', '#ffb0a7', '#f7d76f'],
    text: { ko: '따뜻하고 부드럽게 이어지는 분위기예요.', en: 'A warm mood that flows softly.' }
  },
  {
    className: 'mood-tense',
    colors: ['#ff7600', '#65d2ee', '#854cf5'],
    text: { ko: '색 대비가 강해 조금 긴장감 있는 분위기예요.', en: 'Strong color contrast gives it a slightly tense mood.' }
  }
];

const translations = {
  ko: {
    navLesson: '레슨',
    navCompose: '작곡',
    navArchive: '아카이브',
    archiveEmpty: '아직 저장된 곡이 없어요.',
    guideButton: '화음 가이드',
    harmonyMajor: '장3화음',
    harmonyMinor: '단3화음',
    harmonySuspended: '서스펜디드 코드',
    harmonyFifth: '완전5도',
    harmonyOctave: '옥타브',
    tensionNone: '텐션 끄기',
    tensionMajor7: '장7도',
    tensionAdd9: '부가9도',
    examplesButton: '예시곡',
    lessonPitchNav: '01 색으로 표현한 음계',
    lessonColorHarmonyNav: '03 겹쳐진 음의 조화',
    lessonRhythmLengthNav: '02 길이로 표현한 리듬',
    lessonFeedbackNav: '04 곡의 분위기',
    homeReadyButton: '작곡하러 가기',
    lessonStart: '작곡 시작하기',
    lessonMajorCard: '안정적인 색 조합',
    lessonMinorCard: '가깝고 차분한 조합',
    lessonTensionCard: '대비가 큰 조합',
    lessonTensionToggleOff: '텐션 OFF',
    lessonTensionToggleOn: '텐션 ON',
    lessonHarmonyMajorName: '장3화음',
    lessonHarmonyMajorDesc: '도·미·솔처럼 세 음을 같은 위치에 함께 놓아보세요. 이렇게 여러 음을 동시에 겹쳐 사용하는 것을 ‘화음’이라고 해요. 어떤 음을 함께 사용하느냐에 따라 화음의 분위기도 달라져요. 도·미·솔처럼 세 음이 안정적으로 어우러지는 조합을 ‘장3화음’이라고 하며, 보통 밝고 편안한 분위기를 표현할 때 사용해요.',
    lessonHarmonyMinorName: '단3화음',
    lessonHarmonyMinorDesc: '레·파·라 세 음을 함께 놓아 만든 화음이에요. 장3화음과 마찬가지로 세 음을 사용하지만, 함께 사용하는 음이 달라지면 만들어지는 분위기도 달라져요. 장3화음이 밝은 분위기와 자주 연결된다면, 단3화음은 차분하거나 어두운 분위기를 표현할 때 자주 사용해요.',
    lessonHarmonySuspendedName: '서스펜디드',
    lessonHarmonySuspendedDesc: '미·라·시 세 음을 함께 놓아 만든 화음이에요. 밝거나 어두운 분위기 어느 한쪽으로 쉽게 정해지지 않는 것이 특징이에요. 무언가 아직 끝나지 않은 듯한 긴장감이나 다음으로 이어지는 느낌을 표현할 때 사용할 수 있어요.',
    lessonHarmonyFifthName: '완전5도',
    lessonHarmonyFifthDesc: '파·도처럼 두 음을 함께 놓아 만든 가장 단순한 조합이에요. 밝음과 어두움 어느 한쪽의 성격이 강하지 않고, 단단하고 열린 분위기를 만들 수 있어요. 이렇게 두 음이 일정한 간격으로 떨어져 있는 관계를 음악에서는 ‘완전5도’라고 해요.',
    lessonTensionHeading: '텐션',
    lessonTensionDesc: '텐션은 기본 화음에 한 음을 더해 분위기를 바꾸는 방법이에요.',
    lessonMajor7Name: '장7도',
    lessonMajor7Desc: '솔·시·레 세 음에 파♯을 하나 더 겹쳐 만든 화음이에요. 기본적인 세 음의 조화에 새로운 음 하나가 더해지면서 조금 더 복잡하고 섬세한 분위기를 만들어요. 이렇게 네 음을 쌓은 조합을 ‘장7도 화음’이라고 해요.',
    lessonAdd9Name: '부가9도',
    lessonAdd9Desc: '라·도♯·미 세 음에 높은 시를 하나 더 겹쳐 만든 화음이에요. 기본이 되는 세 음은 그대로 유지하면서 새로운 음 하나를 더하기 때문에, 기존의 분위기를 크게 바꾸지 않고 더 넓고 풍부한 조화를 만들 수 있어요. 이런 화음을 ‘부가9도 화음’이라고 해요.',
    lessonFeedbackDemo: '시각 피드백은 내 음악의 구조를 읽어줘요.',
    analysisVisualTab: '시각적 피드백',
    analysisAiTab: 'With AI',
    hapticInfoTitle: '햅틱으로 음악을 느껴보세요.',
    hapticInfoBody: '음악을 재생하면 리듬과 화음을 햅틱으로 함께 느낄 수 있어요.',
    hapticConnectTitle: '기기를 연결해주세요.',
    hapticConnectBody: 'iPhone에서 Soundi App을 실행하면 같은 네트워크의 기기를 자동으로 찾아요.',
    importExampleButton: '내 곡으로 가져오기',
    aiPromptLabel: '만들고 싶은 곡',
    aiPromptPlaceholder: '예: 비 오는 날 조용한 피아노 음악',
    aiStyleLabel: '음악 스타일',
    aiDirectionLabel: '수정 방향',
    aiAnalyzeButton: '분석하기',
    metricPitch: '음높이 범위',
    metricPitchValue: '음높이 - 균형',
    metricRhythm: '리듬 밀도',
    metricRhythmValue: '리듬 - 보통',
    myWorks: '저장된 곡', savedSongs: '저장된 곡', publishedSongs: '게시된 곡', pairingCode: '연결 코드',
    connectButton: '연결', pairingHelp: 'iPhone의 Wi-Fi IP와 앱에 표시된 6자리 코드를 입력하세요.',
    logout: '로그아웃', overview: '개요', nickname: '닉네임', changeNickname: '변경',
    nicknameHelp: '닉네임은 2~12자이며, 다른 사용자와 중복될 수 없어요.', nicknamePolicy: '닉네임 정책',
    nicknamePolicyUnique: '닉네임은 중복 사용할 수 없어요.', nicknamePolicyCooldown: '변경 후 7일 동안 다시 변경할 수 없어요.',
    nicknamePolicyArchive: '변경하면 Archive의 기존 게시곡에도 새 닉네임이 반영돼요.',
    nicknamePolicyReserved: '관리자, admin, administrator, soundi는 닉네임으로 사용할 수 없어요.',
    deleteSongTitle: '곡을 삭제할까요?', deleteWarning: '이 작업은 되돌릴 수 없어요.', cancel: '취소', delete: '삭제', publish: '게시하기', publishedStatus: '게시됨',
    roleAdmin: '관리자', roleGeneral: '일반 사용자', mySongsGeneralOnly: '일반 사용자 계정에서 사용할 수 있어요.',
    noPublishedSongs: '아직 게시한 곡이 없어요.', noSavedSongs: '아직 저장한 곡이 없어요.', moreSong: '곡 더보기',
    unpublish: '게시 취소', duplicate: '복제', deleteQuestion: '삭제할까요?', view: '보기', guest: '게스트',
    pairingInvalid: '6자리 연결 코드를 입력해주세요.', pairingConnecting: 'iPhone에 연결하고 있어요…',
    pairingConnected: 'iPhone과 연결했어요.', pairingFailed: '연결하지 못했어요. IP와 같은 Wi-Fi를 확인해주세요.',
    middle: '중간', dashboardSubtitle: 'Soundi의 이용 현황을 한눈에 확인하세요.',
    loginDescription: 'Google 계정으로 간편하게 시작하세요.', continueGoogle: 'Google로 계속하기', admin: '관리자',
    adminLogin: '관리자 로그인', adminPassword: '관리자 비밀번호', passwordPlaceholder: '비밀번호 입력', login: '로그인', scrollHint: '아래로<br />스크롤해 주세요'
  },
  en: {
    navLesson: 'Lesson',
    navCompose: 'Compose',
    navArchive: 'Archive',
    archiveEmpty: 'No saved compositions yet.',
    guideButton: 'Harmony Guide',
    harmonyMajor: 'Major Triad',
    harmonyMinor: 'Minor Triad',
    harmonySuspended: 'Suspended Chord',
    harmonyFifth: 'Perfect Fifth',
    harmonyOctave: 'Octave',
    tensionNone: 'Tension Off',
    tensionMajor7: 'Major 7',
    tensionAdd9: 'Add 9',
    examplesButton: 'Examples',
    lessonPitchNav: '01 Notes Shown in Color',
    lessonColorHarmonyNav: '03 Layered Note Harmony',
    lessonRhythmLengthNav: '02 Rhythm Shown by Length',
    lessonFeedbackNav: '04 Song Mood',
    homeReadyButton: 'Ready to compose?',
    lessonStart: 'Start composing',
    lessonMajorCard: 'Stable color set',
    lessonMinorCard: 'Close, darker set',
    lessonTensionCard: 'More contrast',
    lessonTensionToggleOff: 'Tension OFF',
    lessonTensionToggleOn: 'Tension ON',
    lessonHarmonyMajorName: 'Major Triad',
    lessonHarmonyMajorDesc: 'Place C, E, and G together in the same position. When several notes are layered at the same time, they form what musicians call a “chord.” Different combinations of notes can create different moods. C, E, and G form a major triad, a combination often used to create a bright and comfortable mood.',
    lessonHarmonyMinorName: 'Minor Triad',
    lessonHarmonyMinorDesc: 'Place D, F, and A together to make this chord. Like a major triad, it uses three notes, but changing which notes are combined can change the mood. While major triads are often connected with brighter moods, minor triads are often used for calmer or darker moods.',
    lessonHarmonySuspendedName: 'Suspended',
    lessonHarmonySuspendedDesc: 'Place E, A, and B together to make this chord. Its character does not settle clearly into a bright or dark mood. It can create a sense of tension, as if something is not finished yet or is about to continue into the next chord.',
    lessonHarmonyFifthName: 'Perfect Fifth',
    lessonHarmonyFifthDesc: 'Place F and C together to make this simple two-note combination. It does not strongly lean toward either a bright or dark character, and can create a strong, open mood. Musicians call this particular relationship between two notes a “perfect fifth.”',
    lessonTensionHeading: 'Tension',
    lessonTensionDesc: 'Tension adds one note to a basic chord and changes its mood.',
    lessonMajor7Name: 'Major 7th',
    lessonMajor7Desc: 'Add F♯ to G, B, and D to create a four-note chord. Adding one new note to the basic three-note combination creates a more complex and delicate mood. This combination is called a “major seventh chord.”',
    lessonAdd9Name: 'Add 9',
    lessonAdd9Desc: 'Add a higher B to A, C♯, and E to create this four-note chord. The original three-note combination stays in place while one new note is added, creating a wider and richer harmony without greatly changing its basic character. This is called an “add9 chord.”',
    lessonFeedbackDemo: 'Visual feedback reads your composition structure.',
    analysisVisualTab: 'Visual Feedback',
    analysisAiTab: 'With AI',
    hapticInfoTitle: 'Feel music through haptics.',
    hapticInfoBody: 'When you play your music, rhythm and harmony can be felt through haptic feedback.',
    hapticConnectTitle: 'Connect a device.',
    hapticConnectBody: 'Open the Soundi App on your iPhone and Soundi will find it automatically on the same network.',
    importExampleButton: 'Import to my song',
    aiPromptLabel: 'What you want to make',
    aiPromptPlaceholder: 'e.g. quiet piano music on a rainy day',
    aiStyleLabel: 'Music style',
    aiDirectionLabel: 'Edit direction',
    aiAnalyzeButton: 'Analyze',
    metricPitch: 'Pitch Range',
    metricPitchValue: 'Pitch - Balanced',
    metricRhythm: 'Rhythm Density',
    metricRhythmValue: 'Rhythm - Moderate',
    myWorks: 'My Works', savedSongs: 'Saved', publishedSongs: 'Published', pairingCode: 'Connection code',
    connectButton: 'Connect', pairingHelp: 'Enter your iPhone Wi-Fi IP and the 6-digit code shown in the app.',
    logout: 'Log out', overview: 'Overview', nickname: 'Nickname', changeNickname: 'Change',
    nicknameHelp: 'Use 2–12 characters. Nicknames must be unique.', nicknamePolicy: 'Nickname policy',
    nicknamePolicyUnique: 'Each nickname must be unique.', nicknamePolicyCooldown: 'You can change your nickname once every 7 days.',
    nicknamePolicyArchive: 'Your new nickname will also appear on existing published songs in Archive.',
    nicknamePolicyReserved: '관리자, admin, administrator, and soundi cannot be used as nicknames.',
    deleteSongTitle: 'Delete this song?', deleteWarning: 'This action cannot be undone.', cancel: 'Cancel', delete: 'Delete', publish: 'Post', publishedStatus: 'Published',
    roleAdmin: 'Administrator', roleGeneral: 'User', mySongsGeneralOnly: 'Available with a standard user account.',
    noPublishedSongs: 'No published songs yet.', noSavedSongs: 'No saved songs yet.', moreSong: 'More song actions',
    unpublish: 'Unpublish', duplicate: 'Duplicate', deleteQuestion: 'Delete this song?', view: 'View', guest: 'Guest',
    pairingInvalid: 'Enter the 6-digit connection code.', pairingConnecting: 'Connecting to your iPhone…',
    pairingConnected: 'Connected to your iPhone.', pairingFailed: 'Could not connect. Check the IP address and Wi-Fi network.',
    middle: 'Middle', dashboardSubtitle: 'See Soundi usage at a glance.',
    loginDescription: 'Get started with your Google account.', continueGoogle: 'Continue with Google', admin: 'Administrator',
    adminLogin: 'Administrator login', adminPassword: 'Administrator password', passwordPlaceholder: 'Enter password', login: 'Log in', scrollHint: 'please<br />scroll'
  }
};

function translate(key) {
  return translations[currentLanguage]?.[key] ?? translations.en?.[key] ?? key;
}

const controlIcons = {
  play: '<svg class="is-fill-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M17 12L32 22L17 32Z"></path></svg>',
  pause: '<svg class="is-fill-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M15 13H20V31H15Z"></path><path d="M24 13H29V31H24Z"></path></svg>',
  prev: '<svg class="is-fill-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M14 12H18V32H14Z"></path><path d="M32 12L18 22L32 32Z"></path></svg>',
  next: '<svg class="is-fill-icon" viewBox="0 0 44 44" aria-hidden="true"><path d="M26 12H30V32H26Z"></path><path d="M12 12L26 22L12 32Z"></path></svg>',
  save: '<svg viewBox="0 0 44 44" aria-hidden="true"><path d="M22 10V28"></path><path d="M14 20L22 28L30 20"></path><path d="M13 34H31"></path></svg>',
  clear: '<svg viewBox="0 0 44 44" aria-hidden="true"><path d="M32 22C32 27.5 27.5 32 22 32C16.5 32 12 27.5 12 22C12 16.5 16.5 12 22 12C25.1 12 27.9 13.4 29.7 15.7"></path><path d="M31 10V17H24"></path></svg>',
  volume: '<svg viewBox="0 0 44 44" aria-hidden="true"><path d="M13 18H18L25 12V32L18 26H13V18Z"></path><path d="M29 18.5C30.2 20.1 30.2 23.9 29 25.5"></path><path d="M32.5 15C35.3 18.5 35.3 25.5 32.5 29"></path></svg>',
  muted: '<svg viewBox="0 0 44 44" aria-hidden="true"><path d="M13 18H18L25 12V32L18 26H13V18Z"></path><path d="M30 18L36 24"></path><path d="M36 18L30 24"></path></svg>'
};

const exampleCompositions = [
  {
    title: 'Twinkle Twinkle Little Star',
    mood: 'Bright / Simple / Familiar',
    point: 'Repetition and basic melody structure',
    notes: [
      ['do4', 0, 2], ['do4', 2, 2], ['sol4', 4, 2], ['sol4', 6, 2],
      ['la4', 8, 2], ['la4', 10, 2], ['sol4', 12, 4],
      ['fa4', 16, 2], ['fa4', 18, 2], ['mi4', 20, 2], ['mi4', 22, 2],
      ['re4', 24, 2], ['re4', 26, 2], ['do4', 28, 4],
      ['sol4', 32, 2], ['sol4', 34, 2], ['fa4', 36, 2], ['fa4', 38, 2],
      ['mi4', 40, 2], ['mi4', 42, 2], ['re4', 44, 4],
      ['sol4', 48, 2], ['sol4', 50, 2], ['fa4', 52, 2], ['fa4', 54, 2],
      ['mi4', 56, 2], ['mi4', 58, 2], ['re4', 60, 4],
      ['do4', 64, 2], ['do4', 66, 2], ['sol4', 68, 2], ['sol4', 70, 2],
      ['la4', 72, 2], ['la4', 74, 2], ['sol4', 76, 4],
      ['fa4', 80, 2], ['fa4', 82, 2], ['mi4', 84, 2], ['mi4', 86, 2],
      ['re4', 88, 2], ['re4', 90, 2], ['do4', 92, 4]
    ]
  },
  {
    title: 'Happy Birthday to You',
    mood: 'Cheerful / Celebratory',
    point: 'Short melody with a clear emotional rise',
    notes: [
      ['sol4', 0, 1], ['sol4', 1, 1], ['la4', 2, 2], ['sol4', 4, 2], ['do5', 6, 2], ['si4', 8, 4],
      ['sol4', 12, 1], ['sol4', 13, 1], ['la4', 14, 2], ['sol4', 16, 2], ['re5', 18, 2], ['do5', 20, 4],
      ['sol4', 24, 1], ['sol4', 25, 1], ['sol5', 26, 2], ['mi5', 28, 2], ['do5', 30, 2], ['si4', 32, 2], ['la4', 34, 4],
      ['fa5', 38, 1], ['fa5', 39, 1], ['mi5', 40, 2], ['do5', 42, 2], ['re5', 44, 2], ['do5', 46, 4],
      ['do3', 0, 6], ['sol3', 6, 6], ['do3', 12, 6], ['sol3', 18, 6],
      ['do3', 24, 6], ['mi3', 30, 6], ['fa3', 36, 6], ['sol3', 42, 8],
      ['mi3', 6, 4], ['sol3', 6, 4], ['mi3', 18, 4], ['sol3', 18, 4],
      ['do4', 30, 4], ['sol3', 42, 4], ['si3', 42, 4]
    ]
  },
  {
    title: 'Ode to Joy',
    mood: 'Grand / Stable / Classical',
    point: 'Stepwise melodic movement',
    notes: [
      ['mi4', 0, 2], ['mi4', 2, 2], ['fa4', 4, 2], ['sol4', 6, 2],
      ['sol4', 8, 2], ['fa4', 10, 2], ['mi4', 12, 2], ['re4', 14, 2],
      ['do4', 16, 2], ['do4', 18, 2], ['re4', 20, 2], ['mi4', 22, 2],
      ['mi4', 24, 3], ['re4', 27, 1], ['re4', 28, 4],
      ['mi4', 32, 2], ['mi4', 34, 2], ['fa4', 36, 2], ['sol4', 38, 2],
      ['sol4', 40, 2], ['fa4', 42, 2], ['mi4', 44, 2], ['re4', 46, 2],
      ['do4', 48, 2], ['do4', 50, 2], ['re4', 52, 2], ['mi4', 54, 2],
      ['re4', 56, 3], ['do4', 59, 1], ['do4', 60, 4],
      ['do3', 0, 8], ['sol3', 8, 8], ['do3', 16, 8], ['sol3', 24, 8],
      ['do3', 32, 8], ['sol3', 40, 8], ['do3', 48, 8], ['do3', 56, 8],
      ['mi3', 0, 4], ['sol3', 0, 4], ['mi3', 16, 4], ['sol3', 16, 4],
      ['mi3', 48, 4], ['sol3', 48, 4], ['mi3', 56, 4], ['sol3', 56, 4]
    ]
  },
  {
    title: 'The Entertainer',
    mood: 'Playful / Rhythmic / Bouncy',
    point: 'Syncopated rhythm and lively motion',
    notes: [
      ['re5', 0, 1], ['mi4', 1, 1], ['mi4', 2, 1], ['do5', 4, 1], ['mi4', 6, 1], ['do5', 8, 1], ['mi4', 10, 1], ['do5', 12, 2],
      ['do5', 16, 1], ['re5', 18, 1], ['mi5', 20, 1], ['mi5', 22, 2], ['do5', 25, 1], ['re5', 27, 1], ['mi5', 29, 1], ['si4', 31, 2],
      ['re5', 34, 1], ['do5', 36, 1], ['mi4', 38, 1], ['do5', 40, 1], ['mi4', 42, 1], ['do5', 44, 2],
      ['la4', 48, 1], ['si4', 50, 1], ['do5', 52, 1], ['re5', 54, 1], ['mi5', 56, 2], ['do5', 60, 4],
      ['do3', 0, 2], ['sol3', 2, 2], ['do3', 4, 2], ['sol3', 6, 2], ['do3', 8, 2], ['sol3', 10, 2], ['do3', 12, 4],
      ['fa3', 16, 2], ['do4', 18, 2], ['fa3', 20, 2], ['do4', 22, 2], ['sol3', 24, 2], ['re4', 26, 2], ['sol3', 28, 4],
      ['do3', 34, 2], ['sol3', 36, 2], ['mi3', 38, 2], ['sol3', 40, 2], ['do3', 42, 2], ['sol3', 44, 4],
      ['fa3', 48, 2], ['do4', 50, 2], ['sol3', 52, 2], ['re4', 54, 2], ['do3', 56, 8]
    ]
  },
  {
    title: 'Greensleeves',
    mood: 'Calm / Emotional / Old folk',
    point: 'Long notes and lyrical melody',
    notes: [
      ['la4', 0, 2], ['do5', 2, 3], ['re5', 5, 1], ['mi5', 6, 2], ['fa5', 8, 3], ['mi5', 11, 1], ['re5', 12, 2], ['si4', 14, 4],
      ['sol4', 18, 2], ['la4', 20, 3], ['si4', 23, 1], ['do5', 24, 2], ['la4', 26, 4],
      ['la4', 32, 2], ['do5', 34, 3], ['re5', 37, 1], ['mi5', 38, 2], ['fa5', 40, 3], ['mi5', 43, 1], ['re5', 44, 2], ['si4', 46, 4],
      ['sol4', 50, 2], ['la4', 52, 3], ['si4', 55, 1], ['do5', 56, 2], ['la4', 58, 6],
      ['la3', 0, 8], ['mi3', 8, 8], ['sol3', 16, 8], ['la3', 24, 8],
      ['la3', 32, 8], ['mi3', 40, 8], ['sol3', 48, 8], ['la3', 56, 8],
      ['do4', 0, 4], ['mi4', 0, 4], ['si3', 16, 4], ['re4', 16, 4],
      ['do4', 32, 4], ['mi4', 32, 4], ['do4', 56, 4], ['mi4', 56, 4]
    ]
  }
];


function createUserId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function loadOrCreateUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = createUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function loadUserSession() {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.nickname || !['general', 'admin'].includes(parsed.role)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveUserSession(user) {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
}

function updateUserStatus() {
  if (!currentUser) return;
  if (userStatusArea) userStatusArea.hidden = false;
  if (userStatusName) userStatusName.textContent = currentUser.nickname;
  if (userMenuName) userMenuName.textContent = currentUser.nickname;
  if (userMenuRole) {
    userMenuRole.textContent = currentUser.role === 'admin' ? translate('roleAdmin') : translate('roleGeneral');
  }
}

function closeLoginModal() {
  if (!loginModal) return;
  loginModal.hidden = true;
  loginModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-login-open');
  window.setTimeout(() => {
    setCursorHintText(translate('scrollHint'));
    updateCursorHint();
  }, 0);
}

function openLoginModal() {
  if (!loginModal) return;
  loginModal.hidden = false;
  loginModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-login-open');
  requestAnimationFrame(() => nicknameInput?.focus());
}

function setLoginRole(role) {
  selectedLoginRole = role === 'admin' ? 'admin' : 'general';
  const isAdmin = selectedLoginRole === 'admin';

  if (adminLoginPanel) adminLoginPanel.hidden = !isAdmin;
  if (nicknameInput) {
    nicknameInput.value = '';
    nicknameInput.type = 'password';
    nicknameInput.inputMode = 'numeric';
    nicknameInput.maxLength = 4;
    nicknameInput.placeholder = '비밀번호 입력';
  }
  if (loginInputLabel) loginInputLabel.textContent = '관리자 비밀번호';
  if (loginMessage) loginMessage.textContent = '';

  if (isAdmin) requestAnimationFrame(() => nicknameInput?.focus());
}

async function submitLogin() {
  if (selectedLoginRole !== 'admin') return;

  const inputValue = String(nicknameInput?.value || '').trim();

  if (!inputValue) {
    if (loginMessage) loginMessage.textContent = currentLanguage === 'en'
      ? 'Enter the administrator password.'
      : '관리자 비밀번호를 입력해주세요.';
    nicknameInput?.focus();
    return;
  }

  // The exhibition admin password is intentionally fixed in the client as well,
  // so login is never blocked by a stale/deployed server environment variable.
  if (inputValue !== '1021') {
    if (loginMessage) loginMessage.textContent = currentLanguage === 'en'
      ? 'The administrator password is incorrect.'
      : '관리자 비밀번호가 올바르지 않아요.';
    nicknameInput?.focus();
    nicknameInput?.select();
    return;
  }

  if (loginSubmitButton) loginSubmitButton.disabled = true;

  // Get a server admin token when the current server supports it. A stale or
  // static server must not prevent entering the administrator UI.
  let adminToken = '';
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: inputValue })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.token) adminToken = String(data.token);
  } catch (error) {
    console.warn('[Soundi] Admin token endpoint is unavailable; continuing with local admin login.');
  } finally {
    if (loginSubmitButton) loginSubmitButton.disabled = false;
  }

  currentUserId = 'admin';
  currentUser = {
    nickname: currentLanguage === 'en' ? 'Administrator' : '관리자',
    role: 'admin',
    userId: 'admin',
    adminToken
  };

  saveUserSession(currentUser);
  updateUserStatus();
  renderArchive();
  closeLoginModal();
  loadMySongs();

  // After login, restore the home scroll cue instead of leaving the login greeting.
  window.setTimeout(() => {
    setCursorHintText(translate('scrollHint'));
    updateCursorHint();
  }, 0);
}

async function signInWithGoogle() {
  if (!supabaseClient) {
    if (loginMessage) loginMessage.textContent = '로그인 연결을 불러오지 못했어요.';
    return;
  }

  if (loginMessage) loginMessage.textContent = '';

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo,
        queryParams: {
          prompt: 'select_account'
        }
      }
  });

  if (error) {
    console.error('[Soundi Auth] Google login failed', error);
    if (loginMessage) loginMessage.textContent = 'Google 로그인을 시작하지 못했어요.';
  }
}

async function applySupabaseUserSession(session) {
  const authUser = session?.user;
  if (!authUser) return false;

  const nickname = String(
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split('@')[0] ||
    'Soundi User'
  ).trim();

  currentUserId = authUser.id;
  currentUser = {
    nickname,
    role: 'general',
    userId: authUser.id,
    email: authUser.email || ''
  };

  saveUserSession(currentUser);
  updateUserStatus();
  renderArchive();
  closeLoginModal();
  await loadMySongs();
  await recordSiteVisit();
  if (document.body.dataset.view === 'compose') startComposeTimeTracking();
  return true;
}

async function initializeAuthSession() {
  if (!supabaseClient) {
    openLoginModal();
    return;
  }

  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.warn('[Soundi Auth] Session restore failed', error);
  }

  if (await applySupabaseUserSession(session)) return;

  const saved = loadUserSession();
  if (saved?.role === 'admin' && saved.adminToken) {
    currentUser = saved;
    currentUserId = 'admin';
    updateUserStatus();
    closeLoginModal();
    return;
  }

  if (saved?.role === 'admin') {
    localStorage.removeItem(USER_SESSION_KEY);
  }

  currentUser = null;
  currentUserId = null;
  openLoginModal();
}

googleLoginButton?.addEventListener('click', signInWithGoogle);
adminLoginButton?.addEventListener('click', () => setLoginRole('admin'));
loginSubmitButton?.addEventListener('click', submitLogin);

nicknameInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') submitLogin();
});


userStatusButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = Boolean(userMenu?.hidden);
  if (userMenu) userMenu.hidden = !willOpen;
  if (!willOpen && themePicker) themePicker.hidden = true;
  userStatusButton.setAttribute('aria-expanded', String(willOpen));
  themeMenuButton?.setAttribute('aria-expanded', 'false');
});

userMenu?.addEventListener('click', (event) => {
  event.stopPropagation();
});

themeMenuButton?.addEventListener('click', () => {
  const willOpen = Boolean(themePicker?.hidden);
  if (themePicker) themePicker.hidden = !willOpen;
  themeMenuButton.setAttribute('aria-expanded', String(willOpen));
});

document.addEventListener('click', (event) => {
  if (matchMedia('(width < 640px)').matches && event.target.closest('.site-header')) return;
  if (userMenu) userMenu.hidden = true;
  if (themePicker) themePicker.hidden = true;
  userStatusButton?.setAttribute('aria-expanded', 'false');
  themeMenuButton?.setAttribute('aria-expanded', 'false');
});

document.addEventListener('click', (event) => {
  if (!mySongsList || mySongsList.contains(event.target)) return;
  mySongsList.querySelectorAll('.my-song-more-menu').forEach((menu) => {
    menu.hidden = true;
  });
  mySongsList.querySelectorAll('[data-more-my-song]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('click', (event) => {
  if (!mySongsList) return;
  const wrap = event.target.closest?.('.my-song-more-wrap');
  if (wrap) return;

  mySongsList.querySelectorAll('.my-song-more-menu').forEach((menu) => {
    menu.hidden = true;
  });
  mySongsList.querySelectorAll('.my-song-delete-popover').forEach((popover) => {
    popover.hidden = true;
  });
  mySongsList.querySelectorAll('[data-more-my-song]').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
  });
});

function getCurrentUserSongs() {
  if (!currentUser || currentUser.role !== 'general') return [];
  return mySongItems.filter((item) =>
    item.ownerId &&
    item.ownerId === currentUserId &&
    item.status !== 'deleted'
  );
}

function getTotalBlockCount(items) {
  return items.reduce((sum, item) => sum + (Array.isArray(item.composition) ? item.composition.length : 0), 0);
}

function getComposeTimeStorageKey() {
  return currentUserId ? `${COMPOSE_TIME_STORAGE_PREFIX}${currentUserId}` : null;
}

function getStoredComposeSeconds() {
  const key = getComposeTimeStorageKey();
  if (!key) return 0;
  const value = Number(localStorage.getItem(key) || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function startComposeTimeTracking() {
  if (composeTimeStartedAt || currentUser?.role !== 'general' || document.hidden || document.body.dataset.view !== 'compose') return;
  composeTimeStartedAt = Date.now();
}

function stopComposeTimeTracking() {
  if (!composeTimeStartedAt || currentUser?.role !== 'general') {
    composeTimeStartedAt = null;
    return;
  }

  const endedAt = Date.now();
  const elapsedSeconds = Math.max(0, Math.round((endedAt - composeTimeStartedAt) / 1000));
  composeTimeStartedAt = null;

  const key = getComposeTimeStorageKey();
  if (key && elapsedSeconds) {
    localStorage.setItem(key, String(getStoredComposeSeconds() + elapsedSeconds));
  }

  if (!currentUserId || !elapsedSeconds) return;
  const dateKey = new Date(endedAt).toLocaleDateString('en-CA');
  const dailyKey = `${COMPOSE_DAILY_STORAGE_PREFIX}${currentUserId}`;
  let daily = {};
  try {
    daily = JSON.parse(localStorage.getItem(dailyKey) || '{}') || {};
  } catch (error) {
    daily = {};
  }
  daily[dateKey] = Math.max(0, Number(daily[dateKey] || 0)) + elapsedSeconds;
  localStorage.setItem(dailyKey, JSON.stringify(daily));
}

function getCurrentComposeSeconds() {
  const activeSeconds = composeTimeStartedAt ? Math.max(0, Math.round((Date.now() - composeTimeStartedAt) / 1000)) : 0;
  return getStoredComposeSeconds() + activeSeconds;
}

function getDailyComposeUsage() {
  if (!currentUserId) return {};
  const dailyKey = `${COMPOSE_DAILY_STORAGE_PREFIX}${currentUserId}`;
  try {
    const parsed = JSON.parse(localStorage.getItem(dailyKey) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function buildComposeActivityHeatmap(days = 336) {
  const usage = getDailyComposeUsage();
  const today = new Date();
  const values = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - index);
    const key = date.toLocaleDateString('en-CA');
    values.push({
      date,
      seconds: Math.max(0, Number(usage[key] || 0))
    });
  }

  const max = Math.max(1, ...values.map((item) => item.seconds));

  return values.map(({ date, seconds }) => {
    const level = seconds <= 0
      ? 0
      : Math.max(1, Math.min(4, Math.ceil((seconds / max) * 4)));

    const dateLabel = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `<span
      class="dashboard-activity-cell level-${level}"
      data-tooltip-title="${dateLabel}"
      data-tooltip-detail="작곡 시간 · ${formatDashboardDuration(seconds)}"
      aria-label="${dateLabel} · 작곡 시간 ${formatDashboardDuration(seconds)}"
    ></span>`;
  }).join('');
}


function buildComposeActivityMonths(days = 364) {
  const today = new Date();
  const labels = Array.from({ length: 12 }, () => '');
  for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const slot = 11 - monthOffset;
    labels[slot] = `${date.getMonth() + 1}월`;
  }
  return labels.map((label) => `<span>${label}</span>`).join('');
}

function buildComposeActivityLabels(mode = 'daily') {
  return buildComposeActivityMonths();
}


function buildWeeklyComposeActivity() {
  const usage = getDailyComposeUsage();
  const today = new Date();
  const groups = [];

  for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1, 12, 0, 0, 0);
    const year = firstDay.getFullYear();
    const month = firstDay.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const ranges = [
      [1, 7],
      [8, 14],
      [15, 21],
      [22, daysInMonth]
    ];

    ranges.forEach(([startDay, endDay], weekIndex) => {
      const dailyItems = [];
      let total = 0;

      for (let row = 0; row < 7; row += 1) {
        let day = startDay + row;

        // In the last week column, fold any remaining days into the 7 visible rows.
        if (weekIndex === 3 && row === 6 && endDay > 28) {
          let mergedSeconds = 0;
          for (let mergedDay = 28; mergedDay <= endDay; mergedDay += 1) {
            const mergedDate = new Date(year, month, mergedDay, 12, 0, 0, 0);
            const mergedKey = mergedDate.toLocaleDateString('en-CA');
            mergedSeconds += Math.max(0, Number(usage[mergedKey] || 0));
          }
          total += mergedSeconds;
          dailyItems.push({
            date: new Date(year, month, 28, 12, 0, 0, 0),
            seconds: mergedSeconds,
            label: `${month + 1}월 28일–${endDay}일`
          });
          continue;
        }

        if (day > endDay) {
          dailyItems.push({ empty: true, seconds: 0 });
          continue;
        }

        const date = new Date(year, month, day, 12, 0, 0, 0);
        const key = date.toLocaleDateString('en-CA');
        const seconds = Math.max(0, Number(usage[key] || 0));
        total += seconds;

        dailyItems.push({
          date,
          seconds,
          label: `${month + 1}월 ${day}일`
        });
      }

      groups.push({
        year,
        month,
        weekIndex,
        startDay,
        endDay,
        total,
        dailyItems
      });
    });
  }

  const max = Math.max(
    1,
    ...groups.flatMap((group) => group.dailyItems.map((item) => item.seconds || 0))
  );

  return groups.flatMap((group) => {
    const rangeLabel = `${group.month + 1}월 ${group.startDay}일–${group.endDay}일`;

    return group.dailyItems.map((item) => {
      if (item.empty) {
        return '<span class="dashboard-activity-cell level-0 is-empty" aria-hidden="true"></span>';
      }

      const level = item.seconds <= 0
        ? 0
        : Math.max(1, Math.min(4, Math.ceil((item.seconds / max) * 4)));

      return `<span
        class="dashboard-activity-cell level-${level}"
        data-tooltip-title="${rangeLabel}"
        data-tooltip-detail="${item.label} · ${formatDashboardDuration(item.seconds)} / 주간 총 ${formatDashboardDuration(group.total)}"
        aria-label="${rangeLabel} · ${item.label} 작곡 시간 ${formatDashboardDuration(item.seconds)}"
      ></span>`;
    });
  }).join('');
}


function getNicknameLastChangedAt() {
  const value = currentUser?.nicknameUpdatedAt || currentUser?.user_metadata?.nickname_updated_at || null;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getNextNicknameChangeDate() {
  const lastChanged = getNicknameLastChangedAt();
  if (!lastChanged) return null;
  const next = new Date(lastChanged);
  next.setDate(next.getDate() + NICKNAME_CHANGE_COOLDOWN_DAYS);
  return next;
}

function canChangeNickname() {
  const next = getNextNicknameChangeDate();
  return !next || Date.now() >= next.getTime();
}

function renderDashboardProfile() {
  if (!dashboardProfilePage || !currentUser) return;

  if (dashboardNicknameInput) {
    dashboardNicknameInput.value = currentUser.nickname || '';
  }

  const next = getNextNicknameChangeDate();
  const isLocked = Boolean(next && next.getTime() > Date.now());

  if (dashboardNicknameNextDate) {
    dashboardNicknameNextDate.textContent = isLocked
      ? localized({
          ko: `다음 변경 가능일 · ${next.toLocaleDateString('ko-KR')}`,
          en: `Next change available · ${next.toLocaleDateString('en-US')}`
        })
      : localized({ ko: '지금 닉네임을 변경할 수 있어요.', en: 'You can change your nickname now.' });

    dashboardNicknameNextDate.classList.toggle('is-locked', isLocked);
    dashboardNicknameNextDate.classList.toggle('is-available', !isLocked);
  }

  if (dashboardNicknameSaveButton) {
    dashboardNicknameSaveButton.disabled = currentUser.role !== 'general' || !canChangeNickname();
  }

  if (dashboardNicknameStatus) {
    dashboardNicknameStatus.textContent = currentUser.role === 'admin'
      ? localized({ ko: '관리자 계정은 닉네임을 변경할 수 없어요.', en: 'Administrator accounts cannot change their nickname.' })
      : '';
  }
}

async function updateDashboardNickname() {
  if (!supabaseClient || !currentUserId || currentUser?.role !== 'general') return;

  const nickname = String(dashboardNicknameInput?.value || '').trim();
  const normalized = nickname.toLowerCase();

  if (nickname.length < 2 || nickname.length > 12) {
    dashboardNicknameStatus.textContent = localized({ ko: '닉네임은 2~12자로 입력해주세요.', en: 'Enter a nickname between 2 and 12 characters.' });
    return;
  }

  if (RESERVED_NICKNAMES.includes(normalized) || RESERVED_NICKNAMES.includes(nickname)) {
    dashboardNicknameStatus.textContent = localized({ ko: '사용할 수 없는 닉네임이에요.', en: 'This nickname is not available.' });
    return;
  }

  if (!canChangeNickname()) {
    dashboardNicknameStatus.textContent = localized({ ko: '닉네임은 7일에 한 번 변경할 수 있어요.', en: 'You can change your nickname once every 7 days.' });
    return;
  }

  if (nickname === currentUser.nickname) {
    dashboardNicknameStatus.textContent = localized({ ko: '현재 사용 중인 닉네임이에요.', en: 'This is your current nickname.' });
    return;
  }

  dashboardNicknameSaveButton.disabled = true;
  dashboardNicknameStatus.textContent = localized({ ko: '확인 중...', en: 'Checking…' });

  const { data: duplicateRows, error: duplicateError } = await supabaseClient
    .from('profiles')
    .select('user_id')
    .ilike('nickname', nickname)
    .neq('user_id', currentUserId)
    .limit(1);

  if (duplicateError) {
    dashboardNicknameStatus.textContent = localized({ ko: '닉네임 중복 여부를 확인하지 못했어요.', en: 'Could not check nickname availability.' });
    dashboardNicknameSaveButton.disabled = false;
    return;
  }

  if (duplicateRows?.length) {
    dashboardNicknameStatus.textContent = localized({ ko: '이미 사용 중인 닉네임이에요.', en: 'This nickname is already in use.' });
    dashboardNicknameSaveButton.disabled = false;
    return;
  }

  const changedAt = new Date().toISOString();
  const { error: profileError } = await supabaseClient
    .from('profiles')
    .update({ nickname, nickname_updated_at: changedAt })
    .eq('user_id', currentUserId);

  if (profileError) {
    dashboardNicknameStatus.textContent = localized({ ko: '닉네임을 변경하지 못했어요.', en: 'Could not change the nickname.' });
    dashboardNicknameSaveButton.disabled = false;
    return;
  }

  await supabaseClient.auth.updateUser({
    data: { nickname, nickname_updated_at: changedAt }
  });

  currentUser.nickname = nickname;
  currentUser.nicknameUpdatedAt = changedAt;

  if (userStatusName) userStatusName.textContent = nickname;
  if (userMenuName) userMenuName.textContent = nickname;
  if (dashboardTitle) dashboardTitle.textContent = nickname;

  dashboardNicknameStatus.textContent = localized({ ko: '닉네임이 변경됐어요.', en: 'Your nickname has been changed.' });
  renderDashboardProfile();
  await loadArchive();
}

function updateDashboardLanguageLabels() {
  const isEnglish = currentLanguage === 'en';
  document.querySelectorAll('[data-dashboard-section]').forEach((button) => {
    button.textContent = isEnglish ? button.dataset.labelEn : button.dataset.labelKo;
  });

  const profileTitle = document.getElementById('dashboardProfileTitle');
  if (profileTitle) {
    profileTitle.textContent = isEnglish ? profileTitle.dataset.labelEn : profileTitle.dataset.labelKo;
  }
}

function setDashboardSection(section) {
  const isProfile = section === 'profile';

  if (dashboardOverviewPage) {
    dashboardOverviewPage.hidden = isProfile;
    dashboardOverviewPage.classList.toggle('is-active', !isProfile);
    dashboardOverviewPage.setAttribute('aria-hidden', String(isProfile));
  }

  if (dashboardProfilePage) {
    dashboardProfilePage.hidden = !isProfile;
    dashboardProfilePage.classList.toggle('is-active', isProfile);
    dashboardProfilePage.setAttribute('aria-hidden', String(!isProfile));
  }

  document.querySelectorAll('[data-dashboard-section]').forEach((button) => {
    const active = button.dataset.dashboardSection === section;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });

  if (isProfile) {
    renderDashboardProfile();
  }
}

function formatDashboardDuration(seconds) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

function getDashboardMoodLabel(mood) {
  if (!mood) return '—';
  return window.SoundiMoodAI?.moodMeta?.[mood]?.label?.ko || mood;
}

function getMostUsedMood(songs) {
  const counts = new Map();
  songs.forEach((item) => {
    if (!Array.isArray(item.composition) || !item.composition.length) return;
    const analysis = window.SoundiMoodAI?.analyzeMusicMood?.(item.composition, notes, {
      stepCount: item.stepCount || 64,
      minNotesForMood: 4
    });
    const mood = analysis?.primaryMood;
    if (!mood) return;
    counts.set(mood, (counts.get(mood) || 0) + 1);
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return getDashboardMoodLabel(top);
}

function getMostUsedNote(songs) {
  const labels = { do: '도', re: '레', mi: '미', fa: '파', sol: '솔', la: '라', si: '시' };
  const keys = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  const counts = new Map();
  songs.forEach((item) => {
    (item.composition || []).forEach((block) => {
      const key = keys.find((scaleKey) => String(block.noteId || '').startsWith(scaleKey));
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? labels[top] : '—';
}

function getMostUsedHarmony(songs) {
  const labels = {
    major3: '장3화음',
    minor3: '단3화음',
    perfect5: '완전5도',
    sus2: 'Sus2',
    sus4: 'Sus4',
    major7: '장7도'
  };
  const counts = new Map();

  songs.forEach((item) => {
    const byStep = new Map();
    (item.composition || []).forEach((block) => {
      if (!byStep.has(block.step)) byStep.set(block.step, []);
      byStep.get(block.step).push(block);
    });

    byStep.forEach((blocks) => {
      if (blocks.length < 2) return;
      const pitchClasses = [...new Set(blocks.map((block) => {
        const note = notes.find((entry) => entry.id === block.noteId);
        if (!note) return null;
        return ((note.midi + (block.accidental || 0)) % 12 + 12) % 12;
      }).filter(Number.isFinite))].sort((a, b) => a - b);

      const matchesShape = (intervals) => {
        if (pitchClasses.length !== intervals.length + 1) return false;
        return pitchClasses.some((root) => {
          const expected = [root, ...intervals.map((interval) => (root + interval) % 12)].sort((a, b) => a - b);
          return expected.every((value, index) => value === pitchClasses[index]);
        });
      };

      let type = null;
      if (matchesShape([2, 7])) type = 'sus2';
      else if (matchesShape([5, 7])) type = 'sus4';
      else if (matchesShape([4, 11]) || matchesShape([4, 7, 11])) type = 'major7';
      else if (matchesShape([4]) || matchesShape([4, 7])) type = 'major3';
      else if (matchesShape([3]) || matchesShape([3, 7])) type = 'minor3';
      else if (matchesShape([7])) type = 'perfect5';

      if (type) counts.set(type, (counts.get(type) || 0) + 1);
    });
  });

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? labels[top] : '—';
}

function isSameLocalDay(timestamp, date = new Date()) {
  const value = new Date(timestamp);
  return value.getFullYear() === date.getFullYear()
    && value.getMonth() === date.getMonth()
    && value.getDate() === date.getDate();
}

async function recordSiteVisit() {
  if (!supabaseClient || currentUser?.role !== 'general' || !currentUserId) return;
  const key = `soundi:visit:${currentUserId}:${new Date().toISOString().slice(0, 10)}`;
  if (sessionStorage.getItem(key)) return;
  const { error } = await supabaseClient.rpc('record_site_visit');
  if (!error) sessionStorage.setItem(key, '1');
  else console.warn('[Soundi Dashboard] 방문 기록 저장 실패', error);
}

async function getAdminVisitStats() {
  if (!supabaseClient) return { todayVisitors: null, totalVisitors: null, revisitRate: null };
  const { data, error } = await supabaseClient.rpc('dashboard_visit_stats');
  if (error) {
    console.warn('[Soundi Dashboard] 방문 통계 조회 실패', error);
    return { todayVisitors: null, totalVisitors: null, revisitRate: null };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    todayVisitors: Number(row?.today_visitors ?? 0),
    totalVisitors: Number(row?.total_visitors ?? 0),
    revisitRate: Number(row?.revisit_rate ?? 0)
  };
}


async function renderDashboard() {
  if (!dashboardModal || !currentUser) return;

  const dashboardSubtitle = document.getElementById('dashboardSubtitle');

  if (currentUser.role === 'admin') {
    const visitStats = await getAdminVisitStats();
    const todaySongCount = archiveItems.filter((item) => isSameLocalDay(item.createdAt || item.updatedAt)).length;
    const recentSongs = [...archiveItems]
      .sort((a, b) => (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0))
      .slice(0, 7);

    if (dashboardRole) dashboardRole.textContent = 'ADMIN';
    if (dashboardTitle) dashboardTitle.textContent = 'Dashboard';
    if (dashboardSubtitle) dashboardSubtitle.textContent = translate('dashboardSubtitle');

    if (dashboardStats) {
      dashboardStats.innerHTML = `
        <article class="dashboard-stat-card">
          <span class="dashboard-stat-label">${localized({ ko: '오늘 접속자', en: 'Visitors today' })}</span>
          <strong>${visitStats.todayVisitors ?? '—'}</strong>
          <small>${localized({ ko: '오늘 로그인한 사용자', en: 'Users who signed in today' })}</small>
        </article>
        <article class="dashboard-stat-card">
          <span class="dashboard-stat-label">${localized({ ko: '총 접속자', en: 'Total visitors' })}</span>
          <strong>${visitStats.totalVisitors ?? '—'}</strong>
          <small>${localized({ ko: '누적 고유 사용자', en: 'All-time unique users' })}</small>
        </article>
        <article class="dashboard-stat-card">
          <span class="dashboard-stat-label">${localized({ ko: '오늘 만들어진 곡', en: 'Songs made today' })}</span>
          <strong>${todaySongCount}</strong>
          <small>${localized({ ko: '오늘 생성된 곡', en: 'Songs created today' })}</small>
        </article>
        <article class="dashboard-stat-card">
          <span class="dashboard-stat-label">${localized({ ko: '총 만들어진 곡', en: 'Total songs' })}</span>
          <strong>${archiveItems.length}</strong>
          <small>${localized({ ko: '전체 곡', en: 'All songs' })}</small>
        </article>
        <article class="dashboard-stat-card">
          <span class="dashboard-stat-label">${localized({ ko: '재방문율', en: 'Return rate' })}</span>
          <strong>${visitStats.revisitRate == null ? '—' : `${Math.round(visitStats.revisitRate)}%`}</strong>
          <small>${localized({ ko: '2일 이상 방문한 사용자 비율', en: 'Users who visited on 2 or more days' })}</small>
        </article>
      `;
    }

    if (dashboardContent) {
      dashboardContent.innerHTML = `
        <section class="dashboard-recent-section">
          <h3 class="dashboard-section-title">${localized({ ko: '최근 만들어진 곡', en: 'Recently created songs' })}</h3>
          <section class="dashboard-panel dashboard-recent-panel">
            <div class="dashboard-table-wrap">
              <div class="dashboard-table dashboard-song-table">
                <div class="dashboard-table-row dashboard-table-head">
                  <span>${localized({ ko: '곡 제목', en: 'Song title' })}</span><span>${localized({ ko: '사용자', en: 'User' })}</span><span>${localized({ ko: '상태', en: 'Status' })}</span><span>${localized({ ko: '최근 작업', en: 'Last updated' })}</span>
                </div>
                ${recentSongs.length ? recentSongs.map((item) => `
                  <div class="dashboard-table-row">
                    <strong>${escapeHtml(item.title || 'Untitled')}</strong>
                    <span>${escapeHtml(item.author || 'Guest')}</span>
                    <span><i class="dashboard-status-badge ${item.status === 'published' ? 'is-published' : ''}">${item.status === 'published' ? localized({ ko: '게시됨', en: 'Published' }) : localized({ ko: '저장됨', en: 'Saved' })}</i></span>
                    <span>${formatSongSavedAt(item)}</span>
                  </div>
                `).join('') : '<p class="dashboard-empty">' + localized({ ko: '아직 만들어진 곡이 없어요.', en: 'No songs have been created yet.' }) + '</p>'}
              </div>
            </div>
          </section>
        </section>
      `;
    }
    return;
  }

  const mySongs = getCurrentUserSongs();
  const publishedCount = mySongs.filter((item) => item.status === 'published').length;
  const mostUsedMood = getMostUsedMood(mySongs);
  const mostUsedHarmony = getMostUsedHarmony(mySongs);
  const mostUsedNote = getMostUsedNote(mySongs);
  const recentSongs = [...mySongs]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 7);

  if (dashboardRole) dashboardRole.textContent = 'MY DASHBOARD';
  if (dashboardTitle) dashboardTitle.textContent = currentUser.nickname;

  if (dashboardStats) {
    dashboardStats.innerHTML = `
      <article class="dashboard-stat-card dashboard-stat-card-time">
        <span class="dashboard-stat-label">총 작곡 시간</span>
        <small>Compose 탭을 사용한 시간</small>
        <strong>${formatDashboardDuration(getCurrentComposeSeconds())}</strong>
      </article>
      <article class="dashboard-stat-card dashboard-stat-card-time">
        <span class="dashboard-stat-label">만든 곡 수</span>
        <small>저장한 모든 곡</small>
        <strong>${mySongs.length}</strong>
      </article>
      <article class="dashboard-stat-card dashboard-stat-card-time">
        <span class="dashboard-stat-label">게시한 곡 수</span>
        <small>Archive에 공개한 곡</small>
        <strong>${publishedCount}</strong>
      </article>
    `;
  }

  if (dashboardContent) {
    dashboardContent.innerHTML = `
      <section class="dashboard-activity-section">
        <div class="dashboard-section-heading-row">
          <h3 class="dashboard-section-title">작곡 활동</h3>
          <div class="dashboard-activity-modes" role="tablist" aria-label="작곡 활동 표시 방식">
            <button class="is-active" type="button" data-activity-mode="daily">일별</button>
            <button type="button" data-activity-mode="weekly">주간</button>
          </div>
        </div>

        <div class="dashboard-activity-visual">
          <div class="dashboard-activity-tooltip" data-activity-tooltip hidden><strong></strong><span></span></div>
          <div class="dashboard-activity-labels" data-activity-labels>${buildComposeActivityLabels('daily')}</div>
          <div class="dashboard-activity-grid dashboard-activity-grid-48" data-activity-view="daily" aria-label="최근 1년 일별 작곡 활동">${buildComposeActivityHeatmap(336)}</div>
          <div class="dashboard-activity-grid dashboard-activity-grid-48" data-activity-view="weekly" hidden aria-label="최근 1년 주간 작곡 활동">${buildWeeklyComposeActivity()}</div>
        </div>
      </section>

      <section class="dashboard-statistics-section">
        <h3 class="dashboard-section-title">내 작곡 통계</h3>
        <div class="dashboard-insights" aria-label="작곡 경향">
          <article class="dashboard-insight-card">
            <span>가장 자주 만든 음악 분위기</span>
            <strong>${escapeHtml(mostUsedMood)}</strong>
          </article>
          <article class="dashboard-insight-card">
            <span>가장 많이 사용한 화음</span>
            <strong>${escapeHtml(mostUsedHarmony)}</strong>
          </article>
          <article class="dashboard-insight-card">
            <span>가장 많이 사용한 음</span>
            <strong>${escapeHtml(mostUsedNote)}</strong>
          </article>
        </div>
      </section>

      <section class="dashboard-recent-section">
        <h3 class="dashboard-section-title">최근 만든 곡</h3>
        <section class="dashboard-panel dashboard-recent-panel">
          <div class="dashboard-table-wrap">
            <div class="dashboard-table dashboard-song-table">
              <div class="dashboard-table-row dashboard-table-head">
                <span>곡 제목</span><span>상태</span><span>블록</span><span>최근 작업</span>
              </div>
              ${recentSongs.length ? recentSongs.map((item) => `
                <div class="dashboard-table-row">
                  <strong>${escapeHtml(item.title || 'Untitled')}</strong>
                  <span><i class="dashboard-status-badge ${item.status === 'published' ? 'is-published' : ''}">${item.status === 'published' ? '게시됨' : '저장됨'}</i></span>
                  <span>${Array.isArray(item.composition) ? item.composition.length : 0}개</span>
                  <span>${formatSongSavedAt(item)}</span>
                </div>
              `).join('') : '<p class="dashboard-empty">아직 만든 곡이 없어요.</p>'}
            </div>
          </div>
        </section>
      </section>
    `;

    bindDashboardActivityTooltips();
    dashboardContent.querySelectorAll('[data-activity-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.activityMode;
        dashboardContent.querySelectorAll('[data-activity-mode]').forEach((item) => {
          item.classList.toggle('is-active', item === button);
        });

        dashboardContent.querySelectorAll('[data-activity-view]').forEach((view) => {
          view.hidden = view.dataset.activityView !== mode;
        });
        const labels = dashboardContent.querySelector('[data-activity-labels]');
        if (labels) {
          labels.dataset.mode = mode;
          labels.innerHTML = buildComposeActivityLabels(mode);
        }
      });
    });
  }
}


function bindDashboardActivityTooltips() {
  if (!dashboardContent) return;

  const tooltip = dashboardContent.querySelector('[data-activity-tooltip]');
  if (!tooltip) return;

  const title = tooltip.querySelector('strong');
  const detail = tooltip.querySelector('span');

  const showTooltip = (cell, event) => {
    if (title) title.textContent = cell.dataset.tooltipTitle || '';
    if (detail) detail.textContent = cell.dataset.tooltipDetail || '';
    tooltip.hidden = false;

    const rect = tooltip.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - rect.width - 12,
      Math.max(12, event.clientX + 12)
    );
    const top = Math.max(12, event.clientY - rect.height - 12);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  dashboardContent.querySelectorAll('.dashboard-activity-cell[data-tooltip-title]').forEach((cell) => {
    cell.addEventListener('mouseenter', (event) => showTooltip(cell, event));
    cell.addEventListener('mousemove', (event) => showTooltip(cell, event));
    cell.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });
  });
}

async function openDashboard() {
  if (!dashboardModal || !currentUser) return;
  dashboardModal.hidden = false;
  dashboardModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-dashboard-open');
  if (userMenu) userMenu.hidden = true;
  if (themePicker) themePicker.hidden = true;
  userStatusButton?.setAttribute('aria-expanded', 'false');
  themeMenuButton?.setAttribute('aria-expanded', 'false');
  updateDashboardLanguageLabels();
  await renderDashboard();
  setDashboardSection('dashboard');
}

function closeDashboard() {
  if (!dashboardModal) return;
  dashboardModal.hidden = true;
  dashboardModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-dashboard-open');
}

dashboardButton?.addEventListener('click', openDashboard);
dashboardCloseButton?.addEventListener('click', closeDashboard);
document.querySelectorAll('[data-dashboard-section]').forEach((button) => {
  button.addEventListener('click', () => {
    setDashboardSection(button.dataset.dashboardSection || 'dashboard');
  });
});
dashboardNicknameSaveButton?.addEventListener('click', updateDashboardNickname);
dashboardModal?.querySelector('[data-dashboard-close]')?.addEventListener('click', closeDashboard);
deleteConfirmCancelButton?.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmModal?.querySelector('[data-delete-confirm-cancel]')?.addEventListener('click', closeDeleteConfirmModal);
deleteConfirmDeleteButton?.addEventListener('click', async () => {
  const id = pendingDeleteSongId;
  if (!id) return;
  deleteConfirmDeleteButton.disabled = true;
  const deleted = await deleteSongById(id);
  deleteConfirmDeleteButton.disabled = false;
  if (deleted) closeDeleteConfirmModal();
});

logoutButton?.addEventListener('click', async () => {
  if (currentUser?.role === 'general' && supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  localStorage.removeItem(USER_SESSION_KEY);
  currentUser = null;
  currentUserId = null;
  currentSongId = null;
  mySongItems = [];
  archivePreviewItemId = null;
  isArchivePreviewMode = false;
  document.body.classList.remove('is-archive-preview-mode');
  renderMySongs();

  if (userMenu) userMenu.hidden = true;
  if (themePicker) themePicker.hidden = true;
  if (userStatusArea) userStatusArea.hidden = true;
  userStatusButton?.setAttribute('aria-expanded', 'false');
  themeMenuButton?.setAttribute('aria-expanded', 'false');

  if (nicknameInput) nicknameInput.value = '';
  selectedLoginRole = 'general';
  if (adminLoginPanel) adminLoginPanel.hidden = true;
  openLoginModal();
});

initializeAuthSession();

supabaseClient?.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    applySupabaseUserSession(session);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopComposeTimeTracking();
  else startComposeTimeTracking();
});

window.addEventListener('beforeunload', stopComposeTimeTracking);

function buildNotes() {
  highestOctave = Math.min(MAX_OCTAVE, highestOctave);
  lowestOctave = Math.max(MIN_OCTAVE, lowestOctave);
  const result = [];
  for (let octave = highestOctave; octave >= lowestOctave; octave -= 1) {
    NOTE_ORDER.forEach(([key, label, semitone]) => {
      const midi = 12 * (octave + 1) + semitone;
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      result.push({
        id: `${key}${octave}`,
        key,
        label,
        octave,
        midi,
        frequency,
        color: noteColors[key]
      });
    });
  }
  return result;
}

function getBaseComposeCellSize() {
  const raw = Math.min(48, Math.max(32, window.innerHeight * 0.042));
  const dpr = window.devicePixelRatio || 1;
  return Math.round(raw * dpr) / dpr;
}

function refreshComposeZoomSize() {
  const dpr = window.devicePixelRatio || 1;
  const rawSize = getBaseComposeCellSize() * composeZoom;
  const snappedSize = Math.round(rawSize * dpr) / dpr;
  document.documentElement.style.setProperty('--compose-cell', `${snappedSize}px`);
  document.documentElement.style.setProperty('--score-line-width', `${Math.max(.4, Math.min(1, composeZoom))}px`);
  updateGridMetrics();
}

function getMinComposeZoom() {
  if (!scoreScroll || !notes.length) return MIN_ZOOM;
  const baseCellSize = getBaseComposeCellSize();
  const availableHeight = scoreScroll.clientHeight || window.innerHeight;
  const minCellSize = Math.ceil(availableHeight / notes.length);
  const minToKeepPlayableRangeVisible = minCellSize / baseCellSize;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, minToKeepPlayableRangeVisible));
}

function updateZoomControls() {
  const minZoom = getMinComposeZoom();
  if (zoomLabel && document.activeElement !== zoomLabel) zoomLabel.value = `${Math.round(composeZoom * 100)}%`;
  if (zoomOutButton) zoomOutButton.disabled = composeZoom <= minZoom + 0.001;
  if (zoomInButton) zoomInButton.disabled = composeZoom >= MAX_ZOOM;
}

function commitZoomInput() {
  if (!zoomLabel) return;
  const rawValue = String(zoomLabel.value || '').replace('%', '').trim();
  const nextPercent = Number.parseFloat(rawValue);
  if (Number.isFinite(nextPercent)) {
    setComposeZoom(nextPercent / 100);
  }
  updateZoomControls();
}

function handleZoomInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitZoomInput();
    zoomLabel.blur();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    updateZoomControls();
    zoomLabel.blur();
  }
}

function setComposeZoom(nextZoom, preserveCenter = true) {
  const minZoom = getMinComposeZoom();
  const next = Math.min(MAX_ZOOM, Math.max(minZoom, nextZoom));
  if (next === composeZoom) {
    refreshComposeZoomSize();
    updateZoomControls();
    return;
  }

  const center = scoreScroll && preserveCenter
    ? {
      x: (scoreScroll.scrollLeft + scoreScroll.clientWidth / 2) / Math.max(1, scoreScroll.scrollWidth),
      y: (scoreScroll.scrollTop + scoreScroll.clientHeight / 2) / Math.max(1, scoreScroll.scrollHeight)
    }
    : null;

  composeZoom = next;
  refreshComposeZoomSize();
  updateZoomControls();

  if (!scoreScroll || !center) return;
  requestAnimationFrame(() => {
    scoreScroll.scrollLeft = Math.max(0, center.x * scoreScroll.scrollWidth - scoreScroll.clientWidth / 2);
    scoreScroll.scrollTop = Math.max(0, center.y * scoreScroll.scrollHeight - scoreScroll.clientHeight / 2);
  });
}


function handleComposeResize() {
  resizeIntentPrompt();
  const minZoom = getMinComposeZoom();
  if (composeZoom < minZoom) {
    setComposeZoom(minZoom, false);
    return;
  }
  refreshComposeZoomSize();
  updateZoomControls();
}

function render() {
  const previousScrollLeft = scoreScroll?.scrollLeft || 0;
  const previousScrollTop = scoreScroll?.scrollTop || 0;
  updateGridMetrics();
  renderPitchKeyboard();
  scoreGrid.innerHTML = '';

  const cells = new Map();
  composition.forEach((item) => {
    cells.set(getGridCellKey(item.noteId, item.step), { noteId: item.noteId, step: item.step, item, suggestion: null });
  });

  if (guideEnabled && lastSelectedNoteId && lastSelectedStep !== null && hasNote(lastSelectedNoteId, lastSelectedStep)) {
    notes.forEach((note) => {
      const key = getGridCellKey(note.id, lastSelectedStep);
      if (cells.has(key)) return;
      const suggestion = getHarmonySuggestion(note.id, lastSelectedStep, false);
      if (suggestion) cells.set(key, { noteId: note.id, step: lastSelectedStep, item: null, suggestion });
    });
  }

  const fragment = document.createDocumentFragment();
  cells.forEach((cellState) => {
    const cell = createGridCell(cellState.noteId, cellState.step, cellState.item, cellState.suggestion);
    if (cell) fragment.appendChild(cell);
  });
  scoreGrid.appendChild(fragment);

  renderAnalysis();
  updateDurationDisplay();
  if (scoreScroll) {
    scoreScroll.scrollLeft = previousScrollLeft;
    scoreScroll.scrollTop = previousScrollTop;
  }
}

function updateGridMetrics() {
  if (!scoreGrid) return;
  const cellSize = getComposeCellSize();
  const referenceStart = Math.max(0, notes.findIndex((note) => note.octave === 4 && note.key === 'si'));
  scoreGrid.style.setProperty('--step-count', STEP_COUNT);
  scoreGrid.style.setProperty('--note-count', notes.length);
  scoreGrid.style.setProperty('--reference-top', `${referenceStart * cellSize}px`);
  scoreGrid.style.setProperty('--reference-bottom', `${(referenceStart + NOTE_ORDER.length) * cellSize}px`);
}

function getGridCellKey(noteId, step) {
  return `${noteId}:${step}`;
}

function getGridTargetFromPointer(event) {
  return getGridTargetFromPoint(event.clientX, event.clientY);
}

function getGridTargetFromPoint(clientX, clientY) {
  if (!scoreGrid) return null;
  const rect = scoreGrid.getBoundingClientRect();
  const cellSize = getComposeCellSize();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0) return null;
  const step = Math.floor(x / cellSize);
  const noteIndex = Math.floor(y / cellSize);
  if (step < 0 || step >= STEP_COUNT || noteIndex < 0 || noteIndex >= notes.length) return null;
  return { noteId: notes[noteIndex].id, step };
}

function createGridCell(noteId, step, item = null, suggestion = null) {
  const note = notes.find((entry) => entry.id === noteId);
  if (!note || step < 0 || step >= STEP_COUNT) return null;
  const active = Boolean(item);
  const accidental = item?.accidental || 0;
  const cell = document.createElement('button');
  const cellClasses = [
    'grid-cell',
    active ? 'is-filled' : '',
    accidental === 1 ? 'is-sharp' : '',
    accidental === -1 ? 'is-flat' : '',
    suggestion ? 'is-suggested' : '',
    canAccidental(note, 1) ? 'can-sharp' : '',
    canAccidental(note, -1) ? 'can-flat' : '',
    note.octave === 4 ? 'is-reference-octave' : '',
    step % 4 === 0 ? 'is-beat-line' : '',
    step % 8 === 0 ? 'is-measure-line' : '',
    note.key === 'si' ? 'is-octave-start' : ''
  ].filter(Boolean).join(' ');
  cell.type = 'button';
  cell.className = cellClasses;
  cell.dataset.noteId = note.id;
  cell.dataset.step = String(step);
  if (suggestion) cell.dataset.relation = suggestion.label;
  if (note.octave === 4) cell.dataset.hint = currentLanguage === 'ko' ? '이 연한 회색 영역은<br />가운데 음이에요' : 'This soft gray<br />area is middle notes';
  cell.style.setProperty('--note-color', note.color);
  cell.style.gridColumn = String(step + 1);
  cell.style.gridRow = String(notes.findIndex((entry) => entry.id === note.id) + 1);
  cell.setAttribute('aria-label', `${getDisplayNoteLabel(note, accidental)} ${step + 1}번째 칸`);
  if (suggestion) {
    const label = document.createElement('span');
    label.className = 'harmony-label';
    label.textContent = suggestion.shortLabel;
    cell.appendChild(label);
  }
  return cell;
}

function syncGridCell(noteId, step) {
  if (!scoreGrid) return;
  const selector = '[data-note-id="' + noteId + '"][data-step="' + step + '"]';
  scoreGrid.querySelector(selector)?.remove();
  const item = getNoteAt(noteId, step);
  if (!item) return;
  const cell = createGridCell(noteId, step, item, null);
  if (cell) scoreGrid.appendChild(cell);
}

function renderPitchKeyboard() {
  if (!pitchKeyboard) return;
  pitchKeyboard.style.setProperty('--note-count', notes.length);
  pitchKeyboard.innerHTML = notes.map((note) => `
    <span class="pitch-label${note.octave === 4 ? ' is-middle' : ''}${note.key === 'do' ? ' is-octave-label' : ''}${note.key === 'si' ? ' is-octave-start' : ''}">
      <span>${note.key === 'do' ? `C${note.octave}` : ''}</span>
    </span>
  `).join('');
}

function getHarmonySuggestion(noteId, step, active) {
  if (!guideEnabled || active || lastSelectedStep !== step || !lastSelectedNoteId || !hasNote(lastSelectedNoteId, lastSelectedStep)) return null;
  const type = HARMONY_TYPES[harmonyType];
  if (getStepNoteCount(step) >= (type?.maxNotes || 3)) return null;
  return getHarmonySuggestions(lastSelectedNoteId).find((suggestion) => suggestion.id === noteId) || null;
}

function isHarmonySuggestion(noteId, step, active) {
  return Boolean(getHarmonySuggestion(noteId, step, active));
}

function getHarmonySuggestionIds(noteId) {
  return getHarmonySuggestions(noteId).map((suggestion) => suggestion.id);
}

function getHarmonySuggestions(noteId) {
  const selected = notes.find((note) => note.id === noteId);
  const type = HARMONY_TYPES[harmonyType];
  if (!selected || !type) return [];
  const intervals = [...type.intervals, ...(TENSION_TYPES[tensionType]?.intervals || [])];
  const suggestions = intervals
    .map((interval) => {
      const target = getPlayableTarget(selected.midi + interval);
      if (!target) return null;
      const relation = intervalLabels[interval] || `${interval} semitones`;
      const accidentalText = target.accidental > 0 ? ' sharp' : target.accidental < 0 ? ' flat' : '';
      return {
        id: target.id,
        accidental: target.accidental,
        interval,
        label: relation + accidentalText,
        shortLabel: getShortIntervalLabel(interval) + (target.accidental > 0 ? ' #' : target.accidental < 0 ? ' b' : '')
      };
    })
    .filter(Boolean)
    .filter((suggestion) => suggestion.id !== selected.id || suggestion.accidental !== 0);
  return suggestions.slice(0, (type.maxSuggestions || suggestions.length) + (tensionType === 'none' ? 0 : 1));
}

function getShortIntervalLabel(interval) {
  if (interval === 3 || interval === 4) return '3rd';
  if (interval === 5) return '4th';
  if (interval === 7) return '5th';
  if (interval === 11) return '7th';
  if (interval === 12) return '8ve';
  if (interval === 14) return '9th';
  return `${interval}`;
}

function getPlayableTarget(targetMidi) {
  const exact = notes.find((note) => note.midi === targetMidi);
  if (exact) return { id: exact.id, accidental: 0 };
  const sharpBase = notes.find((note) => canAccidental(note, 1) && note.midi + 1 === targetMidi);
  if (sharpBase) return { id: sharpBase.id, accidental: 1 };
  const flatBase = notes.find((note) => canAccidental(note, -1) && note.midi - 1 === targetMidi);
  if (flatBase) return { id: flatBase.id, accidental: -1 };
  return null;
}

function canAccidental(note, accidental) {
  if (!note) return false;
  return accidental > 0 ? SHARP_KEYS.has(note.key) : accidental < 0 ? FLAT_KEYS.has(note.key) : true;
}

function getDisplayNoteLabel(note, accidental = 0) {
  return `${note.label}${accidental > 0 ? '#' : accidental < 0 ? 'b' : ''}${note.octave}`;
}

function getPlaybackFrequency(note, accidental = 0) {
  const midi = note.midi + accidental;
  return 440 * 2 ** ((midi - 69) / 12);
}

function getCompositionItemMidi(item) {
  const note = notes.find((entry) => entry.id === item.noteId);
  if (!note) return null;
  return note.midi + (item.accidental || 0);
}

function getSoundingCompositionItemsAtStep(step) {
  return composition.filter((item) => {
    const isContinuation = item.step > 0 && hasNote(item.noteId, item.step - 1);
    if (isContinuation) return false;
    const length = getSustainLength(item.noteId, item.step);
    return step >= item.step && step < item.step + length;
  });
}

function getPitchClassesFromItems(items) {
  return [...new Set(
    items
      .map(getCompositionItemMidi)
      .filter(Number.isFinite)
      .map((midi) => ((midi % 12) + 12) % 12)
  )].sort((a, b) => a - b);
}

function hasPitchClassShape(pitchClasses, intervals) {
  if (pitchClasses.length !== intervals.length + 1) return false;
  return pitchClasses.some((root) => {
    const expected = [0, ...intervals]
      .map((interval) => (root + interval) % 12)
      .sort((a, b) => a - b);
    return expected.every((value, index) => value === pitchClasses[index]);
  });
}

function classifyHapticChord(items) {
  const pitchClasses = getPitchClassesFromItems(items);

  if (pitchClasses.length <= 1) return 'single';

  if (hasPitchClassShape(pitchClasses, [2, 7])) return 'sus2';
  if (hasPitchClassShape(pitchClasses, [5, 7])) return 'sus4';
  if (hasPitchClassShape(pitchClasses, [4, 11])) return 'major7';
  if (hasPitchClassShape(pitchClasses, [4, 7, 11])) return 'major7';
  if (hasPitchClassShape(pitchClasses, [4])) return 'major3';
  if (hasPitchClassShape(pitchClasses, [3])) return 'minor3';
  if (hasPitchClassShape(pitchClasses, [7])) return 'perfect5';
  if (hasPitchClassShape(pitchClasses, [4, 7])) return 'major3';
  if (hasPitchClassShape(pitchClasses, [3, 7])) return 'minor3';

  return 'strongTension';
}

function getHapticStateAtStep(step) {
  const soundingItems = getSoundingCompositionItemsAtStep(step);
  if (!soundingItems.length) return null;
  const chordType = classifyHapticChord(soundingItems);
  const mapping = HAPTIC_CHORD_MAP[chordType] || HAPTIC_CHORD_MAP.strongTension;
  return {
    chordType,
    label: mapping.label,
    intensity: mapping.intensity,
    sharpness: mapping.sharpness,
    pattern: mapping.pattern
  };
}

function getHapticStateKey(state) {
  if (!state) return 'silence';
  return [state.chordType, state.intensity, state.sharpness, state.pattern].join(':');
}

function buildHapticEventsFromComposition() {
  const secondsPerStep = getStepIntervalSeconds();
  const loopBounds = getLoopBounds();
  const events = [];
  let activeEvent = null;

  for (let step = loopBounds.start; step < loopBounds.end; step += 1) {
    const state = getHapticStateAtStep(step);
    const stateKey = getHapticStateKey(state);

    if (!state) {
      if (activeEvent) {
        events.push(activeEvent);
        activeEvent = null;
      }
      continue;
    }

    if (activeEvent && activeEvent._stateKey === stateKey) {
      activeEvent.duration += secondsPerStep;
      continue;
    }

    if (activeEvent) events.push(activeEvent);

    activeEvent = {
      startTime: (step - loopBounds.start) * secondsPerStep,
      duration: secondsPerStep,
      chordType: state.chordType,
      chordLabel: state.label,
      intensity: state.intensity,
      sharpness: state.sharpness,
      pattern: state.pattern,
      _stateKey: stateKey
    };
  }

  if (activeEvent) events.push(activeEvent);

  return events.map(({ _stateKey, ...event }) => ({
    ...event,
    startTime: Number(event.startTime.toFixed(4)),
    duration: Number(event.duration.toFixed(4))
  }));
}

function debugSoundiHaptics() {
  const events = buildHapticEventsFromComposition();
  console.table(events);
  return events;
}

window.SoundiHaptics = {
  buildEvents: buildHapticEventsFromComposition,
  debug: debugSoundiHaptics,
  classifyAtStep: getHapticStateAtStep
};

function buildSoundiVisualPlayback() {
  const analysis = playbackAnalysis || analyzeComposition();
  const loopBounds = getLoopBounds();
  const secondsPerStep = getStepIntervalSeconds();
  const timeline = [];

  for (let step = loopBounds.start; step < loopBounds.end; step += 1) {
    const { colors, motion } = getMoodVisualState(analysis, step);
    timeline.push({
      startTime: Number(((step - loopBounds.start) * secondsPerStep).toFixed(4)),
      colors,
      shapeDuration: motion.shapeDuration,
      surfaceDuration: motion.surfaceDuration,
      pulseDuration: motion.pulseDuration,
      pulseScale: Number(motion.pulseScale),
      surfaceBlur: motion.surfaceBlur,
      surfaceSaturate: Number(motion.surfaceSaturate)
    });
  }

  return {
    caption: getConciseFeedbackSentence(analysis),
    loopDuration: Number(((loopBounds.end - loopBounds.start) * secondsPerStep).toFixed(4)),
    timeline
  };
}


let soundiHapticStatus = {
  connected: false,
  deviceName: ''
};
let soundiHapticStatusTimer = null;

function getHapticUiCopy() {
  const isKo = currentLanguage === 'ko';
  return {
    connect: isKo ? 'Connect device' : 'Connect device',
    connected: isKo ? 'Connected' : 'Connected',
    searching: isKo ? '기기를 찾고 있어요…' : 'Searching for a device…',
    unavailable: isKo
      ? '연결 가능한 기기가 없어요. iPhone에서 Soundi App을 실행해주세요.'
      : 'No available device. Open the Soundi App on your iPhone.',
    connectedMessage: isKo
      ? 'Soundi App과 연결되었어요. 재생하면 햅틱도 함께 시작돼요.'
      : 'Connected to the Soundi App. Haptics will start when you play your music.'
  };
}

function renderHapticStatus() {
  if (!hapticStatusUi || !hapticStatusText) return;

  const copy = getHapticUiCopy();
  hapticStatusUi.classList.toggle('is-connected', soundiHapticStatus.connected);
  hapticStatusText.textContent = soundiHapticStatus.connected ? copy.connected : copy.connect;

  if (hapticDeviceRow) {
    hapticDeviceRow.hidden = !soundiHapticStatus.connected;
  }
  if (hapticDeviceName && soundiHapticStatus.connected) {
    hapticDeviceName.textContent = soundiHapticStatus.deviceName || 'Soundi App';
  }
  if (hapticConnectMessage) {
    hapticConnectMessage.textContent = soundiHapticStatus.connected
      ? copy.connectedMessage
      : copy.unavailable;
  }
}

async function refreshSoundiHapticStatus({ showSearching = false } = {}) {
  const copy = getHapticUiCopy();

  if (showSearching && hapticConnectMessage) {
    hapticConnectMessage.textContent = copy.searching;
  }

  try {
    const response = await fetch('/api/haptics/status', {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Haptic status failed (${response.status})`);

    const status = await response.json();
    soundiHapticStatus = {
      connected: Boolean(status.connected),
      deviceName: String(status.deviceName || '')
    };
  } catch (error) {
    soundiHapticStatus = {
      connected: false,
      deviceName: ''
    };
  }

  renderHapticStatus();
  return soundiHapticStatus;
}

function closeHapticPopovers(except = null) {
  [
    [hapticInfoPopover, hapticInfoButton],
    [hapticConnectPopover, hapticConnectButton]
  ].forEach(([popover, button]) => {
    if (!popover || popover === except) return;
    popover.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  });
}

hapticInfoButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  const willOpen = Boolean(hapticInfoPopover?.hidden);
  closeHapticPopovers(hapticInfoPopover);

  if (hapticInfoPopover) {
    hapticInfoPopover.hidden = !willOpen;
    hapticInfoButton.setAttribute('aria-expanded', String(willOpen));
  }
});

hapticConnectButton?.addEventListener('click', async (event) => {
  event.stopPropagation();
  const willOpen = Boolean(hapticConnectPopover?.hidden);
  closeHapticPopovers(hapticConnectPopover);

  if (!hapticConnectPopover) return;

  hapticConnectPopover.hidden = !willOpen;
  hapticConnectButton.setAttribute('aria-expanded', String(willOpen));

  if (willOpen) {
    await refreshSoundiHapticStatus({ showSearching: true });
  }
});


hapticPairingCodeInput?.addEventListener('input', () => {
  hapticPairingCodeInput.value = hapticPairingCodeInput.value.replace(/\D/g, '').slice(0, 6);
});

hapticPairingConnectButton?.addEventListener('click', async (event) => {
  event.stopPropagation();

  const pairingCode = String(hapticPairingCodeInput?.value || '').replace(/\D/g, '').slice(0, 6);
  if (pairingCode.length !== 6) {
    if (hapticPairingMessage) {
      hapticPairingMessage.textContent = translate('pairingInvalid');
    }
    hapticPairingCodeInput?.focus();
    return;
  }

  hapticPairingConnectButton.disabled = true;
  if (hapticPairingMessage) {
    hapticPairingMessage.textContent = translate('pairingConnecting');
  }

  try {
    const host = String(hapticPairingHostInput?.value || '').trim();
    const response = await fetch('/api/haptics/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode, host })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Pairing failed (${response.status})`);
    }

    if (hapticPairingMessage) {
      hapticPairingMessage.textContent = translate('pairingConnected');
    }

    await refreshSoundiHapticStatus();
  } catch (error) {
    console.warn('[Soundi Haptics] 연결 코드 연결 실패', error);
    if (hapticPairingMessage) {
      hapticPairingMessage.textContent = error.message || translate('pairingFailed');
    }
  } finally {
    hapticPairingConnectButton.disabled = false;
  }
});

hapticPairingCodeInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    hapticPairingConnectButton?.click();
  }
});

document.addEventListener('click', (event) => {
  if (hapticStatusUi && !hapticStatusUi.contains(event.target)) {
    closeHapticPopovers();
  }
});

refreshSoundiHapticStatus();
soundiHapticStatusTimer = window.setInterval(() => {
  refreshSoundiHapticStatus();
}, 4000);

let hapticRequestQueue = Promise.resolve();
let playbackStepDeadline = 0;
function queueHapticRequest(url, options) {
  const request = hapticRequestQueue.then(() => fetch(url, {
    ...options, signal: AbortSignal.timeout(5000)
  }));
  hapticRequestQueue = request.catch(() => {});
  return request;
}

async function sendSoundiHapticsToActiveDevice(startAt, fromStep = getLoopBounds().start) {
  const offset = (fromStep - getLoopBounds().start) * getStepIntervalSeconds();
  const events = buildHapticEventsFromComposition()
    .filter(event => event.startTime + event.duration > offset)
    .map(event => ({...event,
      startTime: Math.max(0, event.startTime - offset),
      duration: event.duration - Math.max(0, offset - event.startTime)
    }));
  if (!events.length) return false;

  try {
    const response = await queueHapticRequest('/api/haptics/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        startAt,
        visual: buildSoundiVisualPlayback()
      })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn('[Soundi Haptics] 재생 전송 실패', result.error || response.statusText);
      return false;
    }

    const result = await response.json();
    console.log('[Soundi Haptics] 재생 전송 완료', result);
    return true;
  } catch (error) {
    console.warn('[Soundi Haptics] 재생 전송 오류', error);
    return false;
  }
}

async function stopSoundiHapticsOnActiveDevice() {
  try {
    const response = await queueHapticRequest('/api/haptics/stop', {
      method: 'POST'
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.warn('[Soundi Haptics] 정지 전송 실패', result.error || response.statusText);
      return false;
    }

    console.log('[Soundi Haptics] 정지 전송 완료');
    return true;
  } catch (error) {
    console.warn('[Soundi Haptics] 정지 전송 오류', error);
    return false;
  }
}



function getHarmonyDirection(selected) {
  if (selected.octave >= 5) return 'below';
  if (selected.octave <= 3) return 'above';
  return 'nearest';
}

function scoreDirection(item, direction) {
  if (direction === 'above') return item.direction > 0 ? 0 : 1;
  if (direction === 'below') return item.direction < 0 ? 0 : 1;
  return 0;
}

function getNearestPitchClassId(selected, pitchClass, direction = 'nearest') {
  const candidates = notes
    .filter((note) => ((note.midi % 12) + 12) % 12 === pitchClass)
    .map((note) => ({ note, distance: Math.abs(note.midi - selected.midi), direction: Math.sign(note.midi - selected.midi) }))
    .sort((a, b) => scoreDirection(a, direction) - scoreDirection(b, direction) || a.distance - b.distance || a.note.midi - b.note.midi);
  return candidates[0]?.note.id;
}

function getNearestChordToneIds(selected, key) {
  const candidates = notes
    .filter((note) => note.key === key)
    .map((note) => ({ note, distance: note.midi - selected.midi }))
    .filter((item) => item.distance !== 0);
  const above = candidates.filter((item) => item.distance > 0).sort((a, b) => a.distance - b.distance)[0]?.note.id;
  const below = candidates.filter((item) => item.distance < 0).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0]?.note.id;
  return [above, below].filter(Boolean);
}

function getNoteAt(noteId, step) {
  return composition.find((item) => item.noteId === noteId && item.step === step);
}

function hasNote(noteId, step) {
  return Boolean(getNoteAt(noteId, step));
}

function getStepNoteCount(step) {
  return composition.filter((item) => item.step === step).length;
}

function shouldKeepHarmonyAnchor(noteId, step) {
  return guideEnabled
    && lastSelectedNoteId
    && lastSelectedStep === step
    && getHarmonySuggestionIds(lastSelectedNoteId).includes(noteId);
}

function updateHarmonyAnchorAfterEdit(noteId, step, shouldFill, keptAnchor) {
  if (!guideEnabled) return;
  if (!shouldFill && noteId === lastSelectedNoteId && step === lastSelectedStep) {
    lastSelectedNoteId = null;
    lastSelectedStep = null;
    return;
  }
  if (shouldFill && !keptAnchor) {
    lastSelectedNoteId = noteId;
    lastSelectedStep = step;
  }
  if (lastSelectedStep !== step || !lastSelectedNoteId) return;
  const suggestions = getHarmonySuggestionIds(lastSelectedNoteId);
  const type = HARMONY_TYPES[harmonyType];
  const maxNotes = (type?.maxNotes || 3) + (tensionType === 'none' ? 0 : 1);
  const isComplete = getStepNoteCount(step) >= maxNotes || (suggestions.length > 0 && suggestions.every((id) => hasNote(id, step)));
  if (isComplete) {
    lastSelectedNoteId = null;
    lastSelectedStep = null;
  }
}

function toggleCell(noteId, step) {
  if (isExampleMode) return;
  pushUndoState();
  applyCellState(noteId, step, !hasNote(noteId, step));
  render();
  flashStep(step, true);
}

function beginGridDrag(event, noteId, step) {
  if (isExampleMode || isArchivePreviewMode || isPublishedLocked || event.button !== 0) return;
  event.preventDefault();
  pushUndoState();
  const wasFilled = hasNote(noteId, step);
  gridDragState = {
    noteId,
    shouldFill: !wasFilled,
    wasFilled,
    touched: new Set(),
    startY: event.clientY,
    currentNoteId: noteId,
    currentStep: step,
    changedAccidental: false
  };
  if (wasFilled) {
    gridDragState.touched.add(noteId + ':' + step);
  } else {
    applyDragCell(noteId, step);
  }
  window.addEventListener('pointermove', updateAccidentalDrag);
  window.addEventListener('pointerup', endGridDrag, { once: true });
}

function beginGridDragFromEvent(event) {
  const target = getGridTargetFromPointer(event);
  if (!target) return;
  beginGridDrag(event, target.noteId, target.step);
}

function continueGridDragFromEvent(event) {
  if (!gridDragState) return;
  const target = getGridTargetFromPointer(event);
  if (!target) return;
  continueGridDrag(target.noteId, target.step);
}

function continueGridDrag(noteId, step) {
  if (!gridDragState || gridDragState.noteId !== noteId) return;
  applyDragCell(noteId, step);
}

function applyDragCell(noteId, step) {
  if (!gridDragState) return;
  const key = noteId + ':' + step;
  gridDragState.currentNoteId = noteId;
  gridDragState.currentStep = step;
  if (gridDragState.touched.has(key)) return;
  gridDragState.touched.add(key);
  applyCellState(noteId, step, gridDragState.shouldFill);
  syncGridCell(noteId, step);
  flashStep(step, true);
}

function updateAccidentalDrag(event) {
  if (!gridDragState || (!gridDragState.shouldFill && !gridDragState.wasFilled)) return;
  const note = notes.find((entry) => entry.id === gridDragState.currentNoteId);
  if (!note) return;
  const deltaY = event.clientY - gridDragState.startY;
  const accidental = deltaY <= -ACCIDENTAL_DRAG_THRESHOLD
    ? 1
    : deltaY >= ACCIDENTAL_DRAG_THRESHOLD
      ? -1
      : 0;
  if (setCellAccidental(gridDragState.currentNoteId, gridDragState.currentStep, canAccidental(note, accidental) ? accidental : 0)) {
    gridDragState.changedAccidental = true;
    refreshAnalysisAfterEdit();
  }
}

function endGridDrag() {
  if (!gridDragState) return;
  window.removeEventListener('pointermove', updateAccidentalDrag);
  const state = gridDragState;
  if (state.wasFilled && !state.changedAccidental) {
    applyCellState(state.noteId, state.currentStep, false);
  }
  gridDragState = null;
  sortComposition();
  render();
}

function applyCellState(noteId, step, shouldFill) {
  const index = composition.findIndex((item) => item.noteId === noteId && item.step === step);
  const keptAnchor = shouldKeepHarmonyAnchor(noteId, step);
  let changed = false;
  if (shouldFill && index < 0) {
    const suggestion = getHarmonySuggestion(noteId, step, false);
    composition.push({
      id: 'n-' + Date.now() + '-' + Math.round(Math.random() * 9999),
      noteId,
      step,
      accidental: suggestion?.accidental || 0
    });
    changed = true;
  } else if (!shouldFill && index >= 0) {
    composition.splice(index, 1);
    changed = true;
  }
  sortComposition();
  updateHarmonyAnchorAfterEdit(noteId, step, shouldFill, keptAnchor);
  if (changed) refreshAnalysisAfterEdit();
}

function refreshAnalysisAfterEdit() {
  aiAnalyzeLockedUntilEdit = false;
  if (aiAnalyzeButton) aiAnalyzeButton.disabled = aiCoachStatus === 'loading';

  if (isPlaying) {
    stopPlayback();
  }

  renderAnalysis();
  // Keep publish availability in sync with edits so the button appears
  // immediately after the first block is placed.
  syncComposePublishButton();
}

function setCellAccidental(noteId, step, accidental) {
  const item = getNoteAt(noteId, step);
  const note = notes.find((entry) => entry.id === noteId);
  if (!item || !note) return false;
  const nextAccidental = canAccidental(note, accidental) ? accidental : 0;
  const changed = (item.accidental || 0) !== nextAccidental;
  item.accidental = nextAccidental;
  const cell = scoreGrid.querySelector('[data-note-id="' + noteId + '"][data-step="' + step + '"]');
  if (!cell) return changed;
  cell.classList.toggle('is-sharp', item.accidental === 1);
  cell.classList.toggle('is-flat', item.accidental === -1);
  return changed;
}

function sortComposition() {
  composition.sort((a, b) => a.step - b.step || notes.findIndex((note) => note.id === a.noteId) - notes.findIndex((note) => note.id === b.noteId));
}

function analyzeComposition() {
  const isEmpty = composition.length === 0;
  const moodAI = window.SoundiMoodAI?.analyzeMusicMood(composition, notes, {
    stepCount: STEP_COUNT,
    minNotesForMood: 4
  });
  const features = moodAI?.features || {};
  const activeSteps = features.raw?.activeSteps || [...new Set(composition.map((item) => item.step))].sort((a, b) => a - b);
  const durations = features.raw?.durations || [];
  const visualState = moodAI?.visualState;
  const emptyColors = ['#ffffff', '#f8f8f8', '#efefef', '#ffffff'];
  const paletteKey = isEmpty ? 'empty' : moodAI?.primaryMood || 'warm';
  const palette = {
    name: getMoodTypeLabel({ paletteKey, moodAI }),
    vars: isEmpty ? emptyColors.slice(0, 3) : visualState?.colors?.slice(0, 3) || palettes.warm.vars,
    marks: isEmpty ? emptyColors : visualState?.colors || palettes.warm.marks,
    sphere: isEmpty ? emptyColors : visualState?.colors || palettes.warm.sphere,
    motion: {
      gradient: visualState?.gradientDuration || 10400,
      shape: visualState?.shapeDuration || 10800
    }
  };

  return {
    isEmpty,
    moodAI,
    activeSteps,
    density: features.noteDensity || 0,
    activity: features.rhythmicDensity || 0,
    highRatio: features.highRatio || 0,
    lowRatio: features.lowRatio || 0,
    averageGap: features.raw?.gaps?.length
      ? features.raw.gaps.reduce((sum, gap) => sum + gap, 0) / features.raw.gaps.length
      : STEP_COUNT,
    averageLength: durations.length ? durations.reduce((sum, length) => sum + length, 0) / durations.length : 1,
    repetition: getMostRepeatedNote(),
    chordSteps: Math.round((features.chordRatio || 0) * Math.max(1, activeSteps.length)),
    chordRatio: features.chordRatio || 0,
    contour: (features.ascendingRatio || 0) - (features.descendingRatio || 0),
    energy: moodAI?.energy || 0,
    tension: moodAI?.tension || 0,
    brightness: moodAI?.brightness || 0.5,
    pitchLevel: features.averagePitch || 0.5,
    rhythmDensity: features.rhythmicDensity || 0,
    noteLength: features.averageDuration || 0,
    repetitionStrength: features.repetitionStrength || 0,
    rhythmVariation: features.rhythmVariation || 0,
    shortNoteRatio: features.shortNoteRatio || 0,
    palette,
    paletteKey
  };
}

function getPlaybackSegmentAnalysis(activeStep, fallbackAnalysis) {
  if (!isPlaying || activeStep < 0 || !window.SoundiMoodAI?.analyzeMusicMood) return fallbackAnalysis;
  const loopBounds = getLoopBounds();
  const windowSize = 8;
  let start = Math.max(loopBounds.start, activeStep - Math.floor(windowSize / 2));
  let end = Math.min(loopBounds.end, start + windowSize);
  start = Math.max(loopBounds.start, end - windowSize);

  const segmentComposition = composition
    .filter((item) => item.step >= start && item.step < end)
    .map((item) => ({ ...item, step: item.step - start }));

  const moodAI = window.SoundiMoodAI.analyzeMusicMood(segmentComposition, notes, {
    stepCount: Math.max(1, end - start),
    minNotesForMood: 3
  });

  if (!moodAI || moodAI.status !== 'ready') return fallbackAnalysis;
  const features = moodAI.features || {};
  const visualState = moodAI.visualState;
  const colors = visualState?.colors || fallbackAnalysis.palette.sphere;
  return {
    ...fallbackAnalysis,
    moodAI,
    energy: moodAI.energy || 0,
    tension: moodAI.tension || 0,
    brightness: moodAI.brightness || 0.5,
    pitchLevel: features.averagePitch || fallbackAnalysis.pitchLevel,
    rhythmDensity: features.rhythmicDensity || 0,
    rhythmVariation: features.rhythmVariation || 0,
    repetitionStrength: features.repetitionStrength || 0,
    shortNoteRatio: features.shortNoteRatio || 0,
    palette: {
      ...fallbackAnalysis.palette,
      vars: colors.slice(0, 3),
      marks: colors,
      sphere: colors
    }
  };
}

function renderAnalysis(activeStep = -1) {
  const analysis = isPlaying && playbackAnalysis ? playbackAnalysis : analyzeComposition();
  const [toneA, toneB, toneC] = analysis.palette.vars;
  [document.documentElement, visualStage].forEach((target) => {
    target.style.setProperty('--tone-a', toneA);
    target.style.setProperty('--tone-b', toneB);
    target.style.setProperty('--tone-c', toneC);
  });
  visualStage.style.setProperty('--focus-x', '50%');
  visualStage.style.setProperty('--focus-y', '34%');

  const visualAnalysis = getPlaybackSegmentAnalysis(activeStep, analysis);
  renderMoodBlob(visualAnalysis, activeStep);
  if (archivePlayerActive) syncArchivePlayer(visualAnalysis, activeStep);
  renderMoodMetrics(analysis);
  renderFeedback(analysis);
  renderLocalMoodCaption(analysis);
  renderAICoachResult();
}

function getMoodVisualState(analysis, activeStep = -1) {
  const soundingItems = isPlaying
    ? composition.filter((item) => {
      const sequenceLength = getSustainLength(item.noteId, item.step);
      const isContinuation = item.step > 0 && hasNote(item.noteId, item.step - 1);
      return !isContinuation && activeStep >= item.step && activeStep < item.step + sequenceLength;
    })
    : [];
  const activeItems = soundingItems.length ? soundingItems : composition;
  const activeLengths = activeItems.map((item) => getSustainLength(item.noteId, item.step));
  const averageLength = activeLengths.length
    ? activeLengths.reduce((sum, length) => sum + length, 0) / activeLengths.length
    : 2;
  const chordCount = activeStep >= 0 ? composition.filter((item) => item.step === activeStep).length : analysis.chordSteps;
  const colors = getMoodSphereColors(analysis, averageLength, chordCount);
  const motion = getReactiveCircleMotion(analysis);

  return { colors, motion };
}

function renderMoodBlob(analysis, activeStep = -1) {
  if (!visualMarks.querySelector('.mark')) {
    visualMarks.innerHTML = '<span class="mark"></span>';
  }
  const blob = visualMarks.querySelector('.mark');
  const { colors, motion: visualMotion } = getMoodVisualState(analysis, activeStep);
  const [color, color2, color3, color4] = colors;

  const hasGlassSphere = blob.classList.contains('has-glass-sphere');

  blob.className = `mark mood-${analysis.paletteKey}${hasGlassSphere ? ' has-glass-sphere' : ''}`;
  blob.soundiSphereState = { colors, energy: analysis.energy, tension: analysis.tension };
  window.dispatchEvent(new CustomEvent('soundi:sphere-update', { detail: blob.soundiSphereState }));
  blob.style.setProperty('--x', '50%');
  blob.style.setProperty('--y', '34%');
  blob.style.setProperty('--w', '248px');
  blob.style.setProperty('--h', '248px');
  blob.style.setProperty('--rotate', '0deg');
  blob.style.setProperty('--opacity', '1');
  blob.style.setProperty('--pitch-level', analysis.pitchLevel);
  blob.style.setProperty('--mark-color', color);
  blob.style.setProperty('--mark-color-2', color2);
  blob.style.setProperty('--mark-color-3', color3);
  blob.style.setProperty('--mark-color-4', color4);
  blob.style.setProperty('--surface-duration', `${visualMotion.surfaceDuration}ms`);
  blob.style.setProperty('--shape-duration', `${visualMotion.shapeDuration}ms`);
  blob.style.setProperty('--pulse-duration', `${visualMotion.pulseDuration}ms`);
  blob.style.setProperty('--pulse-scale', visualMotion.pulseScale);
  blob.style.setProperty('--outline-a', `${visualMotion.outlineA}%`);
  blob.style.setProperty('--outline-b', `${visualMotion.outlineB}%`);
  blob.style.setProperty('--outline-c', `${visualMotion.outlineC}%`);
  blob.style.setProperty('--outline-d', `${visualMotion.outlineD}%`);
  blob.style.setProperty('--surface-blur', `${visualMotion.surfaceBlur}px`);
  blob.style.setProperty('--surface-saturate', visualMotion.surfaceSaturate);
}

function getReactiveCircleMotion(analysis) {
  if (analysis.isEmpty) {
    return {
      outlineA: 50,
      outlineB: 50,
      outlineC: 50,
      outlineD: 50,
      shapeDuration: 16000,
      surfaceDuration: 18000,
      surfaceBlur: 34,
      surfaceSaturate: '1.00',
      pulseDuration: 4200,
      pulseScale: '1.004'
    };
  }
  const outlineChange = clampMetric(analysis.tension * 0.5 + analysis.rhythmVariation * 0.28 + (1 - analysis.repetitionStrength) * 0.12);
  const surfaceActivity = clampMetric(analysis.rhythmDensity * 0.34 + analysis.rhythmVariation * 0.28 + analysis.energy * 0.26 + (1 - analysis.repetitionStrength) * 0.12);
  const pulseAmount = clampMetric(analysis.energy * 0.58 + analysis.rhythmDensity * 0.3 + analysis.shortNoteRatio * 0.12);
  return {
    outlineA: Math.round(49 + outlineChange * 7),
    outlineB: Math.round(51 - outlineChange * 6),
    outlineC: Math.round(50 + outlineChange * 5),
    outlineD: Math.round(50 - outlineChange * 4),
    shapeDuration: Math.round(13000 - outlineChange * 5600),
    surfaceDuration: Math.round(14500 - surfaceActivity * 7800),
    surfaceBlur: Math.round(32 - surfaceActivity * 10),
    surfaceSaturate: (1.08 + surfaceActivity * 0.34).toFixed(2),
    pulseDuration: Math.round(3400 - pulseAmount * 1650),
    pulseScale: (1.004 + pulseAmount * 0.028).toFixed(3)
  };
}

function clampMetric(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function getMoodSphereColors(analysis, sequenceLength, chordCount = 0) {
  const base = analysis.palette.sphere || analysis.palette.marks;
  if (chordCount >= 2) {
    return [
      mixHex(base[0], base[1], 0.18),
      mixHex(base[1], base[2], 0.24),
      mixHex(base[2], base[3] || '#ffffff', 0.2),
      mixHex(base[3] || '#ffffff', base[0], 0.18)
    ];
  }
  if (sequenceLength >= 4) {
    return [
      mixHex(base[0], '#ffffff', 0.08),
      base[1],
      mixHex(base[2], '#ffffff', 0.16),
      base[3] || '#ffffff'
    ];
  }
  return base;
}

function getMappedNoteColor(note, sequenceLength, analysis) {
  let color = note.color;
  if (note.octave <= 3) color = mixHex(color, '#0c0c0c', 0.34);
  if (note.octave >= 5) color = mixHex(color, '#ffffff', 0.28);
  if (sequenceLength >= 4) color = mixHex(color, analysis.palette.marks[1] || color, 0.2);
  return color;
}

function mixHex(hexA, hexB, amount) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mix = (from, to) => Math.round(from + (to - from) * amount);
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function renderMoodMetrics(analysis) {
  if (!moodMetrics) return;
  const metrics = getMoodMetricItems(analysis);
  const barCount = 6;
  const hasSignal = !analysis.isEmpty;
  moodMetrics.innerHTML = metrics.map((item) => `
    <section class="mood-metric" style="--metric:${item.percent}%">
      <div class="mood-meter" aria-hidden="true">
        ${Array.from({ length: barCount }, (_, index) => {
          const threshold = Math.round(((index + 1) / barCount) * 100);
          const isActive = hasSignal && item.percent >= threshold;
          return `<span class="${isActive ? 'is-active' : ''}"></span>`;
        }).join('')}
      </div>
      <strong>${item.title}</strong>
    </section>
  `).join('');
}

function getMoodMetricItems(analysis) {
  const pitchPercent = Math.round(clampMetric(analysis.pitchLevel) * 100);
  const rhythmPercent = Math.round(clampMetric(analysis.rhythmDensity) * 100);
  const lengthPercent = Math.round(clampMetric(analysis.noteLength) * 100);
  const repeatPercent = Math.round(clampMetric(analysis.repetitionStrength) * 100);
  const metric = (item) => item;
  if (currentLanguage === 'ko') {
    return [
      metric({ title: '높낮이', min: '낮음', max: '높음', value: `${pitchPercent}%`, percent: pitchPercent }),
      metric({ title: '리듬 밀도', min: '여백', max: '촘촘함', value: `${rhythmPercent}%`, percent: rhythmPercent }),
      metric({ title: '음길이', min: '짧음', max: '김', value: `${lengthPercent}%`, percent: lengthPercent }),
      metric({ title: '반복성', min: '변화', max: '반복', value: `${repeatPercent}%`, percent: repeatPercent })
    ];
  }
  return [
    metric({ title: 'Pitch', min: 'Low', max: 'High', value: `${pitchPercent}%`, percent: pitchPercent }),
    metric({ title: 'Rhythm Density', min: 'Spacious', max: 'Dense', value: `${rhythmPercent}%`, percent: rhythmPercent }),
    metric({ title: 'Note Length', min: 'Short', max: 'Long', value: `${lengthPercent}%`, percent: lengthPercent }),
    metric({ title: 'Repetition', min: 'Changing', max: 'Repeating', value: `${repeatPercent}%`, percent: repeatPercent })
  ];
}

function renderFeedback(analysis) {
  if (!feedbackCard) return;
  const ai = analysis.moodAI;
  const sentence = getConciseFeedbackSentence(analysis);
  const primary = ai?.primaryMood || 'warm';
  const secondary = ai?.secondaryMood || 'dreamy';
  const label = (mood) => window.SoundiMoodAI?.moodMeta?.[mood]?.label?.[currentLanguage] || mood;
  const scoreText = ai?.status === 'ready'
    ? `${Math.round((ai.primaryScore || 0) * 100)} / ${Math.round((ai.secondaryScore || 0) * 100)}`
    : currentLanguage === 'ko' ? '분석 대기' : 'Waiting';
  feedbackCard.innerHTML = `
    <strong>${currentLanguage === 'ko' ? '구조 기반 AI 피드백' : 'Structure-based AI feedback'}</strong>
    <p>${escapeHtml(sentence)}</p>
    <div class="feedback-mood-row">
      <span>${escapeHtml(label(primary))}</span>
      <span>${escapeHtml(label(secondary))}</span>
      <em>${scoreText}</em>
    </div>
  `;
}

function getConciseFeedbackSentence(analysis) {
  const ai = analysis?.moodAI;

  if (ai && window.SoundiMoodAI?.createFeedbackSentence) {
    return window.SoundiMoodAI.createFeedbackSentence(ai, currentLanguage);
  }

  if (!analysis || analysis.isEmpty) {
    return currentLanguage === 'ko'
      ? '블록을 조금 더 놓아보세요. 곡의 흐름이 보이면 어떤 분위기인지 알려드릴게요.'
      : 'Add a few more blocks. Once the flow takes shape, I will describe the mood it suggests.';
  }

  return currentLanguage === 'ko'
    ? '블록을 조금 더 놓아보세요. 곡의 흐름이 보이면 어떤 분위기인지 알려드릴게요.'
    : 'Add a few more blocks. Once the flow takes shape, I will describe the mood it suggests.';
}

function getRandomPromptExample(language = currentLanguage) {
  const examples = aiPromptExamples[language] || aiPromptExamples.ko;
  if (!examples.length) return '';
  if (examples.length === 1) return examples[0];
  let next = examples[Math.floor(Math.random() * examples.length)];
  if (next === lastPromptExample) {
    next = examples[(examples.indexOf(next) + 1) % examples.length];
  }
  lastPromptExample = next;
  return next;
}

function refreshIntentPromptPlaceholder() {
  if (!intentPrompt) return;
  intentPrompt.setAttribute('placeholder', getRandomPromptExample(currentLanguage));
}

function ensureAIPromptRequiredMarker() {
  const promptField = intentPrompt?.closest('.ai-field');
  const promptLabel = promptField?.querySelector('span');
  promptLabel?.classList.remove('is-required');
  promptField?.querySelectorAll('.required-badge').forEach(marker => marker.remove());
}

function getIntentPayload() {
  return {
    prompt: intentPrompt?.value.trim() || '',
    style: intentStyle?.value || '',
    direction: intentDirection?.value || ''
  };
}

function resizeIntentPrompt() {
  if (!intentPrompt) return;
  const computed = window.getComputedStyle(intentPrompt);
  const maxHeight = Number.parseFloat(computed.maxHeight) || 112;
  intentPrompt.style.height = 'auto';
  const nextHeight = Math.min(intentPrompt.scrollHeight, maxHeight);
  intentPrompt.style.height = `${nextHeight}px`;
  intentPrompt.style.overflowY = intentPrompt.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function validateAICoachForm(showMessage = false) {
  const intent = getIntentPayload();
  const tooLong = intent.prompt.length > 100;
  const hasPrompt = Boolean(intent.prompt);
  const hasMeaningfulPrompt = isMeaningfulIntentPrompt(intent.prompt);
  const hasCompositionIntent = hasClearCompositionIntent(intent.prompt);
  const hasBlocks = composition.length > 0;
  const promptField = intentPrompt?.closest('.ai-field');

  promptField?.classList.toggle('is-invalid', tooLong || (hasPrompt && (!hasMeaningfulPrompt || !hasCompositionIntent)));
  if (intentPromptError) {
    intentPromptError.textContent = tooLong
      ? (currentLanguage === 'ko' ? '작곡 의도는 100자 이내로 적어주세요.' : 'Keep the prompt within 100 characters.')
      : hasPrompt && !hasMeaningfulPrompt
        ? (currentLanguage === 'ko' ? '읽을 수 있는 작곡 의도로 적어주세요.' : 'Write a readable composition prompt.')
      : hasPrompt && !hasCompositionIntent
        ? (currentLanguage === 'ko' ? '만들고 싶은 곡의 분위기나 방향을 구체적으로 적어주세요.' : 'Describe the mood or direction of the music more clearly.')
      : '';
  }

  if (aiFormMessage) {
    aiFormMessage.textContent = '';
    if (showMessage && !hasPrompt) {
      aiFormMessage.textContent = currentLanguage === 'ko' ? '만들고 싶은 곡을 먼저 적어주세요.' : 'Add a composition prompt first.';
    } else if (showMessage && !hasMeaningfulPrompt) {
      aiFormMessage.textContent = currentLanguage === 'ko' ? '곡의 느낌을 문장으로 적어주세요.' : 'Describe the mood in a short sentence.';
    } else if (showMessage && !hasCompositionIntent) {
      aiFormMessage.textContent = currentLanguage === 'ko' ? '작곡하고 싶은 분위기나 방향을 알 수 없어요. 예: 조용한 피아노, 신나는 동요처럼 구체적으로 적어주세요.' : 'I cannot tell the music direction yet. Try something like “quiet piano” or “bright children’s song.”';
    } else if (showMessage && !hasBlocks) {
      aiFormMessage.textContent = currentLanguage === 'ko' ? '블록을 먼저 놓아주세요.' : 'Add at least one block first.';
    }
  }

  return hasPrompt && hasMeaningfulPrompt && hasCompositionIntent && hasBlocks && !tooLong;
}

function isMeaningfulIntentPrompt(prompt) {
  const normalized = String(prompt || '').trim().replace(/\s+/g, '');
  if (!normalized) return false;
  if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(normalized)) return false;
  if (/^(.)\1{1,}$/.test(normalized)) return false;
  const koreanSyllables = normalized.match(/[가-힣]/g) || [];
  const latinLetters = normalized.match(/[a-zA-Z]/g) || [];
  const numbers = normalized.match(/\d/g) || [];
  if (koreanSyllables.length >= 2) return true;
  if (latinLetters.length >= 3) return true;
  return koreanSyllables.length + latinLetters.length + numbers.length >= 4;
}

function hasClearCompositionIntent(prompt) {
  const normalized = String(prompt || '').toLowerCase();
  const compact = normalized.replace(/\s+/g, '');
  const intentWords = [
    '음악', '곡', '작곡', '노래', '멜로디', '선율', '리듬', '박자', '화음', '코드', '피아노', '기타', '악기', '동요', '발라드', '클래식', 'ost', '어쿠스틱',
    '분위기', '느낌', '감정', '밝', '신나', '기쁜', '즐거', '차분', '조용', '잔잔', '고요', '편안', '따뜻', '슬픈', '우울', '외로운', '긴장', '불안', '무서', '공포', '몽환', '신비', '꿈', '밤', '비', '바다', '숲',
    'music', 'song', 'compose', 'composition', 'melody', 'rhythm', 'beat', 'harmony', 'chord', 'piano', 'guitar', 'instrument', 'children', 'ballad', 'classical', 'soundtrack', 'acoustic',
    'mood', 'feeling', 'bright', 'happy', 'joy', 'calm', 'quiet', 'soft', 'warm', 'sad', 'lonely', 'tense', 'tension', 'scary', 'dark', 'dreamy', 'mystery', 'night', 'rain'
  ];
  return intentWords.some((word) => compact.includes(word));
}

function clearAICoachFormMessage() {
  resizeIntentPrompt();
  if (aiFormMessage) aiFormMessage.textContent = '';
  validateAICoachForm(false);
}

function initCustomSelects() {
  aiNativeSelects.forEach((select) => {
    if (select.dataset.enhanced === 'true') return;
    select.dataset.enhanced = 'true';
    select.classList.add('native-select');
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    const button = document.createElement('button');
    button.className = 'custom-select-button';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    Array.from(select.options).forEach((option) => {
      if (option.disabled) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.textContent = option.textContent;
      menu.appendChild(item);
    });

    select.after(wrapper);
    wrapper.append(button, menu);
    syncCustomSelect(select);

    button.addEventListener('click', () => toggleCustomSelect(select));
    menu.addEventListener('click', (event) => {
      const item = event.target.closest('.custom-select-option');
      if (!item) return;
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeCustomSelect(select);
      syncCustomSelect(select);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openCustomSelect(select);
    });
    select.addEventListener('change', () => syncCustomSelect(select));
  });
}

function getCustomSelectParts(select) {
  const wrapper = select?.nextElementSibling?.classList?.contains('custom-select') ? select.nextElementSibling : null;
  return {
    wrapper,
    button: wrapper?.querySelector('.custom-select-button'),
    menu: wrapper?.querySelector('.custom-select-menu')
  };
}

function syncCustomSelect(select) {
  const { button, menu } = getCustomSelectParts(select);
  if (!button || !menu) return;
  const selected = select.options[select.selectedIndex];
  button.textContent = selected?.textContent || '';
  button.classList.toggle('is-placeholder', !select.value);
  menu.querySelectorAll('.custom-select-option').forEach((item) => {
    const isSelected = item.dataset.value === select.value;
    item.classList.toggle('is-selected', isSelected);
    item.setAttribute('aria-selected', String(isSelected));
  });
}

function rebuildCustomSelectMenu(select) {
  const { menu } = getCustomSelectParts(select);
  if (!menu) return;
  menu.replaceChildren();
  Array.from(select.options).forEach((option) => {
    if (option.disabled) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'custom-select-option';
    item.dataset.value = option.value;
    item.setAttribute('role', 'option');
    item.textContent = option.textContent;
    menu.appendChild(item);
  });
}

function localizeSelectOptions() {
  aiNativeSelects.forEach((select) => {
    Array.from(select.options).forEach((option) => {
      const label = currentLanguage === 'ko' ? option.dataset.labelKo : option.dataset.labelEn;
      if (label) option.textContent = label;
    });
    rebuildCustomSelectMenu(select);
    syncCustomSelect(select);
  });
}

function openCustomSelect(select) {
  aiNativeSelects.forEach((item) => {
    if (item !== select) closeCustomSelect(item);
  });
  const { wrapper, button, menu } = getCustomSelectParts(select);
  if (!wrapper || !button || !menu) return;
  wrapper.classList.add('is-open');
  button.setAttribute('aria-expanded', 'true');
  menu.hidden = false;
}

function closeCustomSelect(select) {
  const { wrapper, button, menu } = getCustomSelectParts(select);
  if (!wrapper || !button || !menu) return;
  wrapper.classList.remove('is-open');
  button.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
}

function toggleCustomSelect(select) {
  const { wrapper } = getCustomSelectParts(select);
  if (wrapper?.classList.contains('is-open')) closeCustomSelect(select);
  else openCustomSelect(select);
}

function closeAllCustomSelects() {
  aiNativeSelects.forEach(closeCustomSelect);
}

function createCoachPayload(analysis) {
  const features = analysis.moodAI?.features || {};
  const vat = {
    valence: roundMetric((analysis.brightness - 0.5) * 2),
    arousal: roundMetric((analysis.energy - 0.5) * 2),
    tension: roundMetric((analysis.tension - 0.5) * 2)
  };
  const blockFeatures = {
    pitchHeight: roundMetric(features.averagePitch || analysis.pitchLevel),
    blockLength: roundMetric(features.averageDuration || analysis.noteLength),
    rhythmDensity: roundMetric(features.rhythmicDensity || analysis.rhythmDensity),
    repetition: roundMetric(features.repetitionStrength || analysis.repetitionStrength),
    regularity: roundMetric(1 - (features.rhythmVariation || analysis.rhythmVariation || 0)),
    pitchMotion: roundMetric(features.overallChange || 0),
    harmonyStability: roundMetric(1 - Math.max(features.dissonance || 0, features.tension || analysis.tension || 0))
  };
  return {
    language: currentLanguage,
    intent: getIntentPayload(),
    vat,
    blockFeatures,
    composition: {
      title: compositionTitle,
      stepCount: STEP_COUNT,
      noteCount: features.noteCount || composition.length,
      blockCount: features.blockCount || composition.length,
      activeStepCount: features.activeStepCount || analysis.activeSteps.length,
      primaryMood: analysis.moodAI?.primaryMood || analysis.paletteKey,
      secondaryMood: analysis.moodAI?.secondaryMood || '',
      energy: roundMetric(analysis.energy),
      tension: roundMetric(analysis.tension),
      brightness: roundMetric(analysis.brightness),
      density: roundMetric(analysis.density),
      highRatio: roundMetric(analysis.highRatio),
      lowRatio: roundMetric(analysis.lowRatio),
      chordRatio: roundMetric(analysis.chordRatio),
      repetitionStrength: roundMetric(features.repetitionStrength || 0),
      longNoteRatio: roundMetric(features.longNoteRatio || 0),
      shortNoteRatio: roundMetric(features.shortNoteRatio || 0),
      rhythmVariation: roundMetric(features.rhythmVariation || 0),
      reasons: analysis.moodAI?.reasons || []
    }
  };
}

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getIntentLabels(intent) {
  const maps = {
    style: {
      children: { ko: '동요', en: 'Children’s music' },
      ballad: { ko: '발라드', en: 'Ballad' },
      classical: { ko: '클래식', en: 'Classical' },
      soundtrack: { ko: 'OST', en: 'Soundtrack' },
      acoustic: { ko: '어쿠스틱', en: 'Acoustic' }
    },
    direction: {
      startFresh: { ko: '새로 만들기', en: 'Start fresh' },
      reduce: { ko: '덜어내기', en: 'Reduce' },
      richer: { ko: '풍성하게', en: 'Richer' },
      rhythm: { ko: '리듬 강조', en: 'Emphasize rhythm' }
    },
    mood: {
      joy: { ko: '밝은', en: 'bright' },
      calm: { ko: '차분한', en: 'calm' },
      sadness: { ko: '느린', en: 'slow' },
      tension: { ko: '긴장감 있는', en: 'tense' },
      mystery: { ko: '몽환적인', en: 'dreamy' },
      balanced: { ko: '균형 있는', en: 'balanced' }
    }
  };
  return {
    style: localized(maps.style[intent.style]) || '',
    direction: localized(maps.direction[intent.direction]) || '',
    mood: localized(maps.mood[intent.promptMode]) || localized(maps.mood.balanced)
  };
}




function getDesiredMusicSubject(intent) {
  const prompt = String(intent?.prompt || '').toLowerCase();
  const style = String(intent?.style || '').toLowerCase();
  const source = `${prompt} ${style}`;

  const subjects = [
    { words: ['재즈', 'jazz'], ko: '재즈 음악', en: 'Jazz music' },
    { words: ['클래식', 'classical'], ko: '클래식 음악', en: 'Classical music' },
    { words: ['발라드', 'ballad'], ko: '발라드', en: 'A ballad' },
    { words: ['동요', 'children'], ko: '동요', en: 'Children’s music' },
    { words: ['ost', '사운드트랙', 'soundtrack'], ko: 'OST 음악', en: 'Soundtrack music' },
    { words: ['어쿠스틱', 'acoustic'], ko: '어쿠스틱 음악', en: 'Acoustic music' },
    { words: ['피아노', 'piano'], ko: '피아노 중심의 곡', en: 'A piano-led piece' }
  ];

  const matched = subjects.find(item => item.words.some(word => source.includes(word)));
  if (matched) return currentLanguage === 'en' ? matched.en : matched.ko;
  return currentLanguage === 'en' ? 'The music you want to make' : '만들고 싶은 곡';
}

function describeDesiredComposition(intent) {
  const targetVAT = getTargetVATForIntent(intent);
  const subject = getDesiredMusicSubject(intent);

  if (!targetVAT) {
    return currentLanguage === 'en'
      ? [`${subject} is interpreted from your own wording rather than forced into one fixed mood.`, 'Soundi therefore explains the direction through visible block placement such as height, length, spacing, and stacking.']
      : [`${subject}은 사용자가 적은 표현을 하나의 분위기로 단정하지 않고 그대로 방향으로 해석해요.`, '그래서 화면에서 확인할 수 있는 블록의 높이, 길이, 간격, 겹침을 기준으로 배치 방향을 설명해요.'];
  }

  const parts = [];
  if (currentLanguage === 'en') {
    if (targetVAT.arousal <= 0.32) parts.push(`${subject} tends to feel spacious and unhurried. On the grid, longer blocks with wider gaps usually support that flow.`);
    else if (targetVAT.arousal >= 0.65) parts.push(`${subject} tends to feel active and forward-moving. On the grid, shorter blocks placed more frequently usually make the rhythm feel more active.`);
    else parts.push(`${subject} tends to keep a moderate pace. Mixing long and short blocks without making the spacing too dense usually keeps the flow balanced.`);

    if (targetVAT.valence >= 0.68) parts.push('Placing more blocks in the middle-to-upper rows can make the melodic direction feel lighter and clearer.');
    else if (targetVAT.valence <= 0.32) parts.push('Placing more blocks in the middle-to-lower rows and extending their lengths can make the melodic direction feel more grounded and subdued.');
    else parts.push('Keeping most blocks around the middle rows without pushing too far upward or downward helps preserve the emotional center.');

    if (targetVAT.tension >= 0.62) parts.push('For stronger harmonic tension, place supporting blocks close together on the same vertical line so several notes sound at once.');
    else if (targetVAT.tension <= 0.28) parts.push('For a more open and stable harmony, use fewer blocks on the same vertical line and keep simultaneous stacks simple.');
    else parts.push('For moderate harmonic color, stack supporting blocks only at selected moments rather than throughout the whole grid.');
  } else {
    if (targetVAT.arousal <= 0.32) parts.push(`${subject}은 움직임이 크지 않고 여백이 느껴지는 흐름이 잘 어울려요. 화면에서는 긴 블록을 중심으로 두고 블록 사이 간격을 넉넉하게 배치하는 편이에요.`);
    else if (targetVAT.arousal >= 0.65) parts.push(`${subject}은 리듬이 자주 움직이며 앞으로 나아가는 흐름이 잘 어울려요. 화면에서는 짧은 블록을 비교적 자주 놓고 블록 사이 간격을 촘촘하게 배치하는 편이에요.`);
    else parts.push(`${subject}은 너무 빠르거나 느리지 않은 흐름이 잘 어울려요. 화면에서는 긴 블록과 짧은 블록을 섞되 간격이 한쪽으로 치우치지 않게 배치하는 편이에요.`);

    if (targetVAT.valence >= 0.68) parts.push('선율은 화면의 중간 · 높은 위치에 블록을 조금 더 배치하면 가볍고 맑은 방향을 만들기 쉬워요.');
    else if (targetVAT.valence <= 0.32) parts.push('선율은 화면의 중간 · 낮은 위치에 블록의 비중을 늘리고 길이를 길게 잡으면 더 가라앉은 방향을 만들기 쉬워요.');
    else parts.push('선율은 화면의 중간 위치를 중심으로 블록을 배치하고, 위아래로 지나치게 치우치지 않게 두면 분위기의 중심을 유지하기 좋아요.');

    if (targetVAT.tension >= 0.62) parts.push('화음의 긴장감을 높이고 싶다면 같은 세로선에 가까운 위치의 블록을 함께 놓아 여러 블록이 동시에 보이도록 쌓는 방식이 잘 어울려요.');
    else if (targetVAT.tension <= 0.28) parts.push('화음을 더 열려 있고 안정적으로 만들고 싶다면 같은 세로선에 겹치는 블록 수를 줄이고 단순하게 쌓는 편이 좋아요.');
    else parts.push('화음의 색을 적당히 더하고 싶다면 필요한 구간에서만 같은 세로선에 보조 블록을 추가해 부분적으로 겹쳐 배치하는 편이 좋아요.');
  }

  return parts;
}

function createCoachDiagnosis(intent, summary) {
  const currentParts = [];
  const targetVAT = getTargetVATForIntent(intent);
  const editPlan = [];
  const highLed = summary.highRatio > summary.lowRatio + 0.12;
  const lowLed = summary.lowRatio > summary.highRatio + 0.12;
  const shortLed = summary.shortNoteRatio > summary.longNoteRatio + 0.08;
  const longLed = summary.longNoteRatio > summary.shortNoteRatio + 0.08;
  const dense = summary.density > 0.48;
  const sparse = summary.density < 0.28;
  const chordLight = summary.chordRatio < 0.22;
  const repetitive = summary.repetitionStrength > 0.58;

  if (currentLanguage === 'en') {
    currentParts.push(highLed ? 'The melody is concentrated in the upper register.' : lowLed ? 'The melody is concentrated in the lower register.' : 'The pitch range is centered around the middle register.');
    currentParts.push(shortLed ? 'Short notes make the rhythm move quickly.' : longLed ? 'Long notes make the flow feel sustained.' : 'Short and long notes are used in a fairly balanced way.');
    if (dense) currentParts.push('Notes appear frequently, so the texture is relatively dense.');
    else if (sparse) currentParts.push('There is a lot of space between notes, so the texture is sparse.');
    else currentParts.push('The note density is moderate.');
  } else {
    currentParts.push(highLed ? '현재 곡은 높은 음역의 비중이 커서 선율이 위쪽에 집중되어 있어요.' : lowLed ? '현재 곡은 낮은 음역의 비중이 커서 선율이 아래쪽에 집중되어 있어요.' : '현재 곡은 중간 음역을 중심으로 높낮이가 비교적 고르게 분포되어 있어요.');
    currentParts.push(shortLed ? '짧은 음의 비율이 높아 리듬이 빠르게 움직이는 편이에요.' : longLed ? '긴 음의 비율이 높아 한 음이 오래 이어지는 흐름이에요.' : '짧은 음과 긴 음의 비율이 비교적 균형을 이루고 있어요.');
    if (dense) currentParts.push('블록이 촘촘하게 배치되어 음의 밀도가 높은 편이에요.');
    else if (sparse) currentParts.push('블록 사이의 여백이 많아 음의 밀도가 낮은 편이에요.');
    else currentParts.push('블록의 밀도는 중간 정도예요.');
  }

  const addPlan = (ko, en) => editPlan.push(currentLanguage === 'en' ? en : ko);

  if (intent.direction === 'reduce') {
    addPlan('겹치거나 반복되는 블록 덜어내기', 'Remove some repeated or overlapping blocks to create more space.');
    addPlan('보조적으로 반복되는 음부터 줄이기', 'Keep the main melodic line and reduce secondary repetitions first.');
  } else if (intent.direction === 'rhythm') {
    addPlan('짧은 음을 일정한 간격으로 추가하기', 'Add short notes at regular intervals to make the beat clearer.');
    addPlan('긴 음 사이에 짧은 음 배치하기', 'Place short notes between longer notes to create rhythmic contrast.');
  } else if (intent.direction === 'richer') {
    addPlan('같은 시점에 보조음을 더해 화음 쌓기', 'Keep the main line and add supporting notes at the same moments to build harmonic layers.');
    if (chordLight) addPlan('일부 구간에 3화음이나 보조음 추가하기', 'Because simultaneous notes are limited, add triads or supporting tones in selected sections.');
  } else if (intent.direction === 'startFresh') {
    addPlan('원하는 분위기의 짧은 기본 프레이즈부터 새로 만들기', 'Instead of editing the current blocks, start with a short phrase that matches the intended mood.');
  }

  if (!intent.direction || intent.direction === 'startFresh') {
    if (intent.promptMode === 'joy') {
      if (!highLed) addPlan('중간 · 높은 위치의 블록 늘리기', 'Add more mid-to-high notes to move the melodic center upward.');
      if (!shortLed) addPlan('긴 블록 일부를 짧은 블록으로 나누기', 'Split some longer notes into shorter notes to increase motion.');
      if (sparse) addPlan('빈 칸에 짧은 블록 추가하기', 'Add short notes in empty beats to slightly increase rhythmic density.');
    } else if (intent.promptMode === 'calm') {
      if (highLed) addPlan('위쪽 블록 일부를 중간 · 낮은 위치로 내리기', 'Move some high notes into the mid-to-low register to reduce brightness.');
      if (shortLed) addPlan('짧은 블록 일부를 길게 이어주기', 'Connect some short notes into longer sustained phrases.');
      if (dense) addPlan('연속된 블록을 덜어내 음 사이 여백 만들기', 'Remove some consecutive blocks to create more space between notes.');
    } else if (intent.promptMode === 'sadness') {
      if (!lowLed) addPlan('중간 · 낮은 위치의 블록 늘리기', 'Increase the lower register so the melodic center moves downward.');
      if (!longLed) addPlan('블록 길이를 늘려 지속되는 흐름 만들기', 'Lengthen notes to favor sustained motion over quick movement.');
      addPlan('반복되는 핵심 음을 남겨 중심 만들기', 'Keep a repeated anchor note to give the melody a consistent center.');
    } else if (intent.promptMode === 'tension') {
      addPlan('같은 세로선에 가까운 위치의 보조 블록 추가하기', 'Add nearby supporting tones around existing harmony to increase tension.');
      if (repetitive) addPlan('반복 간격 일부 어긋나게 만들기', 'Offset some repeated intervals to make the pattern less predictable.');
      else addPlan('짧은 음을 불규칙한 위치에 배치하기', 'Place short notes at irregular positions to reduce rhythmic stability.');
    } else if (intent.promptMode === 'mystery') {
      addPlan('중간 위치 사이에 위쪽 블록을 드문 간격으로 추가하기', 'Keep the middle register and add occasional high notes for register contrast.');
      addPlan('일부 음만 남겨 느슨한 반복 만들기', 'Use partial rather than exact repetition to create a looser recurring pattern.');
    } else if (intent.promptMode === 'unknown') {
      addPlan('현재 곡의 음역·리듬·밀도를 중심으로 정리하기', 'The emotional direction is not clearly classified, so the edit plan focuses on the current musical structure.');
    } else {
      addPlan('현재 음역을 유지하며 리듬과 화음 배치 정리하기', 'Keep the current register while refining rhythm spacing and chord placement for balance.');
    }
  }

  if (targetVAT && editPlan.length < 3) {
    const candidates = [];
    if (targetVAT.arousal >= summary.energy + 0.15) {
      candidates.push([ '짧은 블록을 늘리고 블록 사이 간격 좁히기', 'Use more short notes and tighter spacing to increase movement.' ]);
    } else if (targetVAT.arousal <= summary.energy - 0.15) {
      candidates.push([ '일부 블록을 길게 이어주고 블록 사이 여백 늘리기', 'Lengthen some notes and add more space between blocks to reduce movement.' ]);
    }
    if (targetVAT.tension >= summary.tension + 0.15) {
      candidates.push([ '가까운 음정의 보조음 더하기', 'Add nearby supporting tones to increase harmonic tension.' ]);
    } else if (targetVAT.tension <= summary.tension - 0.15) {
      candidates.push([ '같은 세로선에 쌓이는 블록 수 줄이기', 'Simplify simultaneous notes to reduce harmonic friction and tension.' ]);
    }
    candidates.forEach(([ko, en]) => {
      if (editPlan.length < 3) addPlan(ko, en);
    });
  }
  const gapAnalysis = describeDesiredComposition(intent);

  return {
    currentState: currentParts.join(' '),
    gapAnalysis,
    editPlan: editPlan.slice(0, 3),
    editSummary: currentLanguage === 'en'
      ? 'These edits will be converted into concrete block additions and removals. Review the plan, then apply it.'
      : '위 방향을 실제 블록의 추가·삭제 위치로 변환해 두었어요. 내용을 확인한 뒤 수정하기를 누르면 적용돼요.'
  };
}

function describeCoachGap(intent, summary, language = 'ko') {
  const highLed = summary.highRatio > summary.lowRatio + 0.12;
  const lowLed = summary.lowRatio > summary.highRatio + 0.12;
  const shortLed = summary.shortNoteRatio > summary.longNoteRatio + 0.08;
  const longLed = summary.longNoteRatio > summary.shortNoteRatio + 0.08;
  const dense = summary.density > 0.48;
  const sparse = summary.density < 0.28;
  let ko = '음역과 리듬';
  let en = 'pitch range and rhythm';

  if (intent.direction === 'reduce') {
    ko = dense ? '블록 밀도와 반복량' : '반복되는 블록의 양';
    en = dense ? 'block density and repetition' : 'the amount of repeated material';
  } else if (intent.direction === 'richer') {
    ko = summary.chordRatio < 0.22 ? '동시에 쌓이는 음과 화음의 밀도' : '보조음의 배치';
    en = summary.chordRatio < 0.22 ? 'simultaneous notes and harmonic density' : 'the placement of supporting tones';
  } else if (intent.direction === 'rhythm') {
    ko = '음의 길이와 박 사이의 간격';
    en = 'note length and spacing between beats';
  } else if (intent.promptMode === 'joy') {
    ko = lowLed || longLed || sparse ? '음역의 높이, 음의 길이, 리듬 밀도' : '리듬의 추진력';
    en = lowLed || longLed || sparse ? 'register height, note length, and rhythmic density' : 'rhythmic drive';
  } else if (intent.promptMode === 'calm') {
    ko = highLed || shortLed || dense ? '높은 음의 비율, 짧은 음의 양, 블록 밀도' : '음 사이의 여백';
    en = highLed || shortLed || dense ? 'the amount of high notes, short notes, and block density' : 'space between notes';
  } else if (intent.promptMode === 'sadness') {
    ko = !lowLed || !longLed ? '낮은 음역의 비중과 음의 지속시간' : '선율의 반복 중심';
    en = !lowLed || !longLed ? 'lower-register weight and note duration' : 'the repeated melodic anchor';
  } else if (intent.promptMode === 'tension') {
    ko = '화음의 긴장도와 리듬의 규칙성';
    en = 'harmonic tension and rhythmic regularity';
  } else if (intent.promptMode === 'mystery') {
    ko = '음역 대비와 반복 패턴의 규칙성';
    en = 'register contrast and repetition regularity';
  }
  return language === 'en' ? en : ko;
}

function createLocalCoachFeedback(payload) {
  const { intent, composition: summary } = payload;
  const effectiveIntent = getEffectiveIntent(intent);
  const diagnosis = createCoachDiagnosis(effectiveIntent, summary);
  const operations = createLocalEditOperations(effectiveIntent, summary);

  return {
    source: 'local',
    summary: diagnosis.currentState,
    gapAnalysis: diagnosis.gapAnalysis,
    editPlan: diagnosis.editPlan,
    editSummary: diagnosis.editSummary,
    operations,
    visualDirection: {
      shape: summary.tension > 0.45 ? '조금 날카로운 유기적 형태' : '둥글게 흔들리는 유기적 형태',
      color: getVisualColorSuggestion(effectiveIntent, summary),
      motion: summary.energy > 0.55 ? '빠르게 튀는 움직임' : '천천히 번지는 움직임'
    }
  };
}


function inferTargetVAT(prompt) {
  const text = String(prompt || '').toLowerCase().trim();
  if (!text) return null;

  const groups = [
    { name: 'calm', words: ['고즈넉', '고요', '잔잔', '차분', '평온', '편안', '포근', '정적', 'serene', 'peaceful', 'quiet', 'calm', 'soft'], vat: { valence: 0.65, arousal: 0.20, tension: 0.15 } },
    { name: 'joy', words: ['밝', '경쾌', '신나', '즐거', '활기', '설레', '상쾌', 'happy', 'joy', 'bright', 'cheerful', 'upbeat'], vat: { valence: 0.85, arousal: 0.75, tension: 0.20 } },
    { name: 'sadness', words: ['슬프', '쓸쓸', '외롭', '우울', '애잔', '허전', 'sad', 'lonely', 'melancholy'], vat: { valence: 0.20, arousal: 0.25, tension: 0.20 } },
    { name: 'tension', words: ['불안', '긴장', '초조', '위태', '긴박', '날카', '불길', 'anxious', 'tense', 'urgent', 'uneasy'], vat: { valence: 0.20, arousal: 0.75, tension: 0.85 } },
    { name: 'mystery', words: ['몽환', '신비', '미스터리', '오묘', '낯선', 'dreamy', 'mysterious', 'ethereal'], vat: { valence: 0.50, arousal: 0.35, tension: 0.50 } },
    { name: 'warm', words: ['따뜻', '다정', '포근', 'warm', 'gentle'], vat: { valence: 0.80, arousal: 0.30, tension: 0.12 } },
    { name: 'excitement', words: ['벅찬', '벅차', '웅장', '고조', '감격', 'emotional', 'uplifting', 'epic'], vat: { valence: 0.78, arousal: 0.72, tension: 0.45 } }
  ];

  const matched = groups.filter(group => group.words.some(word => text.includes(word)));
  if (!matched.length) return null;
  const average = key => Math.max(0, Math.min(1, matched.reduce((sum, group) => sum + group.vat[key], 0) / matched.length));
  return {
    valence: average('valence'),
    arousal: average('arousal'),
    tension: average('tension'),
    matched: matched.map(group => group.name)
  };
}

function getTargetVATForIntent(intent) {
  if (intent?.targetVAT) return intent.targetVAT;
  const fallbacks = {
    joy: { valence: 0.85, arousal: 0.75, tension: 0.20 },
    calm: { valence: 0.65, arousal: 0.20, tension: 0.15 },
    sadness: { valence: 0.20, arousal: 0.25, tension: 0.20 },
    tension: { valence: 0.20, arousal: 0.75, tension: 0.85 },
    mystery: { valence: 0.50, arousal: 0.35, tension: 0.50 }
  };
  return fallbacks[intent?.promptMode] || null;
}

function getEffectiveIntent(intent) {
  const prompt = (intent.prompt || '').toLowerCase();
  const includesAny = (words) => words.some((word) => prompt.includes(word));
  const next = {
    ...intent,
    style: intent.style || '',
    direction: intent.direction || '',
    promptMode: 'balanced'
  };

  if (next.style === 'children') next.promptMode = 'joy';
  if (next.style === 'ballad' || next.style === 'acoustic') next.promptMode = 'calm';
  if (next.style === 'soundtrack') next.promptMode = 'mystery';

  if (includesAny(['조용', '차분', '잔잔', '고요', '고즈넉', '평온', '편안', '포근', '정적', '비', 'rain', 'quiet', 'calm', 'soft', 'peaceful', 'serene'])) next.promptMode = 'calm';
  if (includesAny(['잠', '수면', '밤', 'sleep', 'night'])) next.promptMode = 'calm';
  if (includesAny(['슬픈', '슬픔', '외로운', '우울', 'sad', 'lonely', 'blue'])) next.promptMode = 'sadness';
  if (includesAny(['긴장', '불안', '무서', '공포', '위험', 'tension', 'scary', 'dark'])) next.promptMode = 'tension';
  if (includesAny(['몽환', '신비', '우주', '꿈', 'mystery', 'dream', 'space'])) next.promptMode = 'mystery';
  if (includesAny(['신나는', '밝은', '기쁜', '활기', '빠른', '통통', 'dance', 'happy', 'bright', 'fast'])) next.promptMode = 'joy';

  next.targetVAT = inferTargetVAT(prompt);
  if (!next.targetVAT && !next.promptMode) next.promptMode = 'unknown';
  return next;
}

function createLocalEditOperations(intent, summary) {
  if (isExampleMode || isArchivePreviewMode || isPublishedLocked) return [];
  if (!composition.length || intent.direction === 'startFresh') return createSeedOperations(intent);
  const operations = [];
  const occupied = new Set(composition.map((item) => getGridCellKey(item.noteId, item.step)));
  const activeSteps = [...new Set(composition.map((item) => item.step))].sort((a, b) => a - b);
  const add = (noteId, step, length = 1) => {
    for (let offset = 0; offset < length; offset += 1) {
      const nextStep = step + offset;
      const key = getGridCellKey(noteId, nextStep);
      if (nextStep < 0 || nextStep >= STEP_COUNT || occupied.has(key)) continue;
      occupied.add(key);
      operations.push({ type: 'add', noteId, step: nextStep });
    }
  };
  const remove = (item) => {
    if (!item) return;
    operations.push({ type: 'remove', noteId: item.noteId, step: item.step });
    occupied.delete(getGridCellKey(item.noteId, item.step));
  };
  const fallbackStep = activeSteps[0] ?? 0;

  if (intent.direction === 'reduce') {
    composition
      .slice()
      .sort((a, b) => b.step - a.step)
      .filter((_, index) => index % 2 === 0)
      .slice(0, 8)
      .forEach(remove);
    return operations.slice(0, 18);
  }

  if (intent.direction === 'rhythm') {
    [0, 4, 8, 12].forEach((offset) => add('do4', Math.min(STEP_COUNT - 1, fallbackStep + offset), 1));
    [2, 10].forEach((offset) => add(intent.promptMode === 'joy' ? 'sol4' : 'mi4', Math.min(STEP_COUNT - 1, fallbackStep + offset), 1));
    return operations.slice(0, 18);
  }

  if (intent.direction === 'richer') {
    add('do4', Math.max(0, fallbackStep), 3);
    add(intent.promptMode === 'sadness' ? 'la3' : 'mi4', Math.min(STEP_COUNT - 4, fallbackStep + 6), 4);
    add(intent.promptMode === 'tension' ? 'si4' : 'sol4', Math.min(STEP_COUNT - 3, fallbackStep + 12), 3);
    if (summary.chordRatio < 0.25) add(intent.promptMode === 'joy' ? 'do5' : 'mi5', Math.min(STEP_COUNT - 2, fallbackStep + 16), 2);
    return operations.slice(0, 18);
  }

  if (intent.promptMode === 'calm' || intent.promptMode === 'sadness') {
    add(intent.promptMode === 'sadness' ? 'la3' : 'do4', Math.max(0, fallbackStep), 3);
    add(intent.promptMode === 'sadness' ? 'mi3' : 'sol3', Math.min(STEP_COUNT - 4, fallbackStep + 8), 4);
  } else if (intent.promptMode === 'tension') {
    activeSteps.slice(0, 3).forEach((step) => add('si4', step + 1, 1));
    add('fa5', Math.min(STEP_COUNT - 1, fallbackStep + 6), 1);
  } else if (intent.promptMode === 'mystery') {
    add('la4', Math.min(STEP_COUNT - 2, fallbackStep + 2), 2);
    add('si4', Math.min(STEP_COUNT - 1, fallbackStep + 7), 1);
    if (summary.repetitionStrength < 0.45) add('mi5', Math.min(STEP_COUNT - 2, fallbackStep + 12), 2);
  } else {
    add('do5', Math.min(STEP_COUNT - 1, fallbackStep + 2), 1);
    add('mi5', Math.min(STEP_COUNT - 1, fallbackStep + 4), 1);
    add('sol5', Math.min(STEP_COUNT - 1, fallbackStep + 6), 1);
  }
  return operations.slice(0, 18);
}

function createSeedOperations(intent) {
  const moodSeeds = {
    calm: [['do4', 0, 4], ['mi4', 6, 4], ['sol4', 12, 5], ['do4', 20, 6]],
    sadness: [['la3', 0, 5], ['do4', 7, 4], ['mi4', 14, 5], ['la3', 24, 6]],
    mystery: [['mi4', 0, 3], ['la4', 5, 4], ['si4', 12, 2], ['mi5', 20, 4]],
    tension: [['fa4', 0, 2], ['si4', 3, 1], ['mi5', 6, 2], ['fa5', 12, 1]],
    joy: [['do4', 0, 1], ['mi4', 2, 1], ['sol4', 4, 1], ['do5', 8, 2], ['sol4', 12, 1]],
    balanced: [['do4', 0, 2], ['mi4', 4, 2], ['sol4', 8, 3], ['mi4', 14, 2], ['do4', 20, 4]]
  };
  const styleSeeds = {
    children: moodSeeds.joy,
    ballad: moodSeeds.calm,
    classical: moodSeeds.balanced,
    soundtrack: moodSeeds.mystery,
    acoustic: moodSeeds.calm
  };
  const seed = styleSeeds[intent.style] || moodSeeds[intent.promptMode] || moodSeeds.balanced;
  return seed.flatMap(([noteId, step, length]) => Array.from({ length }, (_, offset) => ({
    type: 'add',
    noteId,
    step: step + offset
  }))).slice(0, 18);
}

function getEditSummary(operations, intent) {
  if (!operations.length) return '';
  const labels = getIntentLabels(intent);
  const mood = labels.mood;
  if (currentLanguage === 'en') {
    if (intent.direction === 'reduce') return `Leave more space so the ${mood} mood reads more clearly.`;
    if (intent.direction === 'rhythm') return `Place short notes at regular intervals so the rhythm feels more intentional.`;
    if (intent.direction === 'richer') return `Layer a few supporting notes around the main line so the ${mood} mood feels fuller.`;
    if (intent.direction === 'startFresh') return `Start with a simple ${mood} phrase, then extend it after the shape feels clear.`;
    return `Adjust the pitch range and rhythm spacing so the ${mood} intention is easier to read.`;
  }
  if (intent.direction === 'reduce') return `여백을 더 남기면 ${mood} 분위기가 더 또렷하게 읽혀요.`;
  if (intent.direction === 'rhythm') return `짧은 음을 일정한 간격으로 놓으면 리듬 의도가 더 분명해져요.`;
  if (intent.direction === 'richer') return `중심 선율 주변에 받쳐주는 음을 더하면 ${mood} 분위기가 더 풍성해져요.`;
  if (intent.direction === 'startFresh') return `먼저 단순한 ${mood} 흐름을 만들고, 형태가 보이면 길이를 늘려보세요.`;
  return `음높이 범위와 리듬 간격을 조정하면 ${mood} 의도가 더 잘 보여요.`;
}

function getLocalStructureLine(summary) {
  if (currentLanguage === 'en') {
    if (summary.repetitionStrength > 0.58) return 'Repeated patterns hold the structure.';
    if (summary.rhythmVariation > 0.52) return 'The flow changes often.';
    if (summary.longNoteRatio > summary.shortNoteRatio) return 'Long notes connect the phrase smoothly.';
    return 'Short notes and space alternate.';
  }
  if (summary.repetitionStrength > 0.58) return '반복이 구조를 잡아요.';
  if (summary.rhythmVariation > 0.52) return '흐름 변화가 커요.';
  if (summary.longNoteRatio > summary.shortNoteRatio) return '긴 음이 부드럽게 이어져요.';
  return '짧은 음과 여백이 번갈아 나와요.';
}

function getVisualColorSuggestion(intent, summary) {
  if (currentLanguage === 'en') {
    if (intent.promptMode === 'joy') return summary.brightness > 0.55 ? 'yellow and orange' : 'yellow and light blue';
    if (intent.promptMode === 'calm') return 'light blue and white';
    if (intent.promptMode === 'mystery') return 'purple and blue';
    if (intent.promptMode === 'tension') return 'purple and red';
    if (intent.promptMode === 'sadness') return 'deep blue and gray';
    return 'warm yellow and soft white';
  }
  if (intent.promptMode === 'joy') return summary.brightness > 0.55 ? '노랑과 주황' : '노랑과 연한 파랑';
  if (intent.promptMode === 'calm') return '연한 파랑과 흰색';
  if (intent.promptMode === 'mystery') return '보라와 푸른색';
  if (intent.promptMode === 'tension') return '보라와 붉은색';
  if (intent.promptMode === 'sadness') return '짙은 파랑과 회색';
  return '따뜻한 노랑과 부드러운 흰색';
}

let aiLoaderClock = null;
let aiLoaderStarted = 0;
function syncAILoader() {
  if (!aiAnalyzeButton) return;
  const loading = aiCoachStatus === 'loading';
  aiAnalyzeButton.classList.toggle('is-writing', loading);
  aiAnalyzeButton.setAttribute('aria-busy', String(loading));
  if (loading) {
    aiAnalyzeButton.removeAttribute('data-i18n');
    if (!aiAnalyzeButton.querySelector('.lattice-loader')) {
      aiLoaderStarted = performance.now();
      aiAnalyzeButton.innerHTML = '<span class="lattice-loader" aria-hidden="true">' + Array.from({length:16}, (_,i) => `<i style="--cell-delay:${(i%4+Math.floor(i/4))*90}ms"></i>`).join('') + '</span><span class="ai-writing-label"></span><span class="ai-writing-time" aria-hidden="true"></span>';
    }
    aiAnalyzeButton.querySelector('.ai-writing-label').textContent = currentLanguage === 'ko' ? '피드백을 쓰고 있어요' : 'Writing your feedback';
    const tick = () => { const timer = aiAnalyzeButton.querySelector('.ai-writing-time'); if (timer) timer.textContent = `${((performance.now()-aiLoaderStarted)/1000).toFixed(1)}s`; };
    tick();
    if (!aiLoaderClock) aiLoaderClock = setInterval(tick, 100);
  } else {
    clearInterval(aiLoaderClock); aiLoaderClock = null;
    aiAnalyzeButton.setAttribute('data-i18n', 'aiAnalyzeButton');
    aiAnalyzeButton.textContent = translate('aiAnalyzeButton');
  }
}

function renderAICoachResult() {
  syncAILoader();
  if (!aiCoachResult) return;
  if (aiCoachSource) aiCoachSource.textContent = aiCoachFeedback?.source === 'llm' ? 'llm' : 'local';
  if (aiAnalyzeButton) aiAnalyzeButton.disabled = aiCoachStatus === 'loading' || aiAnalyzeLockedUntilEdit;
  if (aiCoachStatus === 'loading') {
    aiCoachResult.innerHTML = '';
    return;
  }
  if (!aiCoachFeedback) {
    aiCoachResult.innerHTML = '';
    return;
  }
  const feedback = aiCoachFeedback;
  const hasOperations = Array.isArray(feedback.operations) && feedback.operations.length > 0 && !feedback.applied;
  const editItems = Array.isArray(feedback.editPlan)
    ? feedback.editPlan.filter(Boolean)
    : feedback.editPlan
      ? [feedback.editPlan]
      : [];
  aiCoachResult.innerHTML = `
    <section class="ai-coach-section">
      <span class="ai-coach-section-label">${currentLanguage === 'ko' ? '현재 곡' : 'Current composition'}</span>
      <p>${escapeHtml(feedback.summary || '')}</p>
    </section>
    ${feedback.gapAnalysis ? `
      <section class="ai-coach-section">
        <span class="ai-coach-section-label">${currentLanguage === 'ko' ? '분위기 비교' : 'Mood comparison'}</span>
        <div class="ai-coach-comparison">
          ${(Array.isArray(feedback.gapAnalysis) ? feedback.gapAnalysis : [feedback.gapAnalysis])
            .filter(Boolean)
            .map((item) => `<p>${escapeHtml(item)}</p>`)
            .join('')}
        </div>
      </section>
    ` : ''}
    <section class="ai-coach-section">
      <span class="ai-coach-section-label">${currentLanguage === 'ko' ? '수정 방향' : 'Edit direction'}</span>
      ${editItems.length ? `
        <ol class="ai-coach-plan">
          ${editItems.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
      ` : `<p>${currentLanguage === 'ko' ? '현재 곡을 바탕으로 수정 방향을 정리하고 있어요.' : 'Preparing edit directions from the current composition.'}</p>`}
    </section>
    ${feedback.operations?.length ? `
      <div class="ai-edit-proposal">
        <button type="button" data-ai-action="apply-edits"${hasOperations ? '' : ' disabled'}>${feedback.applied ? (currentLanguage === 'ko' ? '수정 완료' : 'Applied') : (currentLanguage === 'ko' ? '수정하기' : 'Apply changes')}</button>
      </div>
    ` : ''}
  `;
}

function applyAICoachOperations() {
  if (!aiCoachFeedback?.operations?.length || aiCoachFeedback.applied || isExampleMode) return;
  const operations = sanitizeAIOperations(aiCoachFeedback.operations);
  if (!operations.length) return;
  if (isPlaying) stopPlayback();
  pushUndoState();
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  operations.forEach((operation) => {
    applyCellState(operation.noteId, operation.step, operation.type !== 'remove');
  });
  sortComposition();
  aiCoachFeedback = {
    ...aiCoachFeedback,
    applied: true
  };
  render();
  renderAICoachResult();
}

function sanitizeAIOperations(operations) {
  const safe = [];
  const seen = new Set();
  operations.slice(0, 24).forEach((operation) => {
    const type = operation.type === 'remove' ? 'remove' : 'add';
    const noteId = String(operation.noteId || '');
    const step = Number(operation.step);
    if (!notes.some((note) => note.id === noteId)) return;
    if (!Number.isInteger(step) || step < 0 || step >= STEP_COUNT) return;
    const key = `${type}:${noteId}:${step}`;
    if (seen.has(key)) return;
    seen.add(key);
    safe.push({ type, noteId, step });
  });
  return safe;
}

function setAnalysisTab(tabName) {
  const restrictExampleTab = isExampleMode && !window.matchMedia('(width < 768px)').matches;
  const nextTab = restrictExampleTab || !analysisTabNames.includes(tabName) ? 'visual' : tabName;
  analysisTabs.forEach((button) => {
    const isActive = button.dataset.analysisTab === nextTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  analysisPages.forEach((page) => {
    const isActive = page.id === (nextTab === 'coach' ? 'aiCoachPanel' : 'visualFeedbackPanel');
    page.classList.toggle('is-active', isActive);
    page.hidden = !isActive;
  });
  persistSessionState({ analysisTab: nextTab });
}

async function analyzeWithAICoach() {
  if (aiCoachStatus === 'loading' || aiAnalyzeLockedUntilEdit) return;
  if (!validateAICoachForm(true)) {
    aiCoachStatus = 'idle';
    aiCoachFeedback = null;
    window.soundiThought?.reset();
    renderAICoachResult();
    return;
  }
  if (aiFormMessage) aiFormMessage.textContent = '';
  aiCoachStatus = 'loading';
  aiCoachFeedback = null;
  window.soundiThought?.start();
  renderAICoachResult();
  try {
    window.soundiThought?.step('read');
    const analysis = analyzeComposition();
    const payload = createCoachPayload(analysis);
    const localFeedback = createLocalCoachFeedback(payload);
    window.soundiThought?.step('local');
    try {
      window.soundiThought?.step('request');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('AI server unavailable');
      const data = await response.json();
      window.soundiThought?.step('received');
      const llmFeedback = data.feedback || {};
      aiCoachFeedback = {
        ...localFeedback,
        summary: llmFeedback.summary || localFeedback.summary,
        gapAnalysis: llmFeedback.gapAnalysis || localFeedback.gapAnalysis,
        source: 'llm'
      };
    } catch (error) {
      aiCoachFeedback = localFeedback;
      window.soundiThought?.step('fallbackStep');
    }
    aiCoachStatus = 'ready';
    aiAnalyzeLockedUntilEdit = true;
    window.soundiThought?.step('complete');
    window.soundiThought?.finish(aiCoachFeedback.source === 'llm' ? 'done' : 'fallback');
  } catch (error) {
    aiCoachStatus = 'idle';
    window.soundiThought?.finish('error');
    if (aiFormMessage) aiFormMessage.textContent = currentLanguage === 'ko' ? '분석을 완료하지 못했어요. 다시 시도해주세요.' : 'Could not finish the analysis. Please try again.';
  } finally {
    renderAICoachResult();
  }
}

function getMostRepeatedNote() {
  const counts = composition.reduce((result, item) => {
    result[item.noteId] = (result[item.noteId] || 0) + 1;
    return result;
  }, {});
  const [noteId, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  if (!noteId || count < 2) return null;
  const note = notes.find((item) => item.id === noteId);
  return { ...note, count };
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.setValueAtTime(volumeLevel, audioContext.currentTime);
    masterGainNode.connect(audioContext.destination);
    // Observe the output without changing the audible signal path.
    archiveAnalyser = audioContext.createAnalyser();
    archiveAnalyser.fftSize = 2048;
    archiveAnalyser.smoothingTimeConstant = 0.65;
    archiveSpectrum = new Uint8Array(archiveAnalyser.frequencyBinCount);
    masterGainNode.connect(archiveAnalyser);
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function syncMasterVolume() {
  if (!masterGainNode || !audioContext) return;
  masterGainNode.gain.cancelScheduledValues(audioContext.currentTime);
  masterGainNode.gain.setTargetAtTime(isMuted ? 0 : volumeLevel, audioContext.currentTime, 0.012);
}

function getStepIntervalSeconds() {
  return (60 / BPM) / 2;
}

function getSustainLength(noteId, step) {
  let length = 1;
  while (step + length < STEP_COUNT && hasNote(noteId, step + length)) {
    length += 1;
  }
  return length;
}

const activePianoOscillators = new Set();
let playbackStartStep = null;

function playPianoLikeNote(note, sustainSteps = 1, accidental = 0) {
  ensureAudio();
  const now = audioContext.currentTime;
  const duration = Math.max(0.42, sustainSteps * getStepIntervalSeconds());
  const master = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const frequency = getPlaybackFrequency(note, accidental);
  const octaveBoost = note.octave === 1 ? 1.18 : 1;
  const isLow = frequency < 110;
  const cutoff = isLow
    ? Math.max(360, frequency * 7.5)
    : Math.min(6200, Math.max(900, frequency * 8.5));
  const outputGain = (frequency < 55 ? 0.38 : frequency < 110 ? 0.29 : frequency > 2600 ? 0.11 : 0.16) * octaveBoost;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, now);
  filter.Q.setValueAtTime(0.45, now);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(outputGain, now + 0.028);
  master.gain.exponentialRampToValueAtTime(outputGain * 0.72, now + 0.16);
  master.gain.setValueAtTime(outputGain * 0.72, now + Math.max(0.18, duration - 0.12));
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.24);
  filter.connect(master).connect(masterGainNode);

  const partials = isLow
    ? [
      { ratio: 1, gain: 1.0 * octaveBoost, type: 'sine' },
      { ratio: 1.005, gain: 0.42 * octaveBoost, type: 'triangle' },
      { ratio: 2, gain: 0.14, type: 'sine' }
    ]
    : [
      { ratio: 1, gain: 0.56, type: 'triangle' },
      { ratio: 2.003, gain: 0.13, type: 'sine' },
      { ratio: 3.002, gain: 0.045, type: 'sine' }
    ];

  partials.forEach((partial) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = partial.type;
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(partial.gain, now + 0.024);
    gain.gain.exponentialRampToValueAtTime(partial.gain * 0.62, now + 0.18);
    gain.gain.setValueAtTime(partial.gain * 0.62, now + Math.max(0.18, duration - 0.1));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.24);
    oscillator.connect(gain).connect(filter);
    activePianoOscillators.add(oscillator);
    oscillator.onended = () => { activePianoOscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.26);
  });
}

function playLessonNote(button) {
  const note = notes.find((item) => item.id === button.dataset.lessonNote);
  if (!note) return;
  button.classList.remove('is-playing');
  void button.offsetWidth;
  button.classList.add('is-playing');
  playPianoLikeNote(note, 1);
}

function renderLessonRhythmGrid() {
  if (!lessonRhythmGrid) return;
  lessonRhythmGrid.innerHTML = '';
  lessonRhythmRows.forEach((row) => {
    const beatCount = row.beatCount;
    const rowElement = document.createElement('div');
    rowElement.className = 'lesson-rhythm-row';
    rowElement.dataset.rhythmRow = row.id;
    rowElement.style.setProperty('--lesson-beat-count', String(beatCount));

    const button = document.createElement('button');
    button.className = 'lesson-rhythm-play';
    button.type = 'button';
    button.dataset.rhythmPlay = row.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', localized(row.label));
    button.innerHTML = '<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.8C9 6.9 10 6.35 10.78 6.83L17.42 10.94C18.14 11.39 18.14 12.61 17.42 13.06L10.78 17.17C10 17.65 9 17.1 9 16.2V7.8Z"></path></svg><span class="wave-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';

    const track = document.createElement('div');
    track.className = 'lesson-rhythm-track';
    const playhead = document.createElement('span');
    playhead.className = 'lesson-rhythm-head';

    const blockLayer = document.createElement('div');
    blockLayer.className = 'lesson-rhythm-blocks';
    row.blocks.forEach((block) => {
      const item = document.createElement('span');
      item.dataset.beatStart = String(block.start);
      item.dataset.beatEnd = String(block.start + block.length);
      item.style.gridColumn = `${block.start} / span ${block.length}`;
      blockLayer.appendChild(item);
    });

    track.append(playhead, blockLayer);
    rowElement.append(button, track);
    lessonRhythmGrid.append(rowElement);
  });
}

function stopLessonRhythmDemo() {
  if (lessonRhythmTimer) window.clearTimeout(lessonRhythmTimer);
  lessonRhythmTimer = null;
  lessonRhythmGrid?.querySelectorAll('.lesson-rhythm-row').forEach((row) => row.classList.remove('is-playing'));
  lessonRhythmGrid?.querySelectorAll('.lesson-rhythm-play').forEach((button) => {
    button.classList.remove('is-playing', 'is-sounding');
    button.setAttribute('aria-pressed', 'false');
  });
  lessonRhythmGrid?.querySelectorAll('.lesson-rhythm-blocks span').forEach((block) => {
    block.classList.remove('is-active');
  });
}

function startLessonRhythmDemo(rowId) {
  if (!lessonRhythmGrid) return;
  const row = lessonRhythmRows.find((item) => item.id === rowId);
  const rowElement = lessonRhythmGrid.querySelector(`[data-rhythm-row="${rowId}"]`);
  const playButton = lessonRhythmGrid.querySelector(`[data-rhythm-play="${rowId}"]`);
  if (!row || !rowElement || !playButton) return;
  stopLessonRhythmDemo();
  const beatCount = row.beatCount;
  const beatDuration = getStepIntervalSeconds() * 1000;
  let beat = 1;
  rowElement.style.setProperty('--lesson-play-duration', `${beatCount * beatDuration}ms`);
  rowElement.classList.add('is-playing');
  playButton.classList.add('is-playing');
  playButton.setAttribute('aria-pressed', 'true');

  function tick() {
    rowElement.querySelectorAll('.lesson-rhythm-blocks span').forEach((block) => {
      const isActive = beat >= Number(block.dataset.beatStart) && beat < Number(block.dataset.beatEnd);
      block.classList.toggle('is-active', isActive);
      if (isActive) playButton.classList.add('is-sounding');
      if (beat === Number(block.dataset.beatStart)) {
        const note = notes.find((item) => item.id === row.noteId);
        if (note) playPianoLikeNote(note, Number(block.dataset.beatEnd) - Number(block.dataset.beatStart));
      }
    });
    if (!rowElement.querySelector('.lesson-rhythm-blocks span.is-active')) {
      playButton.classList.remove('is-sounding');
    }
    beat += 1;
    if (beat <= beatCount) {
      lessonRhythmTimer = window.setTimeout(tick, beatDuration);
      return;
    }
    lessonRhythmTimer = window.setTimeout(stopLessonRhythmDemo, beatDuration);
  }

  tick();
}

function toggleLessonRhythmDemo(rowId) {
  const playButton = lessonRhythmGrid?.querySelector(`[data-rhythm-play="${rowId}"]`);
  if (playButton?.classList.contains('is-playing')) {
    stopLessonRhythmDemo();
    return;
  }
  startLessonRhythmDemo(rowId);
}

function renderLessonMood() {
  if (!lessonMoodOrb || !lessonMoodText) return;
  const state = lessonMoodStates[lessonMoodIndex % lessonMoodStates.length];
  const moodTargets = [lessonView, siteHeader].filter(Boolean);
  moodTargets.forEach((target) => {
    target.style.setProperty('--mood-a', state.colors[0]);
    target.style.setProperty('--mood-b', state.colors[1]);
    target.style.setProperty('--mood-c', state.colors[2]);
  });
  lessonMoodOrb.classList.remove('mood-bright', 'mood-calm', 'mood-warm', 'mood-tense');
  lessonMoodOrb.classList.add(state.className);
  lessonMoodOrb.soundiSphereState = { colors: state.colors };
  window.dispatchEvent(new CustomEvent('soundi:lesson-sphere-update', { detail: lessonMoodOrb.soundiSphereState }));
  lessonMoodText.textContent = localized(state.text);
  lessonMoodText.classList.remove('is-visible');
  window.setTimeout(() => lessonMoodText.classList.add('is-visible'), 30);
}

function startLessonMoodLoop() {
  if (lessonMoodTimer) window.clearInterval(lessonMoodTimer);
  renderLessonMood();
  lessonMoodTimer = window.setInterval(() => {
    let nextIndex = Math.floor(Math.random() * lessonMoodStates.length);
    if (nextIndex === lessonMoodIndex) nextIndex = (nextIndex + 1) % lessonMoodStates.length;
    lessonMoodIndex = nextIndex;
    renderLessonMood();
  }, 4600);
}

function togglePlayback() {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

async function startPlayback() {
  const generation = ++playbackGeneration;
  ensureAudio();
  playbackAnalysis = analyzeComposition();
  isPlaying = true;
  composeView.classList.add('is-playing');
  playStep = archivePlayerActive && archivePausedStep !== null ? Math.floor(archivePausedStep) : getLoopBounds().start;
  archivePausedStep = null;
  playButton.classList.add('is-playing');
  playButton.setAttribute('aria-pressed', 'true');
  syncControlButtons();
  startCaptionCycle(playbackAnalysis);

  schedulePlaybackStart(generation);
}

function schedulePlaybackStart(generation) {
  const leadMs = 1000;
  playbackStartStep = playStep;
  playbackStepDeadline = performance.now() + leadMs;
  void sendSoundiHapticsToActiveDevice((Date.now() + leadMs) / 1000, playStep);
  playTimer = window.setTimeout(() => {
    if (!isPlaying || generation !== playbackGeneration) return;
    tickPlayback();
  }, leadMs);
}

function tickPlayback() {
  if (!isPlaying) return;
  const generation = playbackGeneration;
  const interval = getStepIntervalSeconds() * 1000;
  const loopBounds = getLoopBounds();
  flashStep(playStep, false);
  playStep += 1;
  playbackStepDeadline += interval;

  if (playStep >= loopBounds.end) {
    playTimer = window.setTimeout(async () => {
      if (!isPlaying || generation !== playbackGeneration) return;

      playStep = loopBounds.start;
      schedulePlaybackStart(generation);
    }, interval + LOOP_GAP_MS);
    return;
  }

  playTimer = window.setTimeout(tickPlayback, Math.max(0, playbackStepDeadline - performance.now()));
}

function getLoopBounds() {
  if (!composition.length) return { start: 0, end: STEP_COUNT };
  const starts = composition.map((item) => item.step);
  const ends = composition.map((item) => item.step + getSustainLength(item.noteId, item.step));
  return {
    start: Math.min(...starts),
    end: Math.max(...ends)
  };
}

let composeProgressFrame = 0;

// Share the audio clock: each block travels from its left edge to its right edge.
function animateComposeStep(step, bounds) {
  cancelAnimationFrame(composeProgressFrame);
  const startTime = audioContext.currentTime;
  const duration = getStepIntervalSeconds();
  const generation = playbackGeneration;
  const paint = () => {
    if (!isPlaying || generation !== playbackGeneration) return;
    const fraction = Math.min(1, Math.max(0, (audioContext.currentTime - startTime) / duration));
    const position = Math.min(bounds.end, step + fraction);
    playhead.style.setProperty('--progress', `${(position - bounds.start) / Math.max(1, bounds.end - bounds.start) * 100}%`);
    gridPlayhead?.style.setProperty('--play-step', String(position));
    composeProgressFrame = fraction < 1 ? requestAnimationFrame(paint) : 0;
  };
  paint();
}

function flashStep(step, audition) {
  const active = composition.filter((item) => item.step === step);
  updatePlaybackPositionDisplay(step);
  const loopBounds = isPlaying ? getLoopBounds() : { start: 0, end: STEP_COUNT };
  if (isPlaying && !audition) animateComposeStep(step, loopBounds);
  if (audition || isPlaying) {
    active.forEach((item) => {
      if (!audition && step !== playbackStartStep && step > 0 && hasNote(item.noteId, step - 1)) return;
      const note = notes.find((entry) => entry.id === item.noteId);
      if (note) playPianoLikeNote(note, audition ? 1 : getSustainLength(item.noteId, step), item.accidental || 0);
    });
  }
  renderAnalysis(step);
}

function stopPlayback() {
  for (const oscillator of activePianoOscillators) { try { oscillator.stop(); } catch {} }
  activePianoOscillators.clear();
  cancelAnimationFrame(composeProgressFrame);
  composeProgressFrame = 0;
  playbackGeneration += 1;
  const wasPlaying = isPlaying;
  cancelAnimationFrame(archiveProgressFrame);
  archiveProgressFrame = 0;
  if (archivePlayerActive && wasPlaying) {
    const bounds = getLoopBounds();
    archivePausedStep = Math.min(bounds.start + archiveProgressPosition + Math.max(0, performance.now() - archiveProgressAnchor) / (getStepIntervalSeconds() * 1000), bounds.end - 1);
  }

  isPlaying = false;
  playbackAnalysis = null;
  window.clearTimeout(playTimer);

  if (wasPlaying) {
    stopSoundiHapticsOnActiveDevice();
  }

  stopCaptionCycle();
  composeView.classList.remove('is-playing');
  playButton.classList.remove('is-playing');
  playButton.setAttribute('aria-pressed', 'false');
  syncControlButtons();
  playhead.style.setProperty('--progress', '0%');
  gridPlayhead?.style.setProperty('--play-step', '0');
  updateDurationDisplay();
  renderAnalysis();
}

function startCaptionCycle(analysis) {
  if (!visualCaption) return;
  window.clearTimeout(visualCaptionTimer);
  const phrases = getMoodPhrases(analysis);
  captionIndex = 0;
  const showPhrase = () => {
    const activeCaptionText = phrases[captionIndex % phrases.length];
    const activeCaptionLines = activeCaptionText
      .split(/(?<=[.!?。])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2);
    visualCaption.replaceChildren();
    activeCaptionLines.forEach((line) => {
      const span = document.createElement('span');
      span.className = 'visual-caption-line';
      span.textContent = line;
      visualCaption.appendChild(span);
    });
    visualCaption.classList.remove('is-visible');
    window.requestAnimationFrame(() => {
      visualCaption.classList.add('is-visible');
    });
    captionIndex += 1;
  };
  window.clearInterval(captionTimer);
  showPhrase();
  captionTimer = window.setInterval(showPhrase, 7000);
}

function stopCaptionCycle() {
  window.clearInterval(captionTimer);
  window.clearTimeout(visualCaptionTimer);
  if (visualCaption) {
    visualCaption.classList.remove('is-visible');
    visualCaption.textContent = '';
  }
  lastVisualCaptionText = '';
}

function renderLocalMoodCaption(analysis) {
  if (!visualCaption || isPlaying) return;
  const nextText = getConciseFeedbackSentence(analysis);
  window.clearTimeout(visualCaptionTimer);
  visualCaptionTimer = window.setTimeout(() => {
    if (isPlaying || nextText === lastVisualCaptionText) return;

    const captionLines = nextText
      .split(/(?<=[.!?。])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2);

    visualCaption.replaceChildren();
    captionLines.forEach((line) => {
      const span = document.createElement('span');
      span.className = 'visual-caption-line';
      span.textContent = line;
      visualCaption.appendChild(span);
    });

    visualCaption.classList.remove('is-visible');
    window.requestAnimationFrame(() => {
      visualCaption.classList.add('is-visible');
    });
    lastVisualCaptionText = nextText;
  }, 300);
}

function getMoodPhrases(analysis) {
  return [getConciseFeedbackSentence(analysis)];
}

function getMoodTypeLabel(analysis) {
  const mood = analysis.moodAI?.primaryMood || analysis.paletteKey;
  const secondary = analysis.moodAI?.secondaryMood;
  const meta = window.SoundiMoodAI?.moodMeta || {};
  const primaryLabel = meta[mood]?.label?.en || mood;
  const secondaryLabel = analysis.moodAI?.mixedMood ? meta[secondary]?.label?.en : '';
  return secondaryLabel ? `${primaryLabel} / ${secondaryLabel}` : primaryLabel;
}

function clearComposition() {
  if (isArchivePreviewMode || isPublishedLocked) return;
  if (!composition.length) return;

  pushUndoState();
  if (isPlaying) stopPlayback();

  clearHistorySnapshot = {
    composition: composition.map((entry) => ({ ...entry })),
    stepCount: STEP_COUNT,
    title: compositionTitle,
    songId: currentSongId,
    cover: normalizeCover(draftCover),
    lastSelectedNoteId,
    lastSelectedStep
  };

  if (!restoringClearFromHistory) {
    window.history.pushState({ soundiAction: 'clearComposition' }, '', window.location.href);
  }

  composition = [];
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  aiAnalyzeLockedUntilEdit = false;

  render();
  renderMySongs();
  syncComposePublishButton();
  playhead?.style.setProperty('--progress', '0%');
}

function loadArchive() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function mapSongRow(row) {
  return {
    id: row.id,
    title: row.title || 'Untitled',
    author: row.author || 'Guest',
    ownerId: row.owner_id || null,
    status: row.status || 'draft',
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    stepCount: Number(row.step_count) || 64,
    cover: normalizeCover(row.cover || { type: 'block' }),
    composition: Array.isArray(row.composition) ? row.composition.map((item) => ({ ...item })) : []
  };
}

async function loadSharedArchive() {
  if (!supabaseClient) {
    renderArchive();
    return;
  }

  const { data, error } = await supabaseClient
    .from('songs')
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.warn('[Soundi Archive] Supabase 불러오기 실패', error);
    renderArchive();
    return;
  }

  archiveItems = (data || []).map(mapSongRow);
  persistArchive();
  renderArchive();
}

function persistArchive() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(archiveItems));
  } catch {
    // Keep the current in-memory archive usable even if file storage is blocked.
  }
}

async function loadMySongs() {
  if (currentUser?.role === 'general' && !currentUserId) {
    currentUserId = loadOrCreateUserId();
    currentUser.userId = currentUserId;
    saveUserSession(currentUser);
  }

  if (!supabaseClient || currentUser?.role !== 'general' || !currentUserId) {
    mySongItems = [];
    renderMySongs();
    return;
  }

  const { data, error } = await supabaseClient
    .from('songs')
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .eq('owner_id', currentUserId)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false });

  if (error) {
    console.warn('[Soundi My Songs] 불러오기 실패', error);
    return;
  }

  mySongItems = (data || []).map(mapSongRow);
  renderMySongs();
}

function formatSongDuration(item) {
  const steps = Math.max(1, Number(item?.stepCount) || 1);
  const seconds = Math.max(1, Math.round(steps * 0.5));
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function formatSongSavedAt(item) {
  const timestamp = item?.updatedAt || item?.createdAt || Date.now();
  return new Date(timestamp).toLocaleString(currentLanguage === 'ko' ? 'ko-KR' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatSongPublishedAt(item) {
  const timestamp = item?.publishedAt || item?.updatedAt || item?.createdAt || Date.now();
  return new Date(timestamp).toLocaleString(currentLanguage === 'ko' ? 'ko-KR' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderMySongs() {
  if (!mySongsList) return;

  savedSongsTab?.classList.toggle('is-active', mySongsFilter === 'saved');
  publishedSongsTab?.classList.toggle('is-active', mySongsFilter === 'published');
  savedSongsTab?.setAttribute('aria-selected', String(mySongsFilter === 'saved'));
  publishedSongsTab?.setAttribute('aria-selected', String(mySongsFilter === 'published'));

  if (currentUser?.role !== 'general') {
    mySongsList.innerHTML = `<p class="my-songs-empty">${translate('mySongsGeneralOnly')}</p>`;
    return;
  }

  const visibleItems = mySongItems.filter((item) => (
    item.status !== 'deleted' &&
    (
      mySongsFilter === 'published'
        ? item.status === 'published'
        : item.status !== 'published'
    )
  ));

  if (!visibleItems.length) {
    mySongsList.innerHTML = mySongsFilter === 'published'
      ? `<p class="my-songs-empty">${translate('noPublishedSongs')}</p>`
      : `<p class="my-songs-empty">${translate('noSavedSongs')}</p>`;
    return;
  }

  mySongsList.innerHTML = visibleItems.map((item) => {
    const isPublished = item.status === 'published';
    const isCurrent = isArchivePreviewMode
      ? String(item.id) === String(archivePreviewItemId)
      : String(item.id) === String(currentSongId);
    const isSelected = selectedMySongIds.has(String(item.id));
    const dateText = isPublished ? formatSongPublishedAt(item) : formatSongSavedAt(item);
    return `
      <article class="my-song-item ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" data-song-id="${item.id}">
        <button class="my-song-open" type="button" data-open-my-song="${item.id}">
          <span class="archive-cd my-song-cover ${getArchiveCoverClass(item)}" style="${getArchiveCoverStyle(item)}" aria-hidden="true">
              ${renderArchiveRecordContent(item)}
            </span>
          <span class="my-song-copy">
            <strong>${escapeHtml(item.title || 'Untitled')}</strong>
            <span class="my-song-meta">
              <span>${formatSongDuration(item)}</span>
              <span>${escapeHtml(dateText)}</span>
            </span>
          </span>
        </button>
        <div class="my-song-more-wrap">
          <button class="my-song-more" type="button" data-more-my-song="${item.id}" aria-label="${translate('moreSong')}" aria-expanded="false">⋯</button>
          <div class="my-song-more-menu" data-more-menu-for="${item.id}" hidden>
            ${isPublished ? `<button type="button" data-unpublish-my-song="${item.id}">${translate('unpublish')}</button>` : ''}
            <button type="button" data-duplicate-my-song="${item.id}">${translate('duplicate')}</button>
            <button type="button" data-delete-my-song="${item.id}">${translate('delete')}</button>
          </div>
          <div class="my-song-delete-popover" data-delete-popover-for="${item.id}" hidden>
            <strong data-delete-popover-title>${translate('deleteQuestion')}</strong>
            <span>${translate('deleteWarning')}</span>
            <div class="my-song-delete-popover-actions">
              <button type="button" data-delete-popover-cancel="${item.id}">취소</button>
              <button type="button" data-delete-popover-confirm="${item.id}">삭제</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');


  mySongsList.querySelectorAll('[data-more-my-song]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = button.dataset.moreMySong;
      const menu = mySongsList.querySelector(`[data-more-menu-for="${id}"]`);
      if (!menu) return;

      const willOpen = menu.hidden;

      mySongsList.querySelectorAll('.my-song-more-menu').forEach((otherMenu) => {
        otherMenu.hidden = true;
      });
      mySongsList.querySelectorAll('[data-more-my-song]').forEach((otherButton) => {
        otherButton.setAttribute('aria-expanded', 'false');
      });

      menu.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    });
  });


  mySongsList.querySelectorAll('[data-duplicate-my-song]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      duplicateMySong(button.dataset.duplicateMySong);
    });
  });

  mySongsList.querySelectorAll('[data-unpublish-my-song]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      unpublishMySong(button.dataset.unpublishMySong);
    });
  });

  mySongsList.querySelectorAll('[data-open-my-song]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = String(button.dataset.openMySong);
      const currentIndex = visibleItems.findIndex((item) => String(item.id) === id);

      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        if (lastSelectedMySongIndex === null || lastSelectedMySongIndex < 0) {
          selectedMySongIds.add(id);
          lastSelectedMySongIndex = currentIndex;
        } else {
          const start = Math.min(lastSelectedMySongIndex, currentIndex);
          const end = Math.max(lastSelectedMySongIndex, currentIndex);
          for (let index = start; index <= end; index += 1) {
            selectedMySongIds.add(String(visibleItems[index].id));
          }
        }

        renderMySongs();
        return;
      }

      selectedMySongIds.clear();
      lastSelectedMySongIndex = currentIndex;
      openMySong(id);
    });
  });

  mySongsList.querySelectorAll('[data-delete-my-song]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = String(button.dataset.deleteMySong);
      const selectedIds = selectedMySongIds.has(id) && selectedMySongIds.size > 1
        ? [...selectedMySongIds]
        : [id];

      mySongsList.querySelectorAll('.my-song-more-menu').forEach((menu) => {
        menu.hidden = true;
      });
      mySongsList.querySelectorAll('[data-more-my-song]').forEach((moreButton) => {
        moreButton.setAttribute('aria-expanded', 'false');
      });
      mySongsList.querySelectorAll('.my-song-delete-popover').forEach((popover) => {
        popover.hidden = true;
      });

      const popover = mySongsList.querySelector(`[data-delete-popover-for="${id}"]`);
      if (!popover) return;
      popover.dataset.deleteIds = JSON.stringify(selectedIds);
      const title = popover.querySelector('[data-delete-popover-title]');
      if (title) title.textContent = selectedIds.length > 1 ? `${selectedIds.length}곡을 삭제할까요?` : '삭제할까요?';
      popover.hidden = false;
    });
  });

  mySongsList.querySelectorAll('[data-delete-popover-cancel]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const popover = button.closest('.my-song-delete-popover');
      if (popover) {
        popover.hidden = true;
        delete popover.dataset.deleteIds;
      }
    });
  });

  mySongsList.querySelectorAll('[data-delete-popover-confirm]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const popover = button.closest('.my-song-delete-popover');
      if (!popover) return;

      let ids = [];
      try {
        ids = JSON.parse(popover.dataset.deleteIds || '[]').map(String);
      } catch (error) {
        ids = [];
      }
      if (!ids.length) return;

      button.disabled = true;
      await deleteMySongs(ids);
      button.disabled = false;

      popover.hidden = true;
      delete popover.dataset.deleteIds;
    });
  });
}

function syncComposePublishButton() {
  if (!composePublishButton) return;
  const current = mySongItems.find((item) => String(item.id) === String(currentSongId));
  const isPublished = current?.status === 'published' || isPublishedLocked;
  const canShow = composition.length > 0 && !isArchivePreviewMode && !isExampleMode;
  composePublishButton.hidden = !canShow;
  composePublishButton.textContent = isPublished ? translate('publishedStatus') : translate('publish');
  composePublishButton.disabled = isPublished;
}

async function openMySong(id) {
  clearHistorySnapshot = null;
  const item = mySongItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;

  selectedMySongIds.clear();

  if (item.status === 'published') {
    openArchivePreview(item.id);
    return;
  }

  isPublishedLocked = false;
  document.body.classList.remove('is-published-locked-mode');
  document.body.classList.remove('is-published-locked-mode');

  if (isPlaying) stopPlayback();
  isArchivePreviewMode = false;
  archivePreviewItemId = null;
  archivePreviewDraft = null;
  document.body.classList.remove('is-archive-preview-mode');

  currentSongId = item.id;
  editingArchiveId = null;
  STEP_COUNT = Math.max(64, item.stepCount || 64);
  composition = (item.composition || []).map((entry) => ({ ...entry }));
  compositionTitle = item.title || 'Untitled';
  draftCover = normalizeCover(item.cover || { type: 'block' });
  lastSelectedNoteId = null;
  lastSelectedStep = null;

  ensureOctaveRangeForComposition();
  updateTitleDisplay();
  syncControlButtons();
  render();
  renderMySongs();
  syncComposePublishButton();
  setView('compose');
}

function startNewSong() {
  clearHistorySnapshot = null;
  if (isPlaying) stopPlayback();
  isPublishedLocked = false;

  isArchivePreviewMode = false;
  archivePreviewItemId = null;
  archivePreviewDraft = null;
  document.body.classList.remove('is-archive-preview-mode');

  currentSongId = null;
  editingArchiveId = null;
  STEP_COUNT = 64;
  composition = [];
  compositionTitle = 'Untitled';
  draftCover = { type: 'block', color: '#ffdc21', image: '' };
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  undoStack = [];
  mySongsFilter = 'saved';
  selectedMySongIds.clear();
  lastSelectedMySongIndex = null;

  ensureOctaveRangeForComposition();
  updateTitleDisplay();
  syncControlButtons();
  render();
  renderMySongs();
  syncComposePublishButton();
  setView('compose');
}

async function unpublishMySong(id, forEdit = false) {
  const item = mySongItems.find((entry) => String(entry.id) === String(id));
  if (!item || item.ownerId !== currentUserId || item.status !== 'published' || currentUser?.role !== 'general' || !supabaseClient) return;

  const confirmed = await showSongDialog(forEdit ? (currentLanguage === 'en' ? 'Unpublish this song to edit it? You can publish it again after editing.' : '수정하려면 먼저 게시를 취소해요. 수정 후 다시 게시할 수 있어요. 계속할까요?') : (currentLanguage === 'en' ? 'Unpublish this song? It will stay in My Songs.' : '아카이브에서만 내려가며, 저장된 곡은 그대로 유지돼요.'), { confirm: true, title: forEdit ? (currentLanguage === 'en' ? 'Edit song' : '곡 수정') : (currentLanguage === 'en' ? 'Take this song off the archive?' : '아카이브에서 곡을 내릴까요?'), cancelLabel: forEdit ? undefined : (currentLanguage === 'en' ? 'Keep published' : '그대로 두기'), actionLabel: forEdit ? (currentLanguage === 'en' ? 'Edit' : '수정하기') : (currentLanguage === 'en' ? 'Unpublish' : '게시 내리기') });
  if (!confirmed) return;

  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from('songs')
    .update({
      status: 'draft',
      published_at: null,
      updated_at: now
    })
    .eq('id', id)
    .eq('owner_id', currentUserId)
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .single();

  if (error || !data) {
    console.warn('[Soundi My Works] 게시 취소 실패', error);
    showSongDialog('게시를 취소하지 못했어요.');
    return;
  }

  if (String(id) === String(currentSongId)) {
    isPublishedLocked = false;
    document.body.classList.remove('is-published-locked-mode');
    syncControlButtons();
    updateTitleDisplay();
  }
  const draftItem = mapSongRow(data);
  mySongsFilter = 'saved';
  mySongItems = mySongItems.filter((entry) => String(entry.id) !== String(draftItem.id));
  mySongItems.unshift(draftItem);
  archiveItems = archiveItems.filter((entry) => String(entry.id) !== String(draftItem.id));
  persistArchive();
  renderArchive();
  renderMySongs();
  await loadMySongs();
  renderMySongs();
  renderDashboard();
  syncComposePublishButton();
  return draftItem;
}

async function duplicateMySong(id) {
  const source = mySongItems.find((item) => String(item.id) === String(id));
  if (!source || source.ownerId !== currentUserId || currentUser?.role !== 'general' || !supabaseClient) return;

  const duplicateTitle = `${source.title || 'Untitled'} ${currentLanguage === 'en' ? '— Copy' : '복사본'}`;
  const now = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from('songs')
    .insert({
      title: duplicateTitle,
      author: currentUser.nickname,
      owner_id: currentUserId,
      status: 'draft',
      published_at: null,
      step_count: source.stepCount || 64,
      cover: normalizeCover(source.cover || { type: 'block' }),
      composition: (source.composition || []).map((entry) => ({ ...entry })),
      created_at: now,
      updated_at: now
    })
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .single();

  if (error || !data) {
    console.warn('[Soundi My Works] 곡 복제 실패', error);
    showSongDialog('곡을 복제하지 못했어요.');
    return;
  }

  const duplicatedItem = mapSongRow(data);
  mySongsFilter = 'saved';
  mySongItems = mySongItems.filter((item) => String(item.id) !== String(duplicatedItem.id));
  mySongItems.unshift(duplicatedItem);
  renderMySongs();
  await loadMySongs();
  renderMySongs();
  return duplicatedItem;
}

function openDeleteConfirmModal(id) {
  pendingDeleteSongId = id;
  if (!deleteConfirmModal) return;
  deleteConfirmModal.hidden = false;
  deleteConfirmModal.setAttribute('aria-hidden', 'false');
}

function closeDeleteConfirmModal() {
  pendingDeleteSongId = null;
  if (!deleteConfirmModal) return;
  deleteConfirmModal.hidden = true;
  deleteConfirmModal.setAttribute('aria-hidden', 'true');
}

// Call Chip-inspired deletion feedback, tied to the actual operation result.
async function runDeleteChip(operation) {
  const en = currentLanguage === 'en';
  const chip = document.createElement('div');
  chip.className = 'delete-call-chip';
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'polite');
  const label = document.createElement('span');
  label.textContent = en ? 'Deleting' : '삭제 중';
  const timer = document.createElement('span');
  timer.className = 'delete-chip-timer';
  timer.setAttribute('aria-hidden', 'true');
  chip.append(label, timer);
  let region = document.getElementById('deleteChipRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'deleteChipRegion';
    document.body.append(region);
  }
  region.append(chip);
  const start = performance.now();
  const tick = () => { timer.textContent = `${((performance.now()-start)/1000).toFixed(1)}s`; };
  tick();
  const clock = setInterval(tick, 100);
  let result = false;
  try { result = await operation(); }
  catch (error) { console.warn('[Soundi Delete] Operation failed', error); }
  finally {
    clearInterval(clock);
    tick();
    chip.classList.add(result === true ? 'is-success' : 'is-error');
    label.textContent = result === true ? (en ? 'Deleted' : '삭제 완료') : (en ? 'Could not delete' : '삭제하지 못했어요');
    setTimeout(() => chip.remove(), result === true ? 2600 : 4500);
  }
  return result;
}

async function deleteMySongs(ids, options = {}) {
  return runDeleteChip(() => performDeleteMySongs(ids, options));
}

async function performDeleteMySongs(ids, {beforeRemove} = {}) {
  const uniqueIds = [...new Set((ids || []).map(String))];
  if (!uniqueIds.length || currentUser?.role !== 'general' || !supabaseClient) return;

  const ownedIds = uniqueIds.filter((id) => {
    const item = mySongItems.find((entry) => String(entry.id) === id);
    return item && item.ownerId === currentUserId;
  });
  if (!ownedIds.length) return;

  const now = new Date().toISOString();
  const { data: deletedRows, error } = await supabaseClient
    .from('songs')
    .update({
      status: 'deleted',
      published_at: null,
      updated_at: now
    })
    .in('id', ownedIds)
    .eq('owner_id', currentUserId)
    .select('id');

  if (error) {
    console.warn('[Soundi My Works] 삭제 처리 실패', error);
    window.alert('곡을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
    return;
  }

  const deletedIds = Array.isArray(deletedRows)
    ? deletedRows.map((row) => String(row.id))
    : [];

  if (!deletedIds.length) {
    console.warn('[Soundi My Works] 삭제 처리된 행이 없어요.', { ownedIds, deletedRows });
    window.alert('곡을 삭제하지 못했어요. 현재 로그인한 계정의 곡인지 확인해주세요.');
    return;
  }

  if (beforeRemove) await beforeRemove();

  if (currentSongId && deletedIds.includes(String(currentSongId))) {
    startNewSong();
  }
  if (archivePreviewItemId && deletedIds.includes(String(archivePreviewItemId))) {
    isArchivePreviewMode = false;
    archivePreviewItemId = null;
    archivePreviewDraft = null;
    document.body.classList.remove('is-archive-preview-mode');
  }

  deletedIds.forEach((id) => selectedMySongIds.delete(id));
  lastSelectedMySongIndex = null;
  mySongItems = mySongItems.filter((entry) => !deletedIds.includes(String(entry.id)));
  archiveItems = archiveItems.filter((entry) => !deletedIds.includes(String(entry.id)));
  persistArchive();
  renderMySongs();
  renderArchive();
  renderDashboard();
  syncComposePublishButton();
  return true;
}

function toggleMySongsPanel() {
  if (!mySongsPanel || !mySongsToggle) return;
  const willOpen = mySongsPanel.classList.contains('is-collapsed');
  mySongsPanel.classList.toggle('is-collapsed', !willOpen);
  mySongsToggle.setAttribute('aria-expanded', String(willOpen));
}

function setMySongsFilter(filter) {
  mySongsFilter = filter === 'published' ? 'published' : 'saved';
  selectedMySongIds.clear();
  lastSelectedMySongIndex = null;
  renderMySongs();
}

async function saveComposition(cover = draftCover, { silentSaveFeedback = false } = {}) {
  if (!composition.length || currentUser?.role !== 'general') {
    if (!silentSaveFeedback) flashControl(saveButton);
    return null;
  }

  if (!currentUserId) {
    currentUserId = loadOrCreateUserId();
    currentUser.userId = currentUserId;
    saveUserSession(currentUser);
  }

  const maxStep = Math.max(...composition.map((item) => item.step), 31);
  const author = currentUser.nickname;
  const normalizedCover = normalizeCover(cover);
  const compositionSnapshot = composition.map((item) => ({ ...item }));
  const now = new Date().toISOString();

  const payload = {
    title: getCurrentTitle(),
    author,
    owner_id: currentUserId,
    status: 'draft',
    published_at: null,
    step_count: maxStep + 1,
    cover: normalizedCover,
    composition: compositionSnapshot,
    updated_at: now
  };

  if (!supabaseClient) {
    if (!silentSaveFeedback) flashControl(saveButton);
    return null;
  }

  let query;
  if (currentSongId) {
    query = supabaseClient
      .from('songs')
      .update(payload)
      .eq('id', currentSongId)
      .eq('owner_id', currentUserId);
  } else {
    query = supabaseClient
      .from('songs')
      .insert(payload);
  }

  const { data, error } = await query
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .single();

  if (error || !data) {
    console.warn('[Soundi] 저장 실패', error);
    if (!silentSaveFeedback) flashControl(saveButton);
    window.alert('곡을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    return null;
  }

  currentSongId = data.id;
  draftCover = normalizedCover;
  mySongsFilter = 'saved';

  const savedItem = mapSongRow(data);
  mySongItems = mySongItems.filter((item) => String(item.id) !== String(savedItem.id));
  mySongItems.unshift(savedItem);
  renderMySongs();

  if (!silentSaveFeedback) flashControl(saveButton);
  await loadMySongs();
  renderMySongs();
  syncComposePublishButton();
  return savedItem;
}

async function publishCurrentComposition() {
  if (!composition.length || currentUser?.role !== 'general') return;

  if (!currentSongId) return;
  if (!currentSongId || !supabaseClient) return;

  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from('songs')
    .update({
      status: 'published',
      published_at: now,
      updated_at: now
    })
    .eq('id', currentSongId)
    .eq('owner_id', currentUserId)
    .select('id,title,author,owner_id,status,published_at,step_count,cover,composition,created_at,updated_at')
    .single();

  if (error || !data) {
    console.warn('[Soundi] 게시 실패', error);
    return;
  }

  const publishedItem = mapSongRow(data);
  archiveItems = archiveItems.filter((item) => String(item.id) !== String(publishedItem.id));
  archiveItems.unshift(publishedItem);
  isPublishedLocked = true;
  document.body.classList.add('is-published-locked-mode');
  persistArchive();
  renderArchive();
  mySongsFilter = 'published';
  await loadMySongs();
  syncControlButtons();
  updateTitleDisplay();
  renderMySongs();
  syncComposePublishButton();
}

function openArchivePreview(id, inArchive = false) {
  clearHistorySnapshot = null;
  const item = archiveItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  if (isPlaying) stopPlayback();
  archivePlayerActive = inArchive;
  archivePausedStep = null;

  if (!isArchivePreviewMode) {
    archivePreviewDraft = {
      stepCount: STEP_COUNT,
      composition: composition.map((entry) => ({ ...entry })),
      title: compositionTitle,
      isExampleMode,
      isPublishedLocked,
      editingArchiveId,
      lastSelectedNoteId,
      lastSelectedStep
    };
  }

  isArchivePreviewMode = true;
  isExampleMode = false;
  isPublishedLocked = false;
  archivePreviewItemId = item.id;
  renderMySongs();
  editingArchiveId = null;
  STEP_COUNT = Math.max(64, item.stepCount || 64);
  composition = (item.composition || []).map((entry) => ({ ...entry }));
  compositionTitle = item.title || 'Untitled';
  lastSelectedNoteId = null;
  lastSelectedStep = null;

  document.body.classList.remove('is-published-locked-mode');
  document.body.classList.add('is-archive-preview-mode');
  ensureOctaveRangeForComposition();
  setAnalysisTab('visual');
  updateTitleDisplay();
  syncControlButtons();
  render();
  renderMySongs();
  setView(inArchive ? 'archive' : 'compose');
  renderArchivePlayer();

  if (scoreScroll) {
    scoreScroll.scrollLeft = 0;
    requestAnimationFrame(() => scrollC4RangeToCenter('auto'));
  }
}

function restoreArchivePreviewDraft() {
  if (!isArchivePreviewMode) return;
  if (isPlaying) stopPlayback();

  archivePlayerActive = false;
  archivePausedStep = null;
  const draft = archivePreviewDraft;
  isArchivePreviewMode = false;
  archivePreviewItemId = null;
  renderMySongs();
  archivePreviewDraft = null;
  document.body.classList.remove('is-archive-preview-mode');
  isPublishedLocked = false;
  document.body.classList.remove('is-published-locked-mode');

  if (draft) {
    isExampleMode = Boolean(draft.isExampleMode);
    isPublishedLocked = Boolean(draft.isPublishedLocked);
    document.body.classList.toggle('is-published-locked-mode', isPublishedLocked);
    STEP_COUNT = draft.stepCount || 64;
    composition = (draft.composition || []).map((entry) => ({ ...entry }));
    compositionTitle = draft.title || 'Untitled';
    editingArchiveId = draft.editingArchiveId || null;
    lastSelectedNoteId = draft.lastSelectedNoteId || null;
    lastSelectedStep = Number.isFinite(draft.lastSelectedStep) ? draft.lastSelectedStep : null;
    ensureOctaveRangeForComposition();
    updateTitleDisplay();
    syncControlButtons();
    render();
  }
}

async function deleteSongById(id) {
  return runDeleteChip(() => performDeleteSongById(id));
}

async function performDeleteSongById(id) {
  const songId = String(id || '');
  if (!songId || !currentUser || !supabaseClient) return false;

  const item = mySongItems.find((entry) => String(entry.id) === songId)
    || archiveItems.find((entry) => String(entry.id) === songId);
  if (!item) return false;

  const isAdmin = currentUser.role === 'admin';
  const isOwner = currentUser.role === 'general' && item.ownerId && item.ownerId === currentUserId;
  if (!isAdmin && !isOwner) return false;

  let deletedIds = [];

  if (isAdmin) {
    const response = await fetch(`/api/archive/${encodeURIComponent(songId)}`, {
      method: 'DELETE',
      headers: {
        'X-Admin-Token': currentUser.adminToken || ''
      }
    });

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error || '';
      } catch (_) {}
      console.warn('[Soundi Delete] 관리자 삭제 실패', response.status, detail);
      showSongDialog(
        response.status === 503
          ? '관리자 삭제를 사용하려면 서버의 SUPABASE_SECRET_KEY 설정이 필요해요.'
          : '관리자 권한으로 곡을 삭제하지 못했어요.'
      );
      return false;
    }

    deletedIds = [songId];
  } else {
    const now = new Date().toISOString();
    const { data: deletedRows, error } = await supabaseClient
      .from('songs')
      .update({
        status: 'deleted',
        published_at: null,
        updated_at: now
      })
      .eq('id', songId)
      .eq('owner_id', currentUserId)
      .select('id');

    if (error) {
      console.warn('[Soundi Delete] 삭제 처리 실패', error);
      showSongDialog('곡을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
      return false;
    }

    deletedIds = Array.isArray(deletedRows)
      ? deletedRows.map((row) => String(row.id))
      : [];

    if (!deletedIds.includes(songId)) {
      console.warn('[Soundi Delete] 삭제 처리된 행이 없어요.', { songId, deletedRows });
      showSongDialog('곡이 삭제되지 않았어요. Supabase의 Users can delete own songs 정책을 적용해주세요.');
      return false;
    }
  }

  if (currentSongId && String(currentSongId) === songId) {
    startNewSong();
  }
  if (archivePreviewItemId && String(archivePreviewItemId) === songId) {
    isArchivePreviewMode = false;
    archivePreviewItemId = null;
    archivePreviewDraft = null;
    document.body.classList.remove('is-archive-preview-mode');
  }

  selectedMySongIds.delete(songId);
  lastSelectedMySongIndex = null;
  mySongItems = mySongItems.filter((entry) => String(entry.id) !== songId);
  archiveItems = archiveItems.filter((entry) => String(entry.id) !== songId);
  persistArchive();
  renderMySongs();
  renderArchive();
  renderDashboard();
  syncComposePublishButton();
  return true;
}

async function deleteArchiveItem(id) {
  const en = currentLanguage === 'en';
  const accepted = await showSongDialog(en ? 'You can restore it from Trash.' : '삭제한 곡은 휴지통에서 복원할 수 있어요.', {
    confirm: true, title: en ? 'Delete this song?' : '곡을 삭제할까요?',
    actionLabel: en ? 'Delete' : '삭제', destructive: true
  });
  if (accepted) await deleteSongById(id);
}

function renderArchive() {
  if (!archiveGrid) return;
  renderArchivePlayer();
  if (!archiveItems.length) {
    archiveGrid.innerHTML = `<p class="archive-empty">${translate('archiveEmpty')}</p>`;
    return;
  }

  archiveGrid.innerHTML = archiveItems.map((item) => {
    const isOwner = currentUser?.role === 'general' && item.ownerId && item.ownerId === currentUserId;

    return `
      <article class="archive-card">
        <div class="archive-record-wrap">
        <button type="button" class="archive-record-button" data-play-archive-id="${escapeHtml(String(item.id))}" aria-label="${escapeHtml(item.title)} · ${currentLanguage === 'en' ? 'Play' : '재생'}"><span class="archive-cd ${getArchiveCoverClass(item)}" style="${getArchiveCoverStyle(item)}" aria-hidden="true">
          ${renderArchiveRecordContent(item)}
        </span><span class="archive-play-overlay" aria-hidden="true">${controlIcons.play}<span class="archive-equalizer"><i></i><i></i><i></i></span></span></button>
        <button class="archive-more-button" type="button" data-archive-menu-id="${escapeHtml(String(item.id))}" aria-haspopup="dialog" aria-label="${escapeHtml(item.title)} · ${currentLanguage === 'en' ? 'Song options' : '곡 메뉴'}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>
        </div>
        <div class="archive-info">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.author || translate('guest'))}</span>
        </div>

      </article>
    `;
  }).join('');

  archiveGrid.querySelectorAll('[data-play-archive-id]').forEach((button) => {
    button.addEventListener('click', () => playArchiveSong(button.dataset.playArchiveId));
  });

  archiveGrid.querySelectorAll('[data-archive-menu-id]').forEach(button => {
    button.addEventListener('click', () => openArchiveSongMenu(button.dataset.archiveMenuId, button));
  });
  syncArchivePlayer();
}

function normalizeCover(cover = {}) {
  const type = ['block', 'color', 'image'].includes(cover.type) ? cover.type : 'block';
  return {
    type,
    color: getSafeCoverColor(cover.color || '#ffdc21'),
    image: type === 'image' ? String(cover.image || '') : ''
  };
}

function getSafeCoverColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color) ? color : '#ffdc21';
}

function getArchiveCoverClass(item) {
  const cover = normalizeCover(item.cover);
  if (cover.type === 'color') return 'cover-solid';
  if (cover.type === 'image' && cover.image) return 'cover-image';
  return '';
}

function getArchiveCoverStyle(item) {
  const cover = normalizeCover(item.cover);
  if (cover.type === 'color') return `--cover-color:${cover.color}`;
  if (cover.type === 'image' && cover.image) return `background-image:linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12)),url(${cover.image})`;
  return '';
}

function openCoverModal() {
  if (isArchivePreviewMode || isPublishedLocked) return;
  if (!composition.length) {
    flashControl(saveButton);
    return;
  }
  if (isPlaying) stopPlayback();
  const existingCover = editingArchiveId ? archiveItems.find((item) => item.id === editingArchiveId)?.cover : null;
  draftCover = normalizeCover(existingCover || draftCover || { type: 'block' });
  if (coverTitleInput) coverTitleInput.value = getCurrentTitle();
  updateCoverChoiceUI();
  renderCoverPreview();
  coverModal.hidden = false;
  requestAnimationFrame(() => coverTitleInput?.focus());
}

function closeCoverModal() {
  if (!coverModal) return;
  coverModal.hidden = true;
}

function setDraftCoverFromButton(button) {
  const type = button.dataset.coverType || 'block';
  if (type === 'image') {
    coverImageInput?.click();
    return;
  }
  draftCover = normalizeCover({
    ...draftCover,
    type,
    color: button.dataset.coverColor || draftCover.color,
    image: type === 'image' ? draftCover.image : ''
  });
  updateCoverChoiceUI();
  renderCoverPreview();
}

function updateCoverChoiceUI() {
  coverOptionButtons.forEach((button) => {
    const isColorMatch = draftCover.type === 'color' && button.dataset.coverType === 'color' && button.dataset.coverColor === draftCover.color;
    const isTypeMatch = draftCover.type !== 'color' && button.dataset.coverType === draftCover.type;
    button.classList.toggle('is-selected', isColorMatch || isTypeMatch);
  });
}

function renderCoverPreview() {
  if (!coverPreviewRecord) return;
  const previewItem = {
    composition,
    stepCount: Math.max(1, composition.reduce((max, entry) => Math.max(max, entry.step + 1), 0)),
    cover: draftCover
  };
  coverPreviewRecord.className = `archive-cd cover-preview-record ${getArchiveCoverClass(previewItem)}`;
  coverPreviewRecord.setAttribute('style', getArchiveCoverStyle(previewItem));
  coverPreviewRecord.innerHTML = renderArchiveRecordContent(previewItem);
}

async function publishCoverComposition() {
  if (coverTitleInput) {
    compositionTitle = coverTitleInput.value.trim() || 'Untitled';
    updateTitleDisplay();
  }

  draftCover = normalizeCover(draftCover);

  const saved = await saveComposition(draftCover, { silentSaveFeedback: true });
  if (!saved && !currentSongId) return;

  await publishCurrentComposition();
  closeCoverModal();
}

function handleCoverImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    draftCover = normalizeCover({ ...draftCover, type: 'image', image: String(reader.result || '') });
    updateCoverChoiceUI();
    renderCoverPreview();
  });
  reader.readAsDataURL(file);
}

function renderArchiveRecordContent(item) {
  const cover = normalizeCover(item.cover);
  if (cover.type === 'block') return renderCdSegments(item);
  return `
    <span class="cd-shine"></span>
    <span class="cd-hole"></span>
  `;
}

function renderCdSegments(item) {
  const usedNoteIds = [...new Set(item.composition.map((entry) => entry.noteId))]
    .sort((a, b) => notes.findIndex((note) => note.id === a) - notes.findIndex((note) => note.id === b));
  const trackCount = Math.max(1, usedNoteIds.length);
  const innerRadius = 58;
  const outerRadius = 114;
  const preferredTrackSize = 10;
  const availableBand = outerRadius - innerRadius;
  const trackSize = Math.min(preferredTrackSize, availableBand / trackCount);
  const guideCount = Math.floor(availableBand / trackSize) + 1;
  const usedGuideSpan = (guideCount - 1) * trackSize;
  const guideStartRadius = innerRadius + (availableBand - usedGuideSpan) / 2;
  const guideRadii = Array.from(
    { length: guideCount },
    (_, index) => guideStartRadius + index * trackSize
  );
  const trackRadii = Array.from(
    { length: guideCount - 1 },
    (_, index) => (guideRadii[index] + guideRadii[index + 1]) / 2
  );
  const trackMap = new Map(
    usedNoteIds.map((noteId, index) => {
      const slotIndex = trackCount <= trackRadii.length
        ? Math.round((index * (trackRadii.length - 1)) / Math.max(1, trackCount - 1))
        : index;
      return [noteId, slotIndex];
    })
  );
  const strokeWidth = trackSize;
  const guides = guideRadii
    .map((radius) => `<circle class="cd-track-guide" cx="120" cy="120" r="${radius.toFixed(2)}"></circle>`)
    .join('');
  const songStepCount = item.composition.reduce((max, entry) => Math.max(max, entry.step + 1), 0);
  const stepCount = Math.max(1, songStepCount);
  const segments = item.composition.map((entry) => {
    const noteIndex = notes.findIndex((note) => note.id === entry.noteId);
    if (noteIndex < 0) return '';
    const note = notes[noteIndex];
    const trackIndex = trackMap.get(entry.noteId) || 0;
    const radius = trackRadii[trackIndex] ?? innerRadius;
    const length = getSavedSustainLength(item.composition, entry.noteId, entry.step, stepCount);
    const isContinuation = entry.step > 0 && item.composition.some((saved) => saved.noteId === entry.noteId && saved.step === entry.step - 1);
    if (isContinuation) return '';
    const angle = (entry.step / stepCount) * 360 - 90;
    const sweep = Math.min(360, Math.max(2.2, (length / stepCount) * 360));
    const dash = `${sweep} ${360 - sweep}`;
    return `<circle class="cd-segment" cx="120" cy="120" r="${radius.toFixed(2)}" pathLength="360" stroke="${note.color}" stroke-width="${strokeWidth.toFixed(2)}" stroke-dasharray="${dash}" stroke-dashoffset="${(-angle).toFixed(2)}"></circle>`;
  }).join('');
  return `
    <span class="cd-shine"></span>
    <svg class="cd-map" viewBox="0 0 240 240" role="img" aria-label="composition record map">
      ${guides}
      ${segments}
    </svg>
    <span class="cd-hole"></span>
  `;
}

function getSavedSustainLength(items, noteId, step, stepCount) {
  let length = 1;
  while (step + length < stepCount && items.some((item) => item.noteId === noteId && item.step === step + length)) {
    length += 1;
  }
  return length;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function extendScoreIfNeeded() {
  if (!scoreScroll) return;
  const remainingX = scoreScroll.scrollWidth - scoreScroll.clientWidth - scoreScroll.scrollLeft;
  if (remainingX > 480) return;
  STEP_COUNT += 32;
  highestOctave = MAX_OCTAVE;
  lowestOctave = MIN_OCTAVE;
  notes = buildNotes();
  render();
}

function getComposeCellSize() {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--compose-cell')) || 40;
}

function scrollToMiddleNotes() {
  if (!scoreScroll) return;
  const firstMiddleIndex = notes.findIndex((note) => note.octave === 4 && note.key === 'si');
  if (firstMiddleIndex < 0) return;
  const cellSize = getComposeCellSize();
  const middleOffset = firstMiddleIndex * cellSize + (NOTE_ORDER.length * cellSize) / 2;
  const nextTop = Math.max(0, middleOffset - scoreScroll.clientHeight / 2);
  scoreScroll.scrollTo({ top: nextTop, behavior: 'smooth' });
}

function scrollC4RangeToCenter(behavior = 'auto') {
  if (!scoreScroll) return;
  const firstMiddleIndex = notes.findIndex((note) => note.octave === 4 && note.key === 'si');
  if (firstMiddleIndex < 0) return;
  const cellSize = getComposeCellSize();
  const middleRangeCenter = firstMiddleIndex * cellSize + (NOTE_ORDER.length * cellSize) / 2;
  const nextTop = Math.max(0, middleRangeCenter - scoreScroll.clientHeight / 2);
  scoreScroll.scrollTo({ top: nextTop, behavior });
}

function localized(value) {
  if (value && typeof value === 'object') return value[currentLanguage] || value.en || value.ko || '';
  return value || '';
}

const noteNameLabels = {
  ko: {
    do: '도',
    re: '레',
    mi: '미',
    fa: '파',
    sol: '솔',
    la: '라',
    si: '시',
    me: '미♭'
  },
  en: {
    do: 'C',
    re: 'D',
    mi: 'E',
    fa: 'F',
    sol: 'G',
    la: 'A',
    si: 'B',
    me: 'E♭'
  }
};

function updateNoteNameLabels() {
  const labels = noteNameLabels[currentLanguage] || noteNameLabels.en;
  document.querySelectorAll('[data-note-key]').forEach((element) => {
    const key = element.dataset.noteKey;
    if (labels[key]) element.textContent = labels[key];
  });
}

function applyTheme(nextPreference, persist = true) {
  const preference = ['light', 'dark', 'system'].includes(nextPreference) ? nextPreference : 'system';
  const theme = preference === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : preference;
  currentThemePreference = preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#111214' : '#ffffff'
  );
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, preference);
  document.querySelectorAll('button[data-theme-preference]').forEach((button) => {
    const isSelected = button.dataset.themePreference === preference;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  const selectedButton = document.querySelector(`button[data-theme-preference="${preference}"]`);
  const selectedLabel = currentLanguage === 'ko' ? selectedButton?.dataset.labelKo : selectedButton?.dataset.labelEn;
  if (currentThemeLabel && selectedLabel) currentThemeLabel.textContent = selectedLabel;
}

function setLessonTensionEnabled(enabled) {
  lessonTensionEnabled = Boolean(enabled);
  const harmonyDemo = document.querySelector('.lesson-harmony-demo');
  harmonyDemo?.classList.toggle('has-tension', lessonTensionEnabled);
  lessonTensionToggle?.setAttribute('aria-pressed', String(lessonTensionEnabled));
}

function applyLanguage(nextLanguage = currentLanguage) {
  currentLanguage = nextLanguage === 'en' ? 'en' : 'ko';
  document.documentElement.lang = currentLanguage;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  const dictionary = translations[currentLanguage] || translations.en;

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (dictionary[key] != null) element.textContent = dictionary[key];
  });
  document.querySelectorAll('[data-i18n-html]').forEach((element) => {
    const key = element.dataset.i18nHtml;
    if (dictionary[key] != null) element.innerHTML = dictionary[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (dictionary[key] != null) element.setAttribute('placeholder', dictionary[key]);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (dictionary[key] != null) element.setAttribute('aria-label', dictionary[key]);
  });
  document.querySelectorAll('button[data-theme-preference]').forEach((button) => {
    const label = currentLanguage === 'ko' ? button.dataset.labelKo : button.dataset.labelEn;
    if (label) button.querySelector('span:first-child').textContent = label;
  });
  const themePickerTitle = themePicker?.querySelector('.theme-picker-title');
  if (themePickerTitle) {
    themePickerTitle.textContent = currentLanguage === 'ko'
      ? themePickerTitle.dataset.labelKo
      : themePickerTitle.dataset.labelEn;
  }
  updateNoteNameLabels();
  refreshIntentPromptPlaceholder();
  ensureAIPromptRequiredMarker();
  localizeSelectOptions();

  if (languageToggle) {
    const isKorean = currentLanguage === 'ko';
    const currentText = isKorean ? '한글' : 'ENG';
    const nextText = isKorean ? '영어' : 'KOR';
    languageToggle.classList.toggle('is-korean-labels', isKorean);
    languageToggle.querySelector('.language-current')?.replaceChildren(document.createTextNode(currentText));
    languageToggle.querySelector('.language-next')?.replaceChildren(document.createTextNode(nextText));
    languageToggle.setAttribute('aria-label', isKorean ? '영어로 전환' : '한국어로 전환');
  }
  document.querySelectorAll("[data-language]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
  });
  applyTheme(currentThemePreference, false);
  syncControlButtons();
  updateHarmonyTypeControls();
  validateAICoachForm(false);
  const languageAnalysis = playbackAnalysis || analyzeComposition();
  renderMoodMetrics(languageAnalysis);
  renderFeedback(languageAnalysis);
  renderAICoachResult();
  if (isPlaying) startCaptionCycle(languageAnalysis);
  else renderLocalMoodCaption(languageAnalysis);
  renderLessonStep();
  renderLessonMood();

  updateDashboardLanguageLabels();
  updateUserStatus();
  renderMySongs();
  renderArchive();
  if (middleNotesButton) middleNotesButton.textContent = translate('middle');
  if (dashboardModal && !dashboardModal.hidden) void renderDashboard();
  else renderDashboardProfile();
  renderHapticStatus();
}

function renderLessonStep() {
  const track = lessonTracks[lessonTrack];
  if (!track || !lessonDemo || !lessonStepLabel || !lessonTitle || !lessonText) return;
  lessonDemo.dataset.step = String(lessonStep);
  lessonDemo.dataset.track = lessonTrack;
  lessonView?.classList.toggle('is-mood-mode', lessonTrack === 'feedback');
  lessonTrackButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.lessonTrack === lessonTrack);
  });
  lessonStepLabel.textContent = typeof track.label === 'function' ? track.label() : track.label;
  lessonTitle.textContent = localized(typeof track.title === 'function' ? track.title() : track.title);
  lessonText.textContent = localized(typeof track.text === 'function' ? track.text() : track.text);
  if (lessonPrevButton) lessonPrevButton.disabled = lessonTrackOrder.indexOf(lessonTrack) === 0;
  if (lessonNextButton) lessonNextButton.textContent = lessonTrack === 'feedback' ? 'Compose' : 'Next';
  if (lessonStartButton) lessonStartButton.hidden = lessonTrack !== 'feedback';
  document.dispatchEvent(new Event('soundi:lessonchange'));
}

function setLessonTrack(nextTrack) {
  if (!lessonTracks[nextTrack]) return;
  stopLessonRhythmDemo();
  lessonTrack = nextTrack;
  lessonStep = 0;
  renderLessonStep();
}

function advanceLesson() {
  const currentIndex = lessonTrackOrder.indexOf(lessonTrack);
  if (currentIndex >= 0 && currentIndex < lessonTrackOrder.length - 1) {
    setLessonTrack(lessonTrackOrder[currentIndex + 1]);
    return;
  }
  setView('compose');
}

function retreatLesson() {
  const currentIndex = lessonTrackOrder.indexOf(lessonTrack);
  if (currentIndex > 0) {
    setLessonTrack(lessonTrackOrder[currentIndex - 1]);
  }
}

function setView(viewName) {
  const nextView = viewNames.includes(viewName) ? viewName : 'home';
  if (isArchivePreviewMode && (archivePlayerActive ? nextView !== 'archive' : nextView !== 'compose')) {
    restoreArchivePreviewDraft();
  }
  const wasHome = document.body.dataset.view === 'home';
  const wasCompose = document.body.dataset.view === 'compose';
  if (wasCompose && nextView !== 'compose') stopComposeTimeTracking();
  document.body.dataset.view = nextView;
  const accountArea = document.getElementById('userStatusArea');
  const accountParent = window.matchMedia('(width < 640px)').matches
    ? document.getElementById('primaryNavigation')
    : nextView === 'compose'
    ? document.querySelector('.compose-publish-controls')
    : document.body;
  if (accountArea && accountParent) {
    if (accountParent.id === 'primaryNavigation') accountParent.prepend(accountArea);
    else accountParent.appendChild(accountArea);
  }
  if (!wasCompose && nextView === 'compose') startComposeTimeTracking();
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('is-active', view.id === `${nextView}View`);
  });
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === nextView);
    if (button.dataset.view === nextView) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (nextView !== 'compose' && !(nextView === 'archive' && archivePlayerActive) && isPlaying) stopPlayback();
  renderArchivePlayer();
  if (nextView === 'home' && !wasHome) {
    homeView?.scrollTo({ top: 0, behavior: 'auto' });
  }
  if (nextView === 'compose' && !wasCompose && !hasCenteredComposeOnEntry) {
    hasCenteredComposeOnEntry = true;
    requestAnimationFrame(() => scrollC4RangeToCenter('auto'));
  }
  if (sidePanel?.classList.contains('is-open')) closeSidePanel();
  persistSessionState({ view: nextView });
  updateCursorHint();
  syncComposePublishButton();
}

function getPersistedSessionState() {
  try {
    return {
      view: localStorage.getItem(SESSION_VIEW_KEY),
      analysisTab: localStorage.getItem(SESSION_ANALYSIS_TAB_KEY)
    };
  } catch (error) {
    return { view: null, analysisTab: null };
  }
}

function persistSessionState({ view, analysisTab } = {}) {
  try {
    if (viewNames.includes(view)) localStorage.setItem(SESSION_VIEW_KEY, view);
    if (analysisTabNames.includes(analysisTab)) localStorage.setItem(SESSION_ANALYSIS_TAB_KEY, analysisTab);
  } catch (error) {
    // Ignore storage failures in private/file contexts.
  }
}

function openSidePanel() {
  if (!sidePanel || !sideTabButton) return;
  sidePanel.classList.add('is-open');
  sidePanel.setAttribute('aria-hidden', 'false');
  sideTabButton.setAttribute('aria-expanded', 'true');
}

function closeSidePanel() {
  if (!sidePanel || !sideTabButton) return;
  sidePanel.classList.remove('is-open');
  sidePanel.setAttribute('aria-hidden', 'true');
  sideTabButton.setAttribute('aria-expanded', 'false');
}

function initScrollReveals() {
  if (!revealItems.length) return;
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  app?.classList.add('is-animated');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
    });
  }, {
    root: null,
    threshold: 0.45
  });

  revealItems.forEach((item) => observer.observe(item));
}

function initSoftSectionScroll() {
  const getScrollRoot = () => document.querySelector('#homeView.is-active');
  const getSections = () => [...document.querySelectorAll('#homeView.is-active .reveal')];
  let wheelIntent = 0;
  let wheelIntentTimer = 0;
  let wheelLockUntil = 0;
  const resetWheelIntent = () => {
    wheelIntent = 0;
    window.clearTimeout(wheelIntentTimer);
  };

  window.addEventListener('wheel', (event) => {
    const scrollRoot = getScrollRoot();
    const sections = getSections();
    if (!scrollRoot || sections.length < 2) return;

    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (isSectionScrolling || now < wheelLockUntil) return;

    const sectionHeight = Math.max(1, scrollRoot.clientHeight);
    const deltaModeLine = 1;
    const deltaModePage = 2;
    const delta = event.deltaMode === deltaModeLine
      ? event.deltaY * 40
      : event.deltaMode === deltaModePage
        ? event.deltaY * sectionHeight
        : event.deltaY;
    const absDelta = Math.abs(delta);
    const isMouseWheelStep = absDelta >= 72 || event.deltaMode !== 0;
    const intentThreshold = isMouseWheelStep ? 36 : 96;

    wheelIntent += delta;
    window.clearTimeout(wheelIntentTimer);
    wheelIntentTimer = window.setTimeout(resetWheelIntent, 220);

    if (Math.abs(wheelIntent) < intentThreshold) return;

    const positions = sections.map((_, index) => Math.round(sectionHeight * index));
    const currentY = scrollRoot.scrollTop;
    const currentIndex = Math.min(sections.length - 1, Math.max(0, Math.round(currentY / sectionHeight)));

    const direction = wheelIntent > 0 ? 1 : -1;
    const nextIndex = Math.min(sections.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex === currentIndex) {
      resetWheelIntent();
      return;
    }

    resetWheelIntent();
    isSectionScrolling = true;
    wheelLockUntil = now + 1150;
    const targetY = positions[nextIndex];
    updateCursorHint();
    scrollRoot.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
    window.setTimeout(() => {
      scrollRoot.scrollTo({
        top: targetY,
        behavior: 'auto'
      });
      window.setTimeout(() => {
        resetWheelIntent();
        isSectionScrolling = false;
      }, 260);
    }, 860);
  }, { passive: false, capture: true });
}

function initHomePointerGuards() {
  const isHomeSurfaceEvent = (event) => {
    const home = document.querySelector('#homeView.is-active');
    if (!home?.contains(event.target)) return false;
    return !event.target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]');
  };

  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'selectstart', 'dragstart'].forEach((type) => {
    document.addEventListener(type, (event) => {
      if (!isHomeSurfaceEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });
  });
}

function isHomeHeroVisible() {
  const home = document.getElementById('homeView');
  return home?.classList.contains('is-active') && home.scrollTop < 4;
}

function updateCursorHint() {
  if (!customCursor) return;
  activeCursorHintGroup = null;
  window.clearTimeout(cursorHintTimer);
  window.clearTimeout(controlHintExitTimer);
  customCursor.classList.remove('show-hint');
  if (!isHomeHeroVisible()) return;
  setCursorHintText(translate('scrollHint'));
  cursorHintTimer = window.setTimeout(() => {
    if (!isHomeHeroVisible()) return;
    activeCursorHintGroup = 'home';
    positionCursorHint();
    customCursor.classList.add('show-hint');
  }, 1000);
}

function setCursorHintText(text) {
  const hint = customCursor?.querySelector('.cursor-hint');
  if (!hint) return;
  hint.innerHTML = text;
  scheduleCursorHintPosition();
}

function scheduleCursorPaint() {
  if (cursorFrame) return;
  cursorFrame = window.requestAnimationFrame(() => {
    cursorFrame = null;
    customCursor.classList.add('is-visible');
    customCursor.style.transform = `translate3d(${lastPointerX}px, ${lastPointerY}px, 0)`;
  });
}

function scheduleCursorHintPosition() {
  if (cursorHintFrame) return;
  cursorHintFrame = window.requestAnimationFrame(() => {
    cursorHintFrame = null;
    positionCursorHint();
  });
}

function positionCursorHint() {
  if (!customCursor) return;
  const hint = customCursor.querySelector('.cursor-hint');
  if (!hint) return;
  const rect = hint.getBoundingClientRect();
  const margin = 12;
  const defaultX = 14;
  const defaultY = 10;
  const nextX = lastPointerX + defaultX + rect.width > window.innerWidth - margin
    ? -rect.width - defaultX
    : defaultX;
  const nextY = lastPointerY + defaultY + rect.height > window.innerHeight - margin
    ? -rect.height - defaultY
    : defaultY;
  customCursor.style.setProperty('--hint-x', nextX + 'px');
  customCursor.style.setProperty('--hint-y', nextY + 'px');
}

function initCustomCursor() {
  if (!customCursor || window.matchMedia('(pointer: coarse)').matches) return;

  window.addEventListener('pointermove', (event) => {
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    scheduleCursorPaint();
    if (customCursor.classList.contains('show-hint')) scheduleCursorHintPosition();
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    customCursor.classList.remove('is-visible');
  });

  const bindCursorHint = (element) => {
    element.addEventListener('pointerenter', () => {
      window.clearTimeout(cursorHintTimer);
      window.clearTimeout(controlHintExitTimer);
      const wasControlHintVisible = activeCursorHintGroup === 'controls' && customCursor.classList.contains('show-hint');
      setCursorHintText(element.dataset.hint || 'click?');
      activeCursorHintGroup = 'controls';
      if (wasControlHintVisible) return;
      customCursor.classList.remove('show-hint');
      cursorHintTimer = window.setTimeout(() => {
        activeCursorHintGroup = 'controls';
        positionCursorHint();
        customCursor.classList.add('show-hint');
      }, 1000);
    });
    element.addEventListener('pointerleave', (event) => {
      if (event.relatedTarget?.closest?.('.control-button')) return;
      window.clearTimeout(controlHintExitTimer);
      controlHintExitTimer = window.setTimeout(updateCursorHint, 220);
    });
  };

  const resetScoreHint = () => {
    scoreHintTarget = null;
    if (activeCursorHintGroup === 'harmony' || activeCursorHintGroup === 'reference') {
      updateCursorHint();
    } else {
      window.clearTimeout(cursorHintTimer);
      customCursor.classList.remove('show-hint');
    }
  };

  const updateScoreHint = (snapshot) => {
    const suggestedCell = snapshot.suggestedCell;
    const target = getGridTargetFromPoint(snapshot.x, snapshot.y);
    const note = target ? notes.find((entry) => entry.id === target.noteId) : null;
    const isReferenceArea = note?.octave === 4;
    const nextTarget = suggestedCell
      ? {
        group: 'harmony',
        key: `harmony:${suggestedCell.dataset.noteId}:${suggestedCell.dataset.step}`,
        text: `${suggestedCell.dataset.relation || 'fits'}<br />from selected note`
      }
      : isReferenceArea
        ? {
          group: 'reference',
          key: 'reference-octave',
          text: 'This soft gray<br />area is middle notes'
        }
        : null;

    if (!nextTarget) {
      resetScoreHint();
      return;
    }

    const movement = scoreHintTarget
      ? Math.hypot(snapshot.x - scoreHintTarget.x, snapshot.y - scoreHintTarget.y)
      : Infinity;
    if (scoreHintTarget?.key === nextTarget.key && movement < 4) return;

    window.clearTimeout(cursorHintTimer);
    scoreHintTarget = {
      ...nextTarget,
      x: snapshot.x,
      y: snapshot.y
    };
    activeCursorHintGroup = nextTarget.group;
    customCursor.classList.remove('show-hint');
    setCursorHintText(nextTarget.text);
    cursorHintTimer = window.setTimeout(() => {
      if (!scoreHintTarget || scoreHintTarget.key !== nextTarget.key) return;
      positionCursorHint();
      customCursor.classList.add('show-hint');
    }, 1000);
  };

  const scheduleScoreHint = (event) => {
    pendingScoreHintEvent = {
      x: event.clientX,
      y: event.clientY,
      suggestedCell: event.target?.closest?.('.grid-cell.is-suggested') || null
    };
    if (scoreHintFrame) return;
    scoreHintFrame = window.requestAnimationFrame(() => {
      scoreHintFrame = null;
      const snapshot = pendingScoreHintEvent;
      pendingScoreHintEvent = null;
      if (snapshot) updateScoreHint(snapshot);
    });
  };

  scoreGrid?.addEventListener('pointermove', scheduleScoreHint, { passive: true });
  scoreGrid?.addEventListener('pointerleave', resetScoreHint);

  window.addEventListener('scroll', updateCursorHint, { passive: true });
  homeView?.addEventListener('scroll', updateCursorHint, { passive: true });
  updateCursorHint();
}

function startResize(event) {
  event.preventDefault();
  isResizing = true;
  document.body.classList.add('is-resizing');
  window.addEventListener('pointermove', resizeAnalysisPanel);
  window.addEventListener('pointerup', stopResize, { once: true });
  window.addEventListener('pointercancel', stopResize, { once: true });
}

function resizeAnalysisPanel(event) {
  if (!isResizing) return;
  const width = Math.round(window.innerWidth - event.clientX);
  const min = 320;
  const max = Math.round(window.innerWidth * 0.72);
  const nextWidth = Math.min(max, Math.max(min, width));
  document.documentElement.style.setProperty('--analysis-width', `${nextWidth}px`);
}

function stopResize() {
  isResizing = false;
  document.body.classList.remove('is-resizing');
  window.removeEventListener('pointermove', resizeAnalysisPanel);
  window.removeEventListener('pointerup', stopResize);
  window.removeEventListener('pointercancel', stopResize);
}

function setGuideEnabled(enabled) {
  guideEnabled = enabled;
  if (!guideEnabled) {
    lastSelectedNoteId = null;
    lastSelectedStep = null;
  }
  guideButton?.classList.toggle('is-active', guideEnabled);
  guideButton?.setAttribute('aria-pressed', String(guideEnabled));
  updateHarmonyTypeControls();
  render();
}

function updateHarmonyTypeControls() {
  if (!harmonyTypeControl || !harmonyTypeButton) return;
  harmonyTypeControl.hidden = !guideEnabled;
  if (tensionControl) tensionControl.hidden = !guideEnabled;
  harmonyTypeButton.textContent = localized(HARMONY_TYPES[harmonyType]?.label) || 'Major Triad';
  if (tensionButton) {
    tensionButton.textContent = localized(TENSION_TYPES[tensionType]?.label) || 'Tension Off';
    tensionButton.classList.toggle('has-tension', tensionType !== 'none');
  }
  if (!guideEnabled) {
    closeHarmonyTypeMenu();
    closeTensionMenu();
  }
  harmonyTypeMenu?.querySelectorAll('[data-harmony-type]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.harmonyType === harmonyType));
  });
  tensionMenu?.querySelectorAll('[data-tension-type]').forEach((button) => {
    button.setAttribute('aria-checked', String(button.dataset.tensionType === tensionType));
  });
}

function openHarmonyTypeMenu() {
  if (!harmonyTypeMenu || !harmonyTypeButton || !guideEnabled) return;
  harmonyTypeMenu.hidden = false;
  harmonyTypeButton.classList.add('is-active');
  harmonyTypeButton.setAttribute('aria-expanded', 'true');
}

function closeHarmonyTypeMenu() {
  if (!harmonyTypeMenu || !harmonyTypeButton) return;
  harmonyTypeMenu.hidden = true;
  harmonyTypeButton.classList.remove('is-active');
  harmonyTypeButton.setAttribute('aria-expanded', 'false');
}

function openTensionMenu() {
  if (!tensionMenu || !tensionButton || !guideEnabled) return;
  tensionMenu.hidden = false;
  tensionButton.classList.add('is-active');
  tensionButton.setAttribute('aria-expanded', 'true');
}

function closeTensionMenu() {
  if (!tensionMenu || !tensionButton) return;
  tensionMenu.hidden = true;
  tensionButton.classList.remove('is-active');
  tensionButton.setAttribute('aria-expanded', 'false');
}

function toggleTensionMenu() {
  if (!tensionMenu || tensionMenu.hidden) {
    openTensionMenu();
    return;
  }
  closeTensionMenu();
}

function toggleHarmonyTypeMenu() {
  if (!harmonyTypeMenu || harmonyTypeMenu.hidden) {
    openHarmonyTypeMenu();
    return;
  }
  closeHarmonyTypeMenu();
}

function setHarmonyType(type) {
  if (!HARMONY_TYPES[type]) return;
  harmonyType = type;
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  closeHarmonyTypeMenu();
  updateHarmonyTypeControls();
  render();
}

function setTensionType(type) {
  if (!TENSION_TYPES[type]) return;
  tensionType = type;
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  closeTensionMenu();
  updateHarmonyTypeControls();
  render();
}

function setExampleMode(enabled) {
  if (enabled === isExampleMode) return;
  pushUndoState();
  if (enabled) {
    draftComposition = composition.map((item) => ({ ...item }));
    draftStepCount = STEP_COUNT;
    draftTitle = compositionTitle;
    isExampleMode = true;
    document.body.classList.add('is-example-mode');
    exampleButton?.classList.add('is-active');
    exampleButton?.setAttribute('aria-pressed', 'true');
    setAnalysisTab('visual');
    setGuideEnabled(false);
    loadExample(currentExampleIndex, false);
    return;
  }
  if (isPlaying) stopPlayback();
  isExampleMode = false;
  document.body.classList.remove('is-example-mode');
  exampleButton?.classList.remove('is-active');
  exampleButton?.setAttribute('aria-pressed', 'false');
  STEP_COUNT = draftStepCount || 64;
  composition = draftComposition.map((item) => ({ ...item }));
  compositionTitle = draftTitle || 'Untitled';
  editingArchiveId = null;
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  ensureOctaveRangeForComposition();
  updateExampleControls();
  render();
  playhead.style.setProperty('--progress', '0%');
}

function openExampleSongs() {
  setExampleMode(!isExampleMode);
}

function expandExampleNotes(items) {
  return items.flatMap(([noteId, step, length = 1], index) => Array.from({ length }, (_, offset) => ({
    id: 'example-' + currentExampleIndex + '-' + index + '-' + offset,
    noteId,
    step: step + offset
  })));
}

function loadExample(index, pushUndo = true) {
  if (pushUndo) pushUndoState();
  if (isPlaying) stopPlayback();
  currentExampleIndex = (index + exampleCompositions.length) % exampleCompositions.length;
  if (isExampleMode && guideEnabled) setGuideEnabled(false);
  const example = exampleCompositions[currentExampleIndex];
  const maxStep = Math.max(...example.notes.map(([, step, length = 1]) => step + length), 31);
  STEP_COUNT = Math.max(64, maxStep + 8);
  composition = expandExampleNotes(example.notes);
  editingArchiveId = null;
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  ensureOctaveRangeForComposition();
  updateExampleControls();
  render();
  if (scoreScroll) {
    scoreScroll.scrollLeft = 0;
    requestAnimationFrame(() => scrollC4RangeToCenter('auto'));
  }
}

function ensureOctaveRangeForComposition() {
  composition.forEach((item) => { if (!Number.isFinite(item.accidental)) item.accidental = 0; });
  highestOctave = MAX_OCTAVE;
  lowestOctave = MIN_OCTAVE;
  notes = buildNotes();
}

function updateExampleControls() {
  updateTitleDisplay();
  syncControlButtons();
}

function getCurrentTitle() {
  const title = compositionTitle.trim();
  return title || 'Untitled';
}

function updateTitleDisplay() {
  if (!exampleName) return;
  const readOnlyTitle = isExampleMode || isArchivePreviewMode || isPublishedLocked;
  exampleName.textContent = isExampleMode ? exampleCompositions[currentExampleIndex].title : getCurrentTitle();
  exampleName.classList.remove('is-editing-title');
  exampleName.contentEditable = String(!readOnlyTitle);
  exampleName.setAttribute('role', readOnlyTitle ? 'text' : 'textbox');
  exampleName.setAttribute('aria-label', isArchivePreviewMode ? 'Archived song title' : (isExampleMode ? 'Example song title' : 'Composition title'));
  updateDurationDisplay();
}

function getCompositionDurationSeconds() {
  if (!composition.length) return 0;
  return getLoopBounds().end * getStepIntervalSeconds();
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0');
}

function updateDurationDisplay() {
  if (!compositionDuration) return;
  compositionDuration.textContent = formatDuration(getCompositionDurationSeconds());
}

function updatePlaybackPositionDisplay(step) {
  if (!compositionDuration || !isPlaying) return;
  const seconds = step * getStepIntervalSeconds();
  compositionDuration.textContent = formatDuration(seconds);
}

function beginTitleEdit() {
  if (isExampleMode || isArchivePreviewMode || isPublishedLocked || !exampleName) return;
  exampleName.classList.add('is-editing-title');
  exampleName.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(exampleName);
  selection.removeAllRanges();
  selection.addRange(range);
}

function commitTitleEdit() {
  if (!exampleName || isExampleMode) return;
  exampleName.scrollLeft = 0;
  exampleName.classList.remove('is-editing-title');
  const nextTitle = exampleName.textContent.trim() || 'Untitled';
  if (nextTitle !== compositionTitle) pushUndoState();
  compositionTitle = nextTitle;
  updateTitleDisplay();
}

function handleTitleKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    exampleName?.blur();
  }
}

function setControlIcon(button, iconName, label) {
  if (!button) return;
  button.innerHTML = controlIcons[iconName] || '';
  button.setAttribute('aria-label', label);
  button.dataset.icon = iconName;
  const hints = {
    Play: 'click to<br />play',
    Pause: 'click to<br />pause',
    Save: 'save this<br />piece',
    Clear: 'start<br />over',
    'Previous example': 'previous<br />song',
    'Next example': 'next<br />song'
  };
  button.dataset.hint = hints[label] || label.toLowerCase() + '?';
  const tooltipLabels = {
    Play: { ko: '재생', en: 'Play' },
    Pause: { ko: '일시정지', en: 'Pause' },
    Save: { ko: '다운로드', en: 'Download' },
    Clear: { ko: '전부 지우기', en: 'Clear all' },
    'Previous example': { ko: '이전 곡', en: 'Previous' },
    'Next example': { ko: '다음 곡', en: 'Next' }
  };
  const tooltip = tooltipLabels[label];
  button.dataset.tooltip = tooltip?.[currentLanguage] || label;
  if (label === 'Clear') button.setAttribute('aria-label', currentLanguage === 'ko' ? '전부 지우기' : 'Clear all');
}

function syncControlButtons() {
  setControlIcon(playButton, isPlaying ? 'pause' : 'play', isPlaying ? 'Pause' : 'Play');
  setControlIcon(saveButton, isExampleMode ? 'prev' : 'save', isExampleMode ? 'Previous example' : 'Save');
  setControlIcon(clearButton, isExampleMode ? 'next' : 'clear', isExampleMode ? 'Next example' : 'Clear');
  if (saveButton) saveButton.disabled = isArchivePreviewMode || isPublishedLocked;
  if (clearButton) clearButton.disabled = isArchivePreviewMode || isPublishedLocked;
}

function flashControl(button) {
  if (!button) return;
  button.classList.add('is-feedback');
  window.setTimeout(() => button.classList.remove('is-feedback'), 420);
}

function syncVolumeButton() {
  if (!volumeButton) return;
  const volumePercent = Math.round(volumeLevel * 100);
  const displayedVolumePercent = isMuted ? 0 : volumePercent;
  volumeButton.innerHTML = controlIcons[isMuted ? 'muted' : 'volume'];
  volumeButton.setAttribute('aria-pressed', String(isMuted));
  volumeButton.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
  volumeButton.dataset.hint = isMuted ? 'sound<br />off' : 'volume';
  volumeSlider?.style.setProperty('--volume-level', `${displayedVolumePercent}%`);
  if (volumeValueLabel) volumeValueLabel.textContent = String(displayedVolumePercent);
  if (volumeSlider && Number(volumeSlider.value) !== displayedVolumePercent) {
    volumeSlider.value = String(displayedVolumePercent);
  }
  document.dispatchEvent(new Event('soundi:volumechange'));
}

function setVolumeLevel(nextLevel) {
  volumeLevel = Math.max(0, Math.min(1, nextLevel));
  isMuted = volumeLevel <= 0;
  ensureAudio();
  syncMasterVolume();
  syncVolumeButton();
}

function showVolumeValueLabel() {
  if (!volumePopover) return;
  volumePopover.classList.add('is-adjusting');
  window.clearTimeout(volumeAdjustTimer);
  volumeAdjustTimer = window.setTimeout(() => {
    volumePopover.classList.remove('is-adjusting');
  }, 620);
}

function toggleVolumePopover() {
  if (!volumePopover) return;

  if (volumePopover.hidden) {
    volumePopover.hidden = false;
    volumeSlider?.focus();
    return;
  }

  if (isMuted) {
    volumeLevel = 0.5;
    isMuted = false;
  } else {
    isMuted = true;
  }

  ensureAudio();
  syncMasterVolume();
  syncVolumeButton();
}

function closeVolumePopover() {
  if (volumePopover) volumePopover.hidden = true;
}

function showPreviousExample() {
  loadExample(currentExampleIndex - 1);
}

function showNextExample() {
  loadExample(currentExampleIndex + 1);
}

function importCurrentExampleAsComposition() {
  if (!isExampleMode) return;
  pushUndoState();
  if (isPlaying) stopPlayback();
  const importedAt = Date.now();
  const example = exampleCompositions[currentExampleIndex];
  composition = composition.map((item, index) => ({
    ...item,
    id: `imported-example-${importedAt}-${index}`
  }));
  compositionTitle = example?.title || 'Untitled';
  isExampleMode = false;
  editingArchiveId = null;
  lastSelectedNoteId = null;
  lastSelectedStep = null;
  document.body.classList.remove('is-example-mode');
  exampleButton?.classList.remove('is-active');
  exampleButton?.setAttribute('aria-pressed', 'false');
  ensureOctaveRangeForComposition();
  setAnalysisTab('visual');
  updateExampleControls();
  render();
  playhead.style.setProperty('--progress', '0%');
}

function pushUndoState() {
  undoStack.push({
    stepCount: STEP_COUNT,
    highestOctave,
    lowestOctave,
    composition: composition.map((item) => ({ ...item })),
    editingArchiveId,
    lastSelectedNoteId,
    lastSelectedStep,
    compositionTitle,
    isExampleMode,
    currentExampleIndex
  });
  if (undoStack.length > 80) undoStack.shift();
}

function undoComposition() {
  const previous = undoStack.pop();
  if (!previous) return;
  if (isPlaying) stopPlayback();
  STEP_COUNT = previous.stepCount;
  highestOctave = MAX_OCTAVE;
  lowestOctave = MIN_OCTAVE;
  notes = buildNotes();
  composition = previous.composition.map((item) => ({ ...item }));
  editingArchiveId = previous.editingArchiveId;
  lastSelectedNoteId = previous.lastSelectedNoteId;
  lastSelectedStep = previous.lastSelectedStep;
  compositionTitle = previous.compositionTitle || 'Untitled';
  isExampleMode = previous.isExampleMode;
  currentExampleIndex = previous.currentExampleIndex;
  document.body.classList.toggle('is-example-mode', isExampleMode);
  exampleButton?.classList.toggle('is-active', isExampleMode);
  exampleButton?.setAttribute('aria-pressed', String(isExampleMode));
  if (isExampleMode) setAnalysisTab('visual');
  updateExampleControls();
  render();
  playhead.style.setProperty('--progress', '0%');
}

function handleKeyboardShortcuts(event) {
  const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
  if (!isUndo) return;
  event.preventDefault();
  undoComposition();
}
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
playButton.addEventListener('click', togglePlayback);
saveButton.addEventListener('click', async () => {
  if (isArchivePreviewMode || isPublishedLocked) return;
  if (isExampleMode) {
    showPreviousExample();
    return;
  }
  if (!composition.length) {
    flashControl(saveButton);
    return;
  }
  await saveComposition(draftCover);
});
coverCloseButton?.addEventListener('click', closeCoverModal);
coverModal?.querySelector('[data-cover-close]')?.addEventListener('click', closeCoverModal);
coverOptionButtons.forEach((button) => {
  button.addEventListener('click', () => setDraftCoverFromButton(button));
});
coverImageInput?.addEventListener('change', handleCoverImageInput);
coverTitleInput?.addEventListener('input', renderCoverPreview);
publishCoverButton?.addEventListener('click', publishCoverComposition);
composePublishButton?.addEventListener('click', () => {
  if (isArchivePreviewMode || !composition.length) return;
  if (currentUser?.role !== 'general') {
    openLoginModal();
    return;
  }
  openCoverModal();
});
mySongsToggle?.addEventListener('click', toggleMySongsPanel);
newSongButton?.addEventListener('click', startNewSong);
savedSongsTab?.addEventListener('click', () => setMySongsFilter('saved'));
publishedSongsTab?.addEventListener('click', () => setMySongsFilter('published'));
clearButton.addEventListener('click', () => {
  if (isArchivePreviewMode || isPublishedLocked) return;
  if (!composition.length) return;
  runDeleteChip(() => { clearComposition(); return true; });
});
exampleName?.addEventListener('click', beginTitleEdit);
exampleName?.addEventListener('blur', commitTitleEdit);
exampleName?.addEventListener('keydown', handleTitleKeydown);
importExampleButton?.addEventListener('click', importCurrentExampleAsComposition);
guideButton?.addEventListener('click', () => setGuideEnabled(!guideEnabled));
harmonyTypeButton?.addEventListener('click', toggleHarmonyTypeMenu);
harmonyTypeMenu?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-harmony-type]');
  if (!button) return;
  setHarmonyType(button.dataset.harmonyType);
});
tensionButton?.addEventListener('click', toggleTensionMenu);
tensionMenu?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tension-type]');
  if (!button) return;
  setTensionType(button.dataset.tensionType);
});
document.addEventListener('pointerdown', (event) => {
  if (harmonyTypeControl?.contains(event.target) || tensionControl?.contains(event.target)) return;
  if (event.target.closest?.('.custom-select')) return;
  if (volumeControl?.contains(event.target)) return;
  closeVolumePopover();
  closeAllCustomSelects();
  closeHarmonyTypeMenu();
  closeTensionMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAllCustomSelects();
    closeVolumePopover();
  }
});
exampleButton?.addEventListener('click', openExampleSongs);
intentPrompt?.addEventListener('input', clearAICoachFormMessage);
aiNativeSelects.forEach((select) => {
  select.addEventListener('change', clearAICoachFormMessage);
});
aiAnalyzeButton?.addEventListener('click', analyzeWithAICoach);
aiCoachResult?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-ai-action="apply-edits"]');
  if (!button) return;
  applyAICoachOperations();
});
analysisTabs.forEach((button) => {
  button.addEventListener('click', () => setAnalysisTab(button.dataset.analysisTab));
});
middleNotesButton?.addEventListener('click', scrollToMiddleNotes);
volumeButton?.addEventListener('click', toggleVolumePopover);
volumeSlider?.addEventListener('input', () => {
  setVolumeLevel(Number(volumeSlider.value) / 100);
  showVolumeValueLabel();
});
volumeSlider?.addEventListener('pointerdown', showVolumeValueLabel);
volumeSlider?.addEventListener('focus', showVolumeValueLabel);
window.addEventListener('keydown', handleKeyboardShortcuts);
scoreGrid?.addEventListener('pointerdown', beginGridDragFromEvent);
scoreGrid?.addEventListener('pointermove', continueGridDragFromEvent);
scoreScroll?.addEventListener('scroll', extendScoreIfNeeded, { passive: true });
scoreScroll?.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  setComposeZoom(composeZoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
}, { passive: false });
zoomOutButton?.addEventListener('click', () => setComposeZoom(composeZoom - ZOOM_STEP));
zoomInButton?.addEventListener('click', () => setComposeZoom(composeZoom + ZOOM_STEP));
resetZoomButton?.addEventListener('click', () => setComposeZoom(1));
zoomLabel?.addEventListener('focus', () => zoomLabel.select());
zoomLabel?.addEventListener('blur', commitZoomInput);
zoomLabel?.addEventListener('keydown', handleZoomInputKeydown);
lessonTrackButtons.forEach((button) => {
  button.addEventListener('click', () => setLessonTrack(button.dataset.lessonTrack));
});
lessonNoteButtons.forEach((button) => {
  button.addEventListener('click', () => playLessonNote(button));
  button.addEventListener('animationend', () => button.classList.remove('is-playing'));
});
lessonRhythmGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-rhythm-play]');
  if (button) toggleLessonRhythmDemo(button.dataset.rhythmPlay);
});
lessonPrevButton?.addEventListener('click', retreatLesson);
lessonNextButton?.addEventListener('click', advanceLesson);
setLessonTensionEnabled(true);
lessonTensionToggle?.addEventListener('click', () => {
  setLessonTensionEnabled(!lessonTensionEnabled);
});
document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => applyLanguage(button.dataset.language));
});
languageToggle?.addEventListener('click', () => {
  const nextLanguage = currentLanguage === 'ko' ? 'en' : 'ko';
  applyLanguage(nextLanguage);

  languageToggle.classList.remove('is-switching');
  void languageToggle.offsetWidth;
  languageToggle.classList.add('is-switching');
  window.setTimeout(() => {
    languageToggle.classList.remove('is-switching');
  }, 520);
});
document.querySelectorAll('button[data-theme-preference]').forEach((button) => {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.themePreference);
    if (themePicker) themePicker.hidden = true;
    if (userMenu) userMenu.hidden = true;
    themeMenuButton?.setAttribute('aria-expanded', 'false');
    userStatusButton?.setAttribute('aria-expanded', 'false');
  });
});
systemThemeQuery.addEventListener('change', () => {
  if (currentThemePreference === 'system') applyTheme('system', false);
});
window.addEventListener('popstate', () => {
  if (!clearHistorySnapshot) return;

  restoringClearFromHistory = true;
  if (isPlaying) stopPlayback();

  composition = clearHistorySnapshot.composition.map((entry) => ({ ...entry }));
  STEP_COUNT = clearHistorySnapshot.stepCount || 64;
  compositionTitle = clearHistorySnapshot.title || 'Untitled';
  currentSongId = clearHistorySnapshot.songId || null;
  draftCover = normalizeCover(clearHistorySnapshot.cover || { type: 'block', color: '#ffdc21', image: '' });
  lastSelectedNoteId = clearHistorySnapshot.lastSelectedNoteId || null;
  lastSelectedStep = Number.isFinite(clearHistorySnapshot.lastSelectedStep)
    ? clearHistorySnapshot.lastSelectedStep
    : null;

  clearHistorySnapshot = null;
  ensureOctaveRangeForComposition();
  updateTitleDisplay();
  syncControlButtons();
  render();
  renderMySongs();
  syncComposePublishButton();
  playhead?.style.setProperty('--progress', '0%');

  restoringClearFromHistory = false;
});

window.addEventListener('resize', handleComposeResize);
resizeHandle.addEventListener('pointerdown', startResize);
sideTabButton?.addEventListener('click', openSidePanel);
closePanelButton?.addEventListener('click', closeSidePanel);

updateHarmonyTypeControls();
initCustomSelects();
const persistedSessionState = getPersistedSessionState();
setAnalysisTab(analysisTabNames.includes(persistedSessionState.analysisTab) ? persistedSessionState.analysisTab : 'visual');
resizeIntentPrompt();
updateTitleDisplay();
syncControlButtons();
syncVolumeButton();
const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
applyLanguage(savedLanguage === 'en' ? 'en' : 'ko');
setComposeZoom(1, false);
render();
renderArchive();
loadSharedArchive();
renderLessonRhythmGrid();
startLessonMoodLoop();
setView(viewNames.includes(persistedSessionState.view) ? persistedSessionState.view : 'home');
initScrollReveals();
initSoftSectionScroll();
initHomePointerGuards();
initCustomCursor();

// Soundi login motion + localization final
(() => {
  const modal = document.getElementById('loginModal');
  const panel = document.getElementById('adminLoginPanel');
  const adminButton = document.getElementById('adminLoginButton');
  const googleButton = document.getElementById('googleLoginButton');
  const languageButton = document.getElementById('languageToggle');
  const orbs = [...document.querySelectorAll('#loginModal .login-orb')];
  if (!modal) return;

  const updateLoginCopy = () => {
    const ko = document.documentElement.lang !== 'en';
    const title = document.getElementById('loginTitle');
    if (title && !title.classList.contains('scramble-ready')) title.textContent = 'SOUNDI';
    const googleText = googleButton?.querySelector('span:last-child');
    if (googleText) googleText.textContent = ko ? 'Google로 계속하기' : 'Continue with Google';
    if (adminButton) adminButton.textContent = ko ? '관리자' : 'Admin';
    const caption = panel?.querySelector('.admin-login-caption');
    if (caption) caption.textContent = ko ? '관리자 로그인' : 'Admin login';
    const label = document.getElementById('loginInputLabel');
    if (label) label.textContent = ko ? '관리자 비밀번호' : 'Admin password';
    const input = document.getElementById('nicknameInput');
    if (input) input.placeholder = ko ? '비밀번호 입력' : 'Enter password';
    const submit = document.getElementById('loginSubmitButton');
    if (submit) submit.textContent = ko ? '로그인' : 'Log in';
    const hint = document.querySelector('#customCursor .cursor-hint');
    if (hint && !modal.hidden) {
      hint.textContent = ko ? '반가워요' : 'Welcome';
      document.getElementById('customCursor')?.classList.add('show-hint');
    }
  };

  adminButton?.addEventListener('click', () => { panel.hidden = false; requestAnimationFrame(() => document.getElementById('nicknameInput')?.focus()); });
  panel?.addEventListener('click', (event) => { if (event.target === panel) panel.hidden = true; });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && panel && !panel.hidden) panel.hidden = true; });
  languageButton?.addEventListener('click', () => requestAnimationFrame(updateLoginCopy));

  const palette = ['#ff3b30','#ff7a00','#ffdc21','#00c900','#65d2ee','#3f6df6','#854cf5'];
  const shuffledColors = [...palette].sort(() => Math.random() - 0.5);
  const randomVelocity = () => {
    const speed = 0.55 + Math.random() * 0.85;
    return (Math.random() < 0.5 ? -1 : 1) * speed;
  };
  let pointerX = -9999, pointerY = -9999;
  const states = orbs.map((el,i) => {
    const size = el.getBoundingClientRect().width || 100;
    el.style.setProperty("--orb-color", shuffledColors[i % shuffledColors.length]);
    return {
      el,
      x: innerWidth * (-0.15 + Math.random() * 1.30),
      y: innerHeight * (-0.15 + Math.random() * 1.30),
      vx: randomVelocity(),
      vy: randomVelocity(),
      size
    };
  });
  window.addEventListener('pointermove', e => { pointerX=e.clientX; pointerY=e.clientY; }, {passive:true});
  window.addEventListener('pointerleave', () => { pointerX=pointerY=-9999; });
  function animate(){
    if (!modal.hidden) {
      for (const s of states) {
        s.size=s.el.getBoundingClientRect().width||s.size;
        const cx=s.x+s.size/2, cy=s.y+s.size/2, dx=cx-pointerX, dy=cy-pointerY;
        const d=Math.hypot(dx,dy);
        if (d>0 && d<135) { const f=(135-d)/135*.18; s.vx+=dx/d*f; s.vy+=dy/d*f; }
        s.vx*=.997; s.vy*=.997;
        let speed=Math.hypot(s.vx,s.vy);
        if(speed<.42){
          const angle=Math.random()*Math.PI*2;
          s.vx+=Math.cos(angle)*.028;
          s.vy+=Math.sin(angle)*.028;
          speed=Math.hypot(s.vx,s.vy);
        }
        if(speed>2.1){s.vx=s.vx/speed*2.1;s.vy=s.vy/speed*2.1}
        if (Math.random() < 0.004) {
          const drift = (Math.random() - 0.5) * 0.16;
          s.vx += drift;
          s.vy -= drift * 0.7;
        }
        s.x+=s.vx;s.y+=s.vy;
        if(s.x>innerWidth+s.size)s.x=-s.size;if(s.x<-s.size)s.x=innerWidth+s.size;
        if(s.y>innerHeight+s.size)s.y=-s.size;if(s.y<-s.size)s.y=innerHeight+s.size;
        s.el.style.transform=`translate3d(${s.x}px,${s.y}px,0)`;
      }
      const hint=document.querySelector('#customCursor .cursor-hint');
      if(hint && hint.innerHTML.includes('please')) updateLoginCopy();
    }
    requestAnimationFrame(animate);
  }
  updateLoginCopy();
  animate();
})();


/* Soundi v9 login - roaming + orb-to-orb collision physics v3 */
(() => {
  const palette = [
    "#ff3b30", "#ff7a00", "#ffdc21", "#00c900",
    "#65d2ee", "#3f6df6", "#854cf5"
  ];

  const modal = document.getElementById("loginModal");
  const colors = [...document.querySelectorAll("#loginModal .login-orb-color-layer .login-orb")];
  const shadows = [...document.querySelectorAll("#loginModal .login-orb-shadow-layer .login-orb-shadow")];
  if (!modal || !colors.length || colors.length !== shadows.length) return;

  let pointerX = -9999;
  let pointerY = -9999;
  let prevPointerX = -9999;
  let prevPointerY = -9999;
  let pointerVX = 0;
  let pointerVY = 0;
  let lastPointerTime = performance.now();
  let lastTime = performance.now();

  const SIZE = 108;
  const RADIUS = SIZE / 2;
  const SHADOW_X = -18;
  const SHADOW_Y = 20;

  const shuffle = (values) => {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const chosenColors = shuffle(palette);
  // Faster than the previous version, but differences remain subtle.
  const speedBands = shuffle([1.44, 1.50, 1.56, 1.62, 1.68]);

  const states = colors.map((el, index) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedBands[index % speedBands.length];

    el.style.setProperty("--orb-color", chosenColors[index % chosenColors.length]);

    return {
      el,
      shadow: shadows[index],
      x: (-0.25 + Math.random() * 1.50) * window.innerWidth,
      y: (-0.25 + Math.random() * 1.50) * window.innerHeight,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    };
  });

  const isLoginVisible = () =>
    !modal.hidden &&
    modal.getAttribute("aria-hidden") !== "true" &&
    getComputedStyle(modal).display !== "none";

  function resolveOrbCollisions() {
    for (let i = 0; i < states.length; i += 1) {
      for (let j = i + 1; j < states.length; j += 1) {
        const a = states[i];
        const b = states[j];

        const ax = a.x + RADIUS;
        const ay = a.y + RADIUS;
        const bx = b.x + RADIUS;
        const by = b.y + RADIUS;

        let dx = bx - ax;
        let dy = by - ay;
        let dist = Math.hypot(dx, dy);
        const minDist = SIZE;

        if (dist === 0) {
          dx = 1;
          dy = 0;
          dist = 1;
        }

        if (dist >= minDist) continue;

        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping circles first so they do not stick together.
        const overlap = minDist - dist;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        // Equal-mass elastic collision along the contact normal.
        const relativeNormalVelocity =
          (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;

        if (relativeNormalVelocity >= 0) continue;

        const impulse = -relativeNormalVelocity;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;

        // Tiny extra bounce keeps the GIF-like lively feel without becoming chaotic.
        a.vx -= nx * 0.045;
        a.vy -= ny * 0.045;
        b.vx += nx * 0.045;
        b.vy += ny * 0.045;
      }
    }
  }

  function tick(now) {
    requestAnimationFrame(tick);

    if (!isLoginVisible()) {
      lastTime = now;
      return;
    }

    const dt = Math.min(1.8, Math.max(0.45, (now - lastTime) / 16.667 || 1));
    lastTime = now;

    for (const s of states) {
      const cx = s.x + RADIUS;
      const cy = s.y + RADIUS;
      const dx = cx - pointerX;
      const dy = cy - pointerY;
      const dist = Math.hypot(dx, dy);

      // True cursor "hit": the cursor has to physically enter the circle.
      // The impulse follows the cursor's movement, like flicking a ball.
      const hitRadius = RADIUS + 7;
      if (dist > 0 && dist < hitRadius) {
        if (!s.cursorContact) {
          const cursorSpeed = Math.hypot(pointerVX, pointerVY);
          const nx = dx / dist;
          const ny = dy / dist;

          // Every cursor contact gives the same strong kick.
          // Cursor speed no longer changes the launch speed.
          const impulse = 3.85;

          let hitX;
          let hitY;

          if (cursorSpeed > 0.15) {
            hitX = pointerVX / cursorSpeed;
            hitY = pointerVY / cursorSpeed;
          } else {
            hitX = nx;
            hitY = ny;
          }

          // Fixed-speed flick in the cursor direction.
          s.vx = hitX * impulse + nx * 0.7;
          s.vy = hitY * impulse + ny * 0.7;

          s.cursorContact = true;
        }
      } else if (dist > hitRadius + 12) {
        s.cursorContact = false;
      }

      const speed = Math.hypot(s.vx, s.vy);
      const maxSpeed = 4.8;
      if (speed > maxSpeed) {
        s.vx = (s.vx / speed) * maxSpeed;
        s.vy = (s.vy / speed) * maxSpeed;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }

    resolveOrbCollisions();

    for (const s of states) {
      // The complete colored circle and its offset shadow leave the screen
      // before the pair re-enters from the opposite side.
      const margin = SIZE + 28;

      if (s.x > window.innerWidth + margin) {
        s.x = -SIZE - margin;
      } else if (s.x + SIZE < -margin) {
        s.x = window.innerWidth + margin;
      }

      if (s.y > window.innerHeight + margin) {
        s.y = -SIZE - margin;
      } else if (s.y + SIZE < -margin) {
        s.y = window.innerHeight + margin;
      }

      s.el.style.transform =
        `translate3d(${s.x}px, ${s.y}px, 0)`;
      s.shadow.style.transform =
        `translate3d(${s.x + SHADOW_X}px, ${s.y + SHADOW_Y}px, 0)`;
    }
  }

  window.addEventListener("pointermove", (event) => {
    const now = performance.now();
    const dt = Math.max(8, now - lastPointerTime);

    if (prevPointerX > -9000 && prevPointerY > -9000) {
      pointerVX = (event.clientX - prevPointerX) * (16.667 / dt);
      pointerVY = (event.clientY - prevPointerY) * (16.667 / dt);
    }

    prevPointerX = event.clientX;
    prevPointerY = event.clientY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    lastPointerTime = now;
  }, { passive: true });

  requestAnimationFrame(tick);
})();


/* Soundi v9 login cursor message timer */
(() => {
  const LOGIN_PROMPT_DELAY = 60 * 1000;
  const loginModal = document.getElementById("loginModal");
  const cursorHint = document.querySelector("#customCursor .cursor-hint");
  if (!loginModal || !cursorHint) return;

  let promptTimer = 0;
  let showLoginPrompt = false;
  let loginWasVisible = false;

  const isLoginVisible = () =>
    !loginModal.hidden &&
    loginModal.getAttribute("aria-hidden") !== "true" &&
    getComputedStyle(loginModal).display !== "none";

  const isKorean = () => {
    if (typeof currentLanguage !== "undefined") {
      return String(currentLanguage).toLowerCase().startsWith("ko");
    }
    return String(document.documentElement.lang || "ko").toLowerCase().startsWith("ko");
  };

  function renderLoginCursorMessage() {
    if (!isLoginVisible()) return;

    if (showLoginPrompt) {
      cursorHint.textContent = isKorean() ? "로그인해볼까요?" : "Shall we log in?";
    } else {
      cursorHint.textContent = isKorean() ? "반가워요" : "Welcome";
    }
  }

  function startLoginPromptTimer() {
    clearTimeout(promptTimer);
    showLoginPrompt = false;
    renderLoginCursorMessage();

    promptTimer = window.setTimeout(() => {
      if (!isLoginVisible()) return;
      showLoginPrompt = true;
      renderLoginCursorMessage();
    }, LOGIN_PROMPT_DELAY);
  }

  function stopLoginPromptTimer() {
    clearTimeout(promptTimer);
    promptTimer = 0;
    showLoginPrompt = false;
  }

  // Watch login open/close state. A newly shown login screen gets a fresh minute.
  const observer = new MutationObserver(() => {
    const visible = isLoginVisible();

    if (visible && !loginWasVisible) {
      startLoginPromptTimer();
    } else if (!visible && loginWasVisible) {
      stopLoginPromptTimer();
    }

    loginWasVisible = visible;
  });

  observer.observe(loginModal, {
    attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "class", "style"]
  });

  // Keep the cursor copy synchronized if the existing language toggle changes.
  const languageToggle = document.getElementById("languageToggle");
  languageToggle?.addEventListener("click", () => {
    requestAnimationFrame(renderLoginCursorMessage);
    setTimeout(renderLoginCursorMessage, 40);
  });

  // Existing cursor code may update on pointermove, so apply the intended
  // login copy immediately afterward without changing cursor position behavior.
  window.addEventListener("pointermove", () => {
    if (isLoginVisible()) renderLoginCursorMessage();
  }, { passive: true });

  loginWasVisible = isLoginVisible();
  if (loginWasVisible) startLoginPromptTimer();
})();


// Archive transport shares the composition engine and restores the draft on exit.
function playArchiveSong(id) {
  if (archivePlayerActive && String(archivePreviewItemId) === String(id)) {
    togglePlayback();
    return;
  }
  openArchivePreview(id, true);
  if (composition.length) startPlayback();
}

function renderArchivePlayer() {
  const host = document.getElementById('archivePlayer');
  if (!host) return;
  const item = archivePlayerActive && archiveItems.find(entry => String(entry.id) === String(archivePreviewItemId));
  const en = currentLanguage === 'en';
  const signature = JSON.stringify([item || null, currentLanguage]);
  if (host.dataset.renderSignature === signature) { syncArchivePlayer(); return; }
  const hadSong = host.classList.contains('has-song');
  const oldGridTop = archiveGrid.getBoundingClientRect().top;
  host.dataset.renderSignature = signature;
  host.getAnimations().forEach(animation => animation.cancel());
  host.classList.toggle('has-song', Boolean(item));
  host.innerHTML = `
    <div class="archive-turntable"><div class="player-vinyl" aria-hidden="true"><div class="archive-cd ${item ? getArchiveCoverClass(item) : 'player-empty-disc'}" style="${item ? getArchiveCoverStyle(item) : ''}">${item ? renderArchiveRecordContent(item) : '<span class="cd-hole"></span>'}</div></div></div>
    <div class="archive-player-body">
      <p class="archive-player-status" role="status"></p>
      <h2 class="archive-player-title">${item ? escapeHtml(item.title || 'Untitled') : en ? 'Choose a record' : 'LP를 선택해 주세요'}</h2>
      <p class="archive-player-author">${item ? escapeHtml(item.author || translate('guest')) : ''}</p>
      <div class="archive-player-timeline"><input type="range" min="0" max="100" value="0" step="any" aria-label="${en ? 'Playback position' : '재생 위치'}" ${item && composition.length ? '' : 'disabled'}><div><span class="player-elapsed">00:00</span><span class="player-duration">00:00</span></div></div>
      <div class="archive-player-controls"><button type="button" class="control-button" data-transport="previous" aria-label="${en ? 'Previous song' : '이전 곡'}" ${item ? '' : 'disabled'}>${controlIcons.prev}</button><button type="button" class="control-button player-toggle" data-transport="toggle" aria-label="${en ? 'Play' : '재생'}" ${item && composition.length ? '' : 'disabled'}>${controlIcons.play}</button><button type="button" class="control-button" data-transport="next" aria-label="${en ? 'Next song' : '다음 곡'}" ${item ? '' : 'disabled'}>${controlIcons.next}</button></div>
    </div>`;
  host.querySelectorAll('[data-transport]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.transport === 'toggle') { togglePlayback(); return; }
    const index = archiveItems.findIndex(entry => String(entry.id) === String(archivePreviewItemId));
    const delta = button.dataset.transport === 'next' ? 1 : -1;
    const next = archiveItems[(index + delta + archiveItems.length) % archiveItems.length];
    if (next) { if (isPlaying) stopPlayback(); archivePlayerActive = false; playArchiveSong(next.id); }
  }));
  host.querySelector('input').addEventListener('input', event => {
    const running = isPlaying;
    if (running) stopPlayback();
    const bounds = getLoopBounds();
    archivePausedStep = Math.min(bounds.end - 1, bounds.start + Number(event.target.value));
    if (running) startPlayback();
    else syncArchivePlayer(null, archivePausedStep);
  });
  // Establish the resting SVG pose before the playback class changes.
  const arm = host.querySelector('.record-arm-moving');
  if (arm) getComputedStyle(arm).transform;
  syncArchivePlayer();
  if (item && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const options = { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' };
    if (!hadSong) {
      host.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], options);
      if (window.matchMedia('(width < 768px)').matches) {
        const offset = oldGridTop - archiveGrid.getBoundingClientRect().top;
        archiveGrid.getAnimations().forEach(animation => animation.cancel());
        archiveGrid.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], options);
      }
    } else {
      host.querySelector('.archive-player-body').animate([
        { opacity: .25, translate: '0 6px' }, { opacity: 1, translate: '0 0' }
      ], { ...options, duration: 220 });
    }
  }
}

function syncArchivePlayer(analysis = null, step = -1) {
  const host = document.getElementById('archivePlayer');
  if (!host || !host.querySelector('.player-toggle')) return;
  const en = currentLanguage === 'en';
  const active = archivePlayerActive && isArchivePreviewMode;
  const running = active && isPlaying;
  host.classList.toggle('is-playing', running);
  host.querySelector('.archive-player-status').textContent = !active ? (en ? 'ARCHIVE / PLAYER' : '아카이브 / 플레이어') : !composition.length ? (en ? 'Empty song' : '음표가 없는 곡') : running ? (en ? 'Playing · Loop' : '재생 중 · 반복 재생') : (en ? 'Paused' : '일시정지');
  const toggle = host.querySelector('.player-toggle');
  const icon = running ? 'pause' : 'play';
  if (toggle.dataset.icon !== icon) { toggle.innerHTML = controlIcons[icon]; toggle.dataset.icon = icon; }
  toggle.setAttribute('aria-label', running ? (en ? 'Pause' : '일시정지') : (en ? 'Play' : '재생'));
  toggle.setAttribute('aria-pressed', String(running));
  if (!active) {
    archiveGrid.querySelectorAll('[data-play-archive-id]').forEach(button => {
      button.setAttribute('aria-pressed', 'false');
      button.closest('.archive-card').classList.remove('is-current', 'is-track-playing');
    });
    return;
  }
  const bounds = composition.length ? getLoopBounds() : { start: 0, end: 0 };
  const length = Math.max(1, bounds.end - bounds.start);
  const position = Math.max(0, (step >= 0 ? step : archivePausedStep ?? bounds.start) - bounds.start);
  host.querySelector('input').max = String(length);
  if (step >= 0 || !running) {
    archiveProgressPosition = position;
    archiveProgressAnchor = performance.now();
  }
  paintArchiveProgress(host, position, length);
  if (running && !archiveProgressFrame) archiveProgressFrame = requestAnimationFrame(animateArchiveProgress);
  host.querySelector('.player-elapsed').textContent = formatDuration(position * getStepIntervalSeconds());
  host.querySelector('.player-duration').textContent = formatDuration((bounds.end - bounds.start) * getStepIntervalSeconds());
  if (analysis && running) {
    const colors = getMoodVisualState(analysis, step).colors;
    host.style.setProperty('--player-color', colors[0]);
    host.style.setProperty('--player-color-b', colors[1]);
  }
  archiveGrid.querySelectorAll('[data-play-archive-id]').forEach(button => {
    const selected = String(button.dataset.playArchiveId) === String(archivePreviewItemId);
    button.setAttribute('aria-pressed', String(selected));
    const card = button.closest('.archive-card');
    card.classList.toggle('is-current', selected);
    card.classList.toggle('is-track-playing', selected && running);
    const title = card.querySelector('.archive-info strong')?.textContent || '';
    button.setAttribute('aria-label', `${title} · ${selected && running ? (en ? 'Playing · Pause' : '재생 중 · 일시정지') : (en ? 'Play' : '재생')}`);
  });
}


function paintArchiveProgress(host, position, length) {
  const input = host.querySelector('.archive-player-timeline input');
  if (!input) return;
  const value = Math.min(length, Math.max(0, position));
  input.value = value;
  input.style.setProperty('--played', `${value / length * 100}%`);
  host.querySelector('.player-elapsed').textContent = formatDuration(value * getStepIntervalSeconds());
}

function paintArchiveEqualizer() {
  if (!archiveAnalyser || !archiveSpectrum) return;
  const bars = archiveGrid.querySelectorAll('.archive-card.is-track-playing .archive-equalizer i');
  if (!bars.length) return;
  archiveAnalyser.getByteFrequencyData(archiveSpectrum);
  const binHz = audioContext.sampleRate / archiveAnalyser.fftSize;
  const bands = [[60, 300], [300, 1200], [1200, 5000]];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bars.forEach((bar, index) => {
    const [low, high] = bands[index % bands.length];
    let peak = 0;
    for (let bin = Math.max(1, Math.floor(low / binHz)); bin <= Math.min(archiveSpectrum.length - 1, Math.ceil(high / binHz)); bin++) {
      peak = Math.max(peak, archiveSpectrum[bin] / 255);
    }
    bar.style.transform = `scaleY(${reducedMotion ? 0.5 : 0.12 + 0.88 * peak * peak})`;
  });
}

function animateArchiveProgress(now) {
  archiveProgressFrame = 0;
  if (!archivePlayerActive || !isPlaying) return;
  const host = document.getElementById('archivePlayer');
  if (!host) return;
  const bounds = getLoopBounds();
  const position = archiveProgressPosition + Math.max(0, now - archiveProgressAnchor) / (getStepIntervalSeconds() * 1000);
  paintArchiveProgress(host, position, Math.max(1, bounds.end - bounds.start));
  paintArchiveEqualizer();
  archiveProgressFrame = requestAnimationFrame(animateArchiveProgress);
}


function openArchiveSongMenu(id, trigger) {
  const item = archiveItems.find(song => String(song.id) === String(id));
  if (!item) return;
  const owner = currentUser?.role === 'general' && item.ownerId === currentUserId;
  const en = currentLanguage === 'en';
  let dialog = document.getElementById('archiveSongMenu');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'archiveSongMenu';
    dialog.className = 'archive-song-menu';

    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      }
    });
  }
  const entries = [['view', en ? 'Explore song' : '곡 살펴보기']];
  if (owner) entries.push(['edit', en ? 'Edit' : '수정'], ['duplicate', en ? 'Create a copy' : '복제해서 만들기'], ['unpublish', en ? 'Unpublish' : '게시 내리기'], ['delete', en ? 'Delete' : '삭제']);
  dialog.setAttribute('aria-label', `${item.title || 'Untitled'} · ${en ? 'Song options' : '곡 메뉴'}`);
  dialog.innerHTML = `${entries.map(([action,label]) => `<button type="button" data-song-action="${action}" class="${action === 'delete' ? 'is-danger' : ''}">${label}</button>`).join('')}`;
  const anchor = trigger.getBoundingClientRect();
  dialog.style.setProperty('--menu-left', `${Math.max(12, Math.min(innerWidth - 232, anchor.right - 220))}px`);
  dialog.style.setProperty('--menu-top', `${Math.max(12, Math.min(innerHeight - 340, anchor.bottom + 8))}px`);
  dialog.onclose = () => { trigger.setAttribute('aria-expanded', 'false'); if (trigger.isConnected) trigger.focus({preventScroll:true}); };
  dialog.querySelectorAll('[data-song-action]').forEach(button => {
    button.onclick = async () => {
      const action = button.dataset.songAction;
      songActionAnchor = button.getBoundingClientRect();
      dialog.close();
      if (action === 'view') { openArchivePreview(id); return; }
      // Recheck ownership at dispatch, not only when presenting the menu.
      if (currentUser?.role !== 'general' || item.ownerId !== currentUserId) return;
      if (!mySongItems.some(song => String(song.id) === String(id))) mySongItems.push(item);
      try {
        if (action === 'delete') { deleteArchiveItem(id); return; }
        if (action === 'duplicate') {
          const copy = await duplicateMySong(id);
          if (copy) { if (isArchivePreviewMode) restoreArchivePreviewDraft(); await openMySong(copy.id); }
          return;
        }
        if (action === 'unpublish' || action === 'edit') {
          const draft = await unpublishMySong(id, action === 'edit');
          if (draft && isArchivePreviewMode && String(archivePreviewItemId) === String(id)) restoreArchivePreviewDraft();
          if (draft && action === 'edit') await openMySong(draft.id);
          else if (draft) renderArchivePlayer();
        }
      } catch (error) {
        console.warn('[Soundi] Song action failed', error);
        showSongDialog(en ? 'Could not complete this action. Please try again.' : '작업을 완료하지 못했어요. 다시 시도해 주세요.');
      }
    };
  });
  trigger.setAttribute('aria-expanded', 'true');
  dialog.showModal();
  attachDialogCursor(dialog);
  dialog.querySelector('[data-song-action]').focus();
}


let songActionAnchor = null;

// App-styled confirmation/notice; cancel, outside click and Escape never approve.
function showSongDialog(message, { confirm = false, title, actionLabel, destructive = false, cancelLabel } = {}) {
  return new Promise(resolve => {
    const en = currentLanguage === 'en';
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'delete-confirm-dialog song-action-dialog';
    dialog.setAttribute('aria-label', title || (en ? 'Notice' : '안내'));
    dialog.innerHTML = `<h2>${escapeHtml(title || (en ? 'Notice' : '안내'))}</h2><p>${escapeHtml(message)}</p><div class="delete-confirm-actions">${confirm ? `<button type="button" class="delete-confirm-cancel" data-cancel>${escapeHtml(cancelLabel || (en ? 'Cancel' : '취소'))}</button>` : ''}<button type="button" class="song-action-accept ${destructive ? 'delete-confirm-delete' : ''}" data-accept>${escapeHtml(actionLabel || (en ? 'OK' : '확인'))}</button></div>`;
    const anchor = songActionAnchor || previousFocus?.getBoundingClientRect();
    let accepted = false;
    const outside = event => { if (!dialog.contains(event.target)) dialog.close(); };
    const escape = event => { if (event.key === 'Escape') dialog.close(); };
    dialog.querySelector('[data-accept]').onclick = () => { accepted = true; dialog.close(); };
    dialog.querySelector('[data-cancel]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const r = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      if (customCursor && dialog.contains(customCursor)) document.body.append(customCursor);
      dialog.remove();
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({preventScroll:true});
      resolve(accepted);
    }, {once:true});
    document.body.append(dialog);
    dialog.show();
    const size = dialog.getBoundingClientRect();
    const right = anchor?.right || innerWidth / 2;
    const top = anchor?.top || innerHeight / 2;
    const x = right + 8 + size.width <= innerWidth - 12 ? right + 8 : (anchor?.left || right) - size.width - 8;
    dialog.style.left = `${Math.max(12, Math.min(innerWidth - size.width - 12, x))}px`;
    dialog.style.top = `${Math.max(12, Math.min(innerHeight - size.height - 12, top))}px`;
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    dialog.querySelector(confirm ? '[data-cancel]' : '[data-accept]').focus();
  });
}


function attachDialogCursor(dialog) {
  if (!customCursor || !window.matchMedia('(pointer: fine)').matches) return;
  dialog.append(customCursor);
  customCursor.classList.remove('show-hint');
  const move = event => {
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    scheduleCursorPaint();
  };
  dialog.addEventListener('pointermove', move);
  dialog.addEventListener('close', () => {
    dialog.removeEventListener('pointermove', move);
    // A confirmation can open immediately after the song menu closes.
    if (customCursor.parentElement === dialog) {
      const next = [...document.querySelectorAll('dialog:modal')].at(-1);
      (next || document.body).append(customCursor);
    }
  }, {once:true});
}
