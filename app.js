/**
 * Application "Apprendre le Hangeul"
 * Moteur de jeu, navigation, Web Speech API, LocalStorage
 */
(function () {
  "use strict";

  // ===== CONSTANTES =====
  const QUESTIONS_PER_ROUND = 10;
  const STORAGE_KEY = "hangul_stats";
  const SPEECH_RATE = 0.8;

  // ===== ÉTAT =====
  let currentScreen = "home";
  let currentMode = null;     // "hangul-to-fr" | "fr-to-hangul" | "ecoute" | "expert-pronounce" | "expert-fr-to-hangul" | "expert-ecoute"
  let currentDifficulty = "debutant";
  let koreanVoice = null;
  let speechAvailable = false;

  // Reconnaissance vocale (mode expert) — Whisper via Transformers.js,
  // 100% dans le navigateur, charge a la demande depuis le CDN Hugging Face.
  const WHISPER_MODEL = "Xenova/whisper-small";
  const WHISPER_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
  let voiceAvailable = false;
  let whisperPipeline = null;
  let whisperLoading = false;
  let listening = false;
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  // État de la manche
  let pool = [];
  let questions = [];
  let currentQuestionIndex = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let answered = false;
  let lastCorrectChar = null;

  // ===== ÉLÉMENTS DOM =====
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    btnBack: $("btn-back"),
    appTitle: $("app-title"),
    screenHome: $("screen-home"),
    screenGame: $("screen-game"),
    screenReference: $("screen-reference"),
    screenStats: $("screen-stats"),
    difficulty: $("difficulty"),
    cardEcoute: $("card-ecoute"),
    ecouteWarning: $("ecoute-warning"),
    cardExpertPronounce: $("card-expert-pronounce"),
    expertPronounceWarning: $("expert-pronounce-warning"),
    cardExpertEcoute: $("card-expert-ecoute"),
    expertEcouteWarning: $("expert-ecoute-warning"),
    btnReference: $("btn-reference"),
    btnStats: $("btn-stats"),
    gameModeLabel: $("game-mode-label"),
    gameDifficultyLabel: $("game-difficulty-label"),
    scoreDisplay: $("score-display"),
    streakDisplay: $("streak-display"),
    progressFill: $("progress-fill"),
    questionZone: $("question-zone"),
    questionChar: $("question-char"),
    questionText: $("question-text"),
    btnListenQuestion: $("btn-listen-question"),
    answerInputZone: $("answer-input-zone"),
    answerInput: $("answer-input"),
    btnValidate: $("btn-validate"),
    answerQcmZone: $("answer-qcm-zone"),
    qcmGrid: $("qcm-grid"),
    answerSpeechZone: $("answer-speech-zone"),
    btnMic: $("btn-mic"),
    speechStatus: $("speech-status"),
    speechResult: $("speech-result"),
    answerHangulZone: $("answer-hangul-zone"),
    hangulInput: $("hangul-input"),
    hangulKeyboard: $("hangul-keyboard"),
    btnValidateHangul: $("btn-validate-hangul"),
    feedback: $("feedback"),
    feedbackIcon: $("feedback-icon"),
    feedbackText: $("feedback-text"),
    btnFeedbackListen: $("btn-feedback-listen"),
    btnNext: $("btn-next"),
    roundEnd: $("round-end"),
    roundScore: $("round-score"),
    btnReplay: $("btn-replay"),
    btnHomeFromGame: $("btn-home-from-game"),
    refGrid: $("ref-grid"),
    statTotal: $("stat-total"),
    statAccuracy: $("stat-accuracy"),
    statBestStreak: $("stat-best-streak"),
    charStatsGrid: $("char-stats-grid"),
    btnResetStats: $("btn-reset-stats"),
  };

  // ===== DONNÉES PAR DIFFICULTÉ =====
  function getPool(difficulty) {
    const d = HANGUL_DATA;
    let items = [];
    if (difficulty === "debutant") {
      items = [...d.consonnes, ...d.voyelles];
    } else if (difficulty === "intermediaire") {
      items = [...d.consonnes, ...d.voyelles, ...d.consonnesDoubles, ...d.voyellesComposees];
    } else {
      items = [...d.consonnes, ...d.voyelles, ...d.consonnesDoubles, ...d.voyellesComposees, ...d.syllabes];
    }
    return items;
  }

  function getAllItems() {
    const d = HANGUL_DATA;
    return [...d.consonnes, ...d.voyelles, ...d.consonnesDoubles, ...d.voyellesComposees, ...d.syllabes];
  }

  // ===== UTILITAIRES =====
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalize(str) {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function checkAnswer(userAnswer, correctPron) {
    const norm = normalize(userAnswer);
    if (!norm) return false;
    // Split on "/" to accept any variant
    const variants = correctPron.split("/").map((v) => normalize(v.trim()));
    // Also check without spaces
    return variants.some((v) => {
      const nv = v.replace(/\s+/g, "");
      return norm === nv || norm === v;
    });
  }

  // Noms / sons coreens acceptes pour chaque jamo : Whisper (en coreen) renvoie
  // souvent le nom de la lettre (기역) ou sa forme syllabique (그) plutot que le
  // jamo isole. Tout alias present dans la transcription valide la reponse.
  const SPEECH_ALIASES = {
    "ㄱ": ["기역", "그"], "ㄴ": ["니은", "느"], "ㄷ": ["디귿", "드"], "ㄹ": ["리을", "르"],
    "ㅁ": ["미음", "므"], "ㅂ": ["비읍", "브"], "ㅅ": ["시옷", "스"], "ㅇ": ["이응", "응"],
    "ㅈ": ["지읒", "즈"], "ㅊ": ["치읓", "츠"], "ㅋ": ["키읔", "크"], "ㅌ": ["티읕", "트"],
    "ㅍ": ["피읖", "프"], "ㅎ": ["히읗", "흐"],
    "ㄲ": ["쌍기역", "끄"], "ㄸ": ["쌍디귿", "뜨"], "ㅃ": ["쌍비읍", "쁘"], "ㅆ": ["쌍시옷", "쓰"], "ㅉ": ["쌍지읒", "쯔"],
    "ㅏ": ["아"], "ㅑ": ["야"], "ㅓ": ["어"], "ㅕ": ["여"], "ㅗ": ["오"], "ㅛ": ["요"],
    "ㅜ": ["우"], "ㅠ": ["유"], "ㅡ": ["으"], "ㅣ": ["이"],
    "ㅐ": ["애"], "ㅒ": ["얘"], "ㅔ": ["에"], "ㅖ": ["예"], "ㅘ": ["와"], "ㅙ": ["왜"],
    "ㅚ": ["외"], "ㅝ": ["워"], "ㅞ": ["웨"], "ㅟ": ["위"], "ㅢ": ["의"],
  };

  // Whisper normalise les nombres coreens en chiffres (il -> "1", i -> "2",
  // o -> "5"...). Or plusieurs sons de jamo coincident avec ces numeraux : on
  // retraduit donc les chiffres en syllabes avant la comparaison.
  const DIGIT_TO_KOREAN = {
    "0": "영공", "1": "일", "2": "이", "3": "삼", "4": "사",
    "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구",
  };

  // Verifie une reponse vocale (mode expert "prononciation").
  // Whisper transcrit en coreen : on accepte si le caractere cible (ou un de
  // ses alias parles) apparait dans la transcription.
  function checkSpeech(transcript, char, pronFR) {
    if (!transcript) return false;
    const cleaned = transcript.replace(/[\s.,!?~"'·]/g, "");
    if (!cleaned) return false;
    // Chiffres -> lecture coreenne (un chiffre ambigu donne ses deux lectures)
    const t = Array.from(cleaned).map((c) => DIGIT_TO_KOREAN[c] || c).join("");

    // Correspondance directe (syllabe cible, ou jamo transcrit tel quel)
    if (t.indexOf(char) !== -1) return true;

    // Noms de lettres (기역, 쌍기역...)
    const aliases = SPEECH_ALIASES[char];
    if (aliases && aliases.some((a) => t.indexOf(a) !== -1)) return true;

    // Un jamo isole est rarement transcrit seul : Whisper ecrit une syllabe
    // (ㄴ -> 네, 느, 나...). On decompose chaque syllabe entendue et on
    // compare le jamo plutot que d'enumerer toutes les variantes possibles.
    const isConsonant = HangulComposer.KEYS_CONSONANTS.indexOf(char) !== -1;
    const isVowel = HangulComposer.KEYS_VOWELS.indexOf(char) !== -1;
    if (!isConsonant && !isVowel) return false;

    const jamoMatch = Array.from(t).some((syl) => {
      const d = HangulComposer.decompose(syl);
      if (!d) return false;
      if (isConsonant) {
        // Consonne entendue comme initiale (네, 느...) ou comme finale
        // sur une initiale muette (은, 음...) : les deux sont valides.
        return d.cho === char || (d.cho === "ㅇ" && d.jong === char);
      }
      // Voyelle : la syllabe doit etre la voyelle seule (initiale muette ㅇ)
      return d.jung === char && d.cho === "ㅇ";
    });
    if (jamoMatch) return true;

    // Dernier recours : sur un son trop court, Whisper abandonne le coreen et
    // ecrit un mot latin ("But" pour ㅂ). On compare alors le debut du mot a la
    // romanisation du jamo (pronFR), qui est justement ce que l'on enseigne.
    return matchesRomanization(cleaned, pronFR);
  }

  function matchesRomanization(transcript, pronFR) {
    if (!pronFR) return false;
    const latin = normalize(transcript).replace(/[^a-z]+/g, " ").trim();
    if (!latin) return false;
    // "eo/o ouvert" -> ["eo", "o"] : on ne garde que le 1er mot de chaque variante
    const onsets = pronFR.split("/")
      .map((v) => normalize(v.trim()).split(/\s+/)[0])
      .filter((v) => v.length > 0);
    return latin.split(" ").some((tok) => onsets.some((o) => tok.indexOf(o) === 0));
  }

  // ===== COMPOSITION HANGEUL (clavier virtuel) =====
  // Assemble des jamo en syllabes coreennes (algorithme Unicode standard).
  const HangulComposer = (function () {
    const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
    const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

    const JUNG_COMBINE = { "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ" };
    const JUNG_SPLIT = { "ㅘ": "ㅗ", "ㅙ": "ㅗ", "ㅚ": "ㅗ", "ㅝ": "ㅜ", "ㅞ": "ㅜ", "ㅟ": "ㅜ", "ㅢ": "ㅡ" };
    const JONG_COMBINE = { "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ" };
    const JONG_SPLIT = { "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"], "ㄺ": ["ㄹ", "ㄱ"], "ㄻ": ["ㄹ", "ㅁ"], "ㄼ": ["ㄹ", "ㅂ"], "ㄽ": ["ㄹ", "ㅅ"], "ㄾ": ["ㄹ", "ㅌ"], "ㄿ": ["ㄹ", "ㅍ"], "ㅀ": ["ㄹ", "ㅎ"], "ㅄ": ["ㅂ", "ㅅ"] };

    let committed = "";
    let block = null; // { cho, jung, jong } indices (null si absent)

    function blockToChar(b) {
      if (!b) return "";
      if (b.cho != null && b.jung != null) {
        return String.fromCharCode(0xAC00 + (b.cho * 21 + b.jung) * 28 + (b.jong || 0));
      }
      if (b.cho != null) return CHO[b.cho];
      if (b.jung != null) return JUNG[b.jung];
      return "";
    }

    function inputVowel(v) {
      if (!block) { block = { cho: null, jung: v, jong: null }; return; }
      if (block.cho != null && block.jung == null) { block.jung = v; return; }
      if (block.jung != null && block.jong == null) {
        const combo = JUNG_COMBINE[JUNG[block.jung] + JUNG[v]];
        if (combo) { block.jung = JUNG.indexOf(combo); return; }
        committed += blockToChar(block);
        block = { cho: null, jung: v, jong: null };
        return;
      }
      // block complet avec final : le final devient l'initiale de la syllabe suivante
      const jongChar = JONG[block.jong];
      const split = JONG_SPLIT[jongChar];
      if (split) {
        block.jong = JONG.indexOf(split[0]);
        committed += blockToChar(block);
        block = { cho: CHO.indexOf(split[1]), jung: v, jong: null };
      } else {
        block.jong = null;
        committed += blockToChar(block);
        block = { cho: CHO.indexOf(jongChar), jung: v, jong: null };
      }
    }

    function inputConsonant(c) {
      if (!block) { block = { cho: c, jung: null, jong: null }; return; }
      if (block.cho != null && block.jung == null) {
        committed += blockToChar(block);
        block = { cho: c, jung: null, jong: null };
        return;
      }
      if (block.jung != null && block.jong == null) {
        if (block.cho == null) {
          // voyelle nue + consonne : on valide la voyelle puis on commence une consonne
          committed += blockToChar(block);
          block = { cho: c, jung: null, jong: null };
          return;
        }
        const jongIdx = JONG.indexOf(CHO[c]);
        if (jongIdx > 0) { block.jong = jongIdx; return; }
        committed += blockToChar(block);
        block = { cho: c, jung: null, jong: null };
        return;
      }
      // deja un final : tenter un final compose
      const combo = JONG_COMBINE[JONG[block.jong] + CHO[c]];
      if (combo) { block.jong = JONG.indexOf(combo); return; }
      committed += blockToChar(block);
      block = { cho: c, jung: null, jong: null };
    }

    return {
      reset: function () { committed = ""; block = null; },
      value: function () { return committed + blockToChar(block); },
      input: function (ch) {
        const vi = JUNG.indexOf(ch);
        if (vi >= 0) { inputVowel(vi); return; }
        const ci = CHO.indexOf(ch);
        if (ci >= 0) { inputConsonant(ci); }
      },
      backspace: function () {
        if (block) {
          if (block.jong != null) {
            const split = JONG_SPLIT[JONG[block.jong]];
            block.jong = split ? JONG.indexOf(split[0]) : null;
            if (block.jong === 0) block.jong = null;
            return;
          }
          if (block.jung != null) {
            const split = JUNG_SPLIT[JUNG[block.jung]];
            if (split) { block.jung = JUNG.indexOf(split); }
            else { block.jung = null; if (block.cho == null) block = null; }
            return;
          }
          if (block.cho != null) { block = null; return; }
        }
        committed = committed.slice(0, -1);
      },
      // Decompose une syllabe hangeul en jamo ; null si ce n'est pas une syllabe.
      decompose: function (ch) {
        const code = ch.charCodeAt(0) - 0xAC00;
        if (code < 0 || code > 11171) return null;
        return {
          cho: CHO[Math.floor(code / 588)],
          jung: JUNG[Math.floor((code % 588) / 28)],
          jong: JONG[code % 28] || null,
        };
      },
      // Jamo proposes par le clavier virtuel
      KEYS_CONSONANTS: CHO,
      KEYS_VOWELS: JUNG,
    };
  })();

  // ===== WEB SPEECH API =====
  function enableListening() {
    speechAvailable = true;
    els.cardEcoute.classList.remove("disabled");
    els.ecouteWarning.classList.add("hidden");
    els.cardExpertEcoute.classList.remove("disabled");
    els.expertEcouteWarning.classList.add("hidden");
  }

  function initSpeech() {
    // Voix coreenne native du navigateur (Web Speech Synthesis)
    if ("speechSynthesis" in window) {
      function findKoreanVoice() {
        const voices = speechSynthesis.getVoices();
        koreanVoice = voices.find((v) => v.lang.startsWith("ko"));
        if (koreanVoice) enableListening();
      }

      speechSynthesis.onvoiceschanged = findKoreanVoice;
      findKoreanVoice();
    }
  }

  function disableListening() {
    speechAvailable = false;
    els.cardEcoute.classList.add("disabled");
    els.ecouteWarning.classList.remove("hidden");
    els.cardExpertEcoute.classList.add("disabled");
    els.expertEcouteWarning.classList.remove("hidden");
  }

  // ===== RECONNAISSANCE VOCALE (mode expert "prononciation") =====
  // Whisper s'execute entierement dans le navigateur (Transformers.js) : pas
  // de cle API, pas de serveur, fonctionne sur Brave/Firefox/Chrome en HTTPS.
  function initVoiceMode() {
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!window.isSecureContext || !hasMic) {
      voiceAvailable = false;
      els.cardExpertPronounce.classList.add("disabled");
      els.expertPronounceWarning.textContent = window.isSecureContext
        ? "Micro non disponible sur cet appareil"
        : "Disponible uniquement en HTTPS (ex : GitHub Pages)";
      els.expertPronounceWarning.classList.remove("hidden");
      return;
    }
    voiceAvailable = true;
    els.cardExpertPronounce.classList.remove("disabled");
    els.expertPronounceWarning.classList.add("hidden");
  }

  // Charge le modele Whisper a la demande (une seule fois).
  async function ensureWhisper() {
    if (whisperPipeline) return whisperPipeline;
    if (whisperLoading) return null;
    whisperLoading = true;
    els.btnMic.disabled = true;
    els.speechStatus.textContent = "Telechargement du modele vocal (une seule fois)...";

    const progress = (p) => {
      if (p && p.status === "progress" && p.total) {
        els.speechStatus.textContent = "Telechargement du modele vocal : " + Math.round((p.loaded / p.total) * 100) + "%";
      }
    };

    try {
      const tf = await import(WHISPER_CDN);
      const build = (device) => tf.pipeline("automatic-speech-recognition", WHISPER_MODEL, { device: device, progress_callback: progress });
      try {
        const device = ("gpu" in navigator) ? "webgpu" : "wasm";
        whisperPipeline = await build(device);
      } catch (gpuErr) {
        // Repli si WebGPU echoue
        whisperPipeline = await build("wasm");
      }
      els.speechStatus.textContent = "Modele pret. Appuyez sur le micro et prononcez le caractere.";
    } catch (err) {
      whisperPipeline = null;
      els.speechStatus.textContent = "Echec du chargement du modele vocal. Verifiez votre connexion.";
    } finally {
      whisperLoading = false;
      if (!answered) els.btnMic.disabled = false;
    }
    return whisperPipeline;
  }

  function stopListeningUI() {
    listening = false;
    els.btnMic.classList.remove("recording");
  }

  async function startRecording() {
    if (!voiceAvailable || listening || answered) return;
    const ready = whisperPipeline || (await ensureWhisper());
    if (!ready || answered) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      els.speechStatus.textContent = "Acces au micro refuse. Autorisez le micro.";
      return;
    }
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStop;
    mediaRecorder.start();
    listening = true;
    els.btnMic.classList.add("recording");
    els.speechResult.classList.add("hidden");
    els.speechStatus.textContent = "Enregistrement... reappuyez pour valider.";
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    stopListeningUI();
  }

  async function onRecordingStop() {
    if (answered) return;
    if (!recordedChunks.length) {
      els.speechStatus.textContent = "Rien entendu. Reappuyez et reessayez.";
      return;
    }
    els.speechStatus.textContent = "Analyse en cours...";
    try {
      const blob = new Blob(recordedChunks, { type: recordedChunks[0].type || "audio/webm" });
      const audio = await blobToFloat32(blob);
      const out = await whisperPipeline(audio, { language: "korean", task: "transcribe" });
      const text = (out && out.text ? out.text : "").trim();
      const q = questions[currentQuestionIndex];
      const isCorrect = checkSpeech(text, q.char, q.pronFR);
      els.speechResult.textContent = "Entendu : " + (text || "(rien)");
      els.speechResult.classList.remove("hidden");
      els.speechStatus.textContent = "Appuyez sur le micro et prononcez le caractere.";
      handleAnswer(isCorrect, q);
    } catch (err) {
      els.speechStatus.textContent = "Erreur d'analyse audio. Reessayez.";
    }
  }

  // Decode un Blob audio en Float32Array mono 16 kHz (format attendu par Whisper).
  async function blobToFloat32(blob) {
    const arrayBuf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(arrayBuf);
    ctx.close();
    const length = Math.max(1, Math.ceil(decoded.duration * 16000));
    const offline = new OfflineAudioContext(1, length, 16000);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  }

  function speak(text) {
    if (!speechAvailable || !koreanVoice) return;
    // Voix coreenne native du navigateur (Web Speech Synthesis)
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = koreanVoice;
    utter.lang = "ko-KR";
    utter.rate = SPEECH_RATE;
    speechSynthesis.speak(utter);
  }

  // ===== LOCALSTORAGE =====
  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { chars: {}, bestStreak: 0 };
  }

  function saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) { /* ignore */ }
  }

  function recordAnswer(char, correct) {
    const stats = loadStats();
    if (!stats.chars[char]) {
      stats.chars[char] = { correct: 0, total: 0 };
    }
    stats.chars[char].total++;
    if (correct) stats.chars[char].correct++;
    if (streak > stats.bestStreak) stats.bestStreak = streak;
    saveStats(stats);
  }

  function resetStats() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ===== NAVIGATION =====
  function showScreen(name) {
    ["home", "game", "reference", "stats"].forEach((s) => {
      const el = $("screen-" + s);
      el.classList.remove("active");
    });
    $("screen-" + name).classList.add("active");
    currentScreen = name;

    // Back button
    if (name === "home") {
      els.btnBack.classList.add("hidden");
    } else {
      els.btnBack.classList.remove("hidden");
    }

    // Refresh data for screens
    if (name === "reference") buildReferenceGrid();
    if (name === "stats") renderStats();

    window.scrollTo(0, 0);
  }

  // ===== TABLEAU DE RÉFÉRENCE =====
  function buildReferenceGrid(filter) {
    const all = getAllItems();
    const filtered = filter && filter !== "all"
      ? all.filter((it) => it.category === filter)
      : all;

    els.refGrid.innerHTML = filtered
      .map((it) => {
        const listenBtn = speechAvailable
          ? '<button class="ref-listen" data-char="' + it.char + '" aria-label="Ecouter">&#x1f50a;</button>'
          : "";
        return '<div class="ref-card">' +
          '<span class="ref-char">' + it.char + '</span>' +
          '<span class="ref-pron">' + it.pronFR + '</span>' +
          '<span class="ref-cat">' + it.category + '</span>' +
          listenBtn +
          '</div>';
      })
      .join("");

    // Listen buttons
    els.refGrid.querySelectorAll(".ref-listen").forEach((btn) => {
      btn.addEventListener("click", () => speak(btn.dataset.char));
    });
  }

  // ===== STATISTIQUES =====
  function renderStats() {
    const stats = loadStats();
    const allChars = stats.chars;
    const entries = Object.entries(allChars);
    let totalQ = 0, totalCorrect = 0;

    entries.forEach(([, data]) => {
      totalQ += data.total;
      totalCorrect += data.correct;
    });

    els.statTotal.textContent = totalQ;
    els.statAccuracy.textContent = totalQ > 0
      ? Math.round((totalCorrect / totalQ) * 100) + "%"
      : "0%";
    els.statBestStreak.textContent = stats.bestStreak || 0;

    // Per-character stats
    if (entries.length === 0) {
      els.charStatsGrid.innerHTML = '<p style="color:#888;grid-column:1/-1;text-align:center;">Aucune donnee pour le moment. Jouez pour voir vos statistiques !</p>';
      return;
    }

    // Sort: worst accuracy first
    const sorted = entries.sort((a, b) => {
      const pctA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
      const pctB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
      return pctA - pctB;
    });

    els.charStatsGrid.innerHTML = sorted
      .map(([char, data]) => {
        const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
        let cls = "bad";
        if (pct >= 80) cls = "good";
        else if (pct >= 50) cls = "medium";
        return '<div class="char-stat-card ' + cls + '">' +
          '<div class="char-stat-char">' + char + '</div>' +
          '<div class="char-stat-pct">' + pct + '%</div>' +
          '<div class="char-stat-count">' + data.correct + '/' + data.total + '</div>' +
          '</div>';
      })
      .join("");
  }

  // ===== MOTEUR DE JEU =====
  function startGame(mode) {
    currentMode = mode;
    currentDifficulty = els.difficulty.value;
    pool = getPool(currentDifficulty);

    // Generate questions
    const shuffled = shuffle(pool);
    questions = shuffled.slice(0, Math.min(QUESTIONS_PER_ROUND, shuffled.length));
    // If pool is smaller than QUESTIONS_PER_ROUND, pad with random repeats
    while (questions.length < QUESTIONS_PER_ROUND && pool.length > 0) {
      questions.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    currentQuestionIndex = 0;
    score = 0;
    streak = 0;
    answered = false;

    // UI labels
    const modeLabels = {
      "hangul-to-fr": "Hangeul \u2192 Prononciation",
      "fr-to-hangul": "Prononciation \u2192 Hangeul",
      "ecoute": "Mode ecoute",
      "expert-pronounce": "Expert : Prononcer",
      "expert-fr-to-hangul": "Expert : Ecrire (pron.)",
      "expert-ecoute": "Expert : Ecrire (ecoute)",
    };
    const diffLabels = {
      debutant: "Debutant",
      intermediaire: "Intermediaire",
      avance: "Avance",
    };
    els.gameModeLabel.textContent = modeLabels[mode];
    els.gameDifficultyLabel.textContent = diffLabels[currentDifficulty];
    els.scoreDisplay.textContent = "0 / 0";
    els.streakDisplay.textContent = "\uD83D\uDD25 0";

    // Hide round end
    els.roundEnd.classList.add("hidden");
    els.questionZone.classList.remove("hidden");

    showScreen("game");
    showQuestion();
  }

  function showQuestion() {
    answered = false;
    const q = questions[currentQuestionIndex];

    // Progress
    els.progressFill.style.width = ((currentQuestionIndex) / QUESTIONS_PER_ROUND * 100) + "%";

    // Reset feedback & next button
    els.feedback.classList.add("hidden");
    els.feedback.classList.remove("correct", "incorrect");
    els.btnFeedbackListen.classList.add("hidden");
    els.btnNext.classList.add("hidden");

    // Reset QCM buttons
    $$(".btn-qcm").forEach((btn) => {
      btn.classList.remove("correct", "wrong");
      btn.disabled = false;
    });

    hideAllAnswerZones();

    if (currentMode === "hangul-to-fr") {
      // Show character, user types pronunciation
      els.questionChar.textContent = q.char;
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerInputZone.classList.remove("hidden");
      els.answerInput.value = "";
      els.answerInput.disabled = false;
      els.answerInput.focus();
    } else if (currentMode === "fr-to-hangul") {
      // Show pronunciation, user picks Hangul from QCM
      els.questionChar.classList.add("hidden");
      els.questionText.textContent = q.pronFR;
      els.questionText.classList.remove("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerQcmZone.classList.remove("hidden");
      setupQCM(q);
    } else if (currentMode === "ecoute") {
      // Speak character, user picks Hangul from QCM
      els.questionChar.textContent = "?";
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.remove("hidden");
      els.answerQcmZone.classList.remove("hidden");
      setupQCM(q);
      // Auto-play
      setTimeout(() => speak(q.char), 300);
    } else if (currentMode === "expert-pronounce") {
      // Show character, user pronounces it (voice recognition)
      els.questionChar.textContent = q.char;
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerSpeechZone.classList.remove("hidden");
      els.speechResult.textContent = "";
      els.speechResult.classList.add("hidden");
      els.btnMic.disabled = false;
      stopListeningUI();
      if (!whisperPipeline) {
        // Precharge le modele Whisper des l'entree (telechargement unique)
        ensureWhisper();
      } else {
        els.speechStatus.textContent = "Appuyez sur le micro et prononcez le caractere.";
      }
    } else if (currentMode === "expert-fr-to-hangul") {
      // Show pronunciation, user writes the Hangul character
      els.questionChar.classList.add("hidden");
      els.questionText.textContent = q.pronFR;
      els.questionText.classList.remove("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerHangulZone.classList.remove("hidden");
      resetHangulInput();
    } else if (currentMode === "expert-ecoute") {
      // Speak character, user writes the Hangul character
      els.questionChar.textContent = "?";
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.remove("hidden");
      els.answerHangulZone.classList.remove("hidden");
      resetHangulInput();
      setTimeout(() => speak(q.char), 300);
    }
  }

  function hideAllAnswerZones() {
    els.answerInputZone.classList.add("hidden");
    els.answerQcmZone.classList.add("hidden");
    els.answerSpeechZone.classList.add("hidden");
    els.answerHangulZone.classList.add("hidden");
  }

  function resetHangulInput() {
    HangulComposer.reset();
    els.hangulInput.value = "";
    els.btnValidateHangul.disabled = false;
    els.hangulKeyboard.querySelectorAll(".key").forEach((k) => (k.disabled = false));
  }

  function refreshHangulInput() {
    els.hangulInput.value = HangulComposer.value();
  }

  // Disposition coreenne standard (2-beolsik) : touche physique -> jamo.
  // On utilise e.code (position physique) pour etre independant de l'agencement
  // (AZERTY/QWERTY) et coller au comportement d'un vrai clavier/IME coreen.
  const KEYBOARD_JAMO = {
    KeyQ: "ㅂ", KeyW: "ㅈ", KeyE: "ㄷ", KeyR: "ㄱ", KeyT: "ㅅ", KeyY: "ㅛ", KeyU: "ㅕ", KeyI: "ㅑ", KeyO: "ㅐ", KeyP: "ㅔ",
    KeyA: "ㅁ", KeyS: "ㄴ", KeyD: "ㅇ", KeyF: "ㄹ", KeyG: "ㅎ", KeyH: "ㅗ", KeyJ: "ㅓ", KeyK: "ㅏ", KeyL: "ㅣ",
    KeyZ: "ㅋ", KeyX: "ㅌ", KeyC: "ㅊ", KeyV: "ㅍ", KeyB: "ㅠ", KeyN: "ㅜ", KeyM: "ㅡ",
  };
  const KEYBOARD_JAMO_SHIFT = {
    KeyQ: "ㅃ", KeyW: "ㅉ", KeyE: "ㄸ", KeyR: "ㄲ", KeyT: "ㅆ", KeyO: "ㅒ", KeyP: "ㅖ",
  };

  function jamoFromKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (e.shiftKey && KEYBOARD_JAMO_SHIFT[e.code]) return KEYBOARD_JAMO_SHIFT[e.code];
    if (KEYBOARD_JAMO[e.code]) return KEYBOARD_JAMO[e.code];
    // Jamo tape directement (clavier coreen physique ou IME en mode jamo)
    const k = e.key;
    if (k && k.length === 1 &&
        (HangulComposer.KEYS_CONSONANTS.indexOf(k) !== -1 || HangulComposer.KEYS_VOWELS.indexOf(k) !== -1)) {
      return k;
    }
    return null;
  }

  function buildHangulKeyboard() {
    const makeKey = (ch, extraClass) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key" + (extraClass ? " " + extraClass : "");
      btn.textContent = ch;
      btn.dataset.jamo = ch;
      return btn;
    };

    const frag = document.createDocumentFragment();
    HangulComposer.KEYS_CONSONANTS.forEach((ch) => frag.appendChild(makeKey(ch, "key-cons")));
    HangulComposer.KEYS_VOWELS.forEach((ch) => frag.appendChild(makeKey(ch, "key-vow")));

    const back = document.createElement("button");
    back.type = "button";
    back.className = "key key-back";
    back.textContent = "⌫";
    back.dataset.action = "backspace";
    frag.appendChild(back);

    els.hangulKeyboard.appendChild(frag);

    els.hangulKeyboard.addEventListener("click", (e) => {
      const key = e.target.closest(".key");
      if (!key || key.disabled || answered) return;
      if (key.dataset.action === "backspace") {
        HangulComposer.backspace();
      } else if (key.dataset.jamo) {
        HangulComposer.input(key.dataset.jamo);
      }
      refreshHangulInput();
    });
  }

  function setupQCM(correctItem) {
    // Get 3 distractors from the same category
    const sameCategory = pool.filter((it) => it.char !== correctItem.char);
    const distractors = shuffle(sameCategory).slice(0, 3);

    // Build 4 options, shuffle
    const options = shuffle([correctItem, ...distractors]);

    $$(".btn-qcm").forEach((btn, i) => {
      if (i < options.length) {
        btn.textContent = options[i].char;
        btn.dataset.char = options[i].char;
        btn.classList.remove("hidden");
      } else {
        btn.classList.add("hidden");
      }
    });
  }

  function handleAnswer(isCorrect, correctItem) {
    if (answered) return;
    answered = true;

    lastCorrectChar = correctItem.char;

    if (isCorrect) {
      score++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      els.feedbackIcon.textContent = "\u2705";
      els.feedbackText.textContent = "Correct !";
      els.feedback.className = "feedback correct";
      els.btnFeedbackListen.classList.add("hidden");
    } else {
      streak = 0;
      els.feedbackIcon.textContent = "\u274C";
      els.feedbackText.textContent = "Incorrect. Reponse : " + correctItem.char + " = " + correctItem.pronFR;
      els.feedback.className = "feedback incorrect";
      // Permet d'ecouter la bonne reponse, et la joue automatiquement
      if (speechAvailable) {
        els.btnFeedbackListen.classList.remove("hidden");
        setTimeout(() => speak(correctItem.char), 400);
      }
    }

    els.feedback.classList.remove("hidden");
    els.scoreDisplay.textContent = score + " / " + (currentQuestionIndex + 1);
    els.streakDisplay.textContent = "\uD83D\uDD25 " + streak;

    recordAnswer(correctItem.char, isCorrect);

    // Disable input
    if (currentMode === "hangul-to-fr") {
      els.answerInput.disabled = true;
    } else if (currentMode === "expert-pronounce") {
      els.btnMic.disabled = true;
      stopListeningUI();
    } else if (currentMode === "expert-fr-to-hangul" || currentMode === "expert-ecoute") {
      els.btnValidateHangul.disabled = true;
      els.hangulKeyboard.querySelectorAll(".key").forEach((k) => (k.disabled = true));
    }

    // Check if round is over
    if (currentQuestionIndex >= QUESTIONS_PER_ROUND - 1) {
      setTimeout(showRoundEnd, 1200);
    } else {
      els.btnNext.classList.remove("hidden");
    }
  }

  function showRoundEnd() {
    els.questionZone.classList.add("hidden");
    hideAllAnswerZones();
    els.feedback.classList.add("hidden");
    els.btnNext.classList.add("hidden");
    els.progressFill.style.width = "100%";

    els.roundScore.textContent = score + " / " + QUESTIONS_PER_ROUND + " (" + Math.round(score / QUESTIONS_PER_ROUND * 100) + "%)";
    els.roundEnd.classList.remove("hidden");
  }

  // ===== ÉVÉNEMENTS =====
  function initEvents() {
    // Mode cards
    $$(".card-mode").forEach((card) => {
      card.addEventListener("click", () => {
        const mode = card.dataset.mode;
        if ((mode === "ecoute" || mode === "expert-ecoute") && !speechAvailable) return;
        if (mode === "expert-pronounce" && !voiceAvailable) return;
        startGame(mode);
      });
    });

    // Navigation
    els.btnBack.addEventListener("click", () => showScreen("home"));
    els.btnReference.addEventListener("click", () => showScreen("reference"));
    els.btnStats.addEventListener("click", () => showScreen("stats"));
    els.btnHomeFromGame.addEventListener("click", () => showScreen("home"));
    els.btnReplay.addEventListener("click", () => startGame(currentMode));

    // Validate text input
    els.btnValidate.addEventListener("click", () => {
      if (answered) return;
      const q = questions[currentQuestionIndex];
      const isCorrect = checkAnswer(els.answerInput.value, q.pronFR);
      handleAnswer(isCorrect, q);
    });

    els.answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (answered) {
          nextQuestion();
        } else {
          els.btnValidate.click();
        }
      }
    });

    // Expert : micro (reconnaissance vocale Whisper)
    els.btnMic.addEventListener("click", () => {
      if (answered) return;
      if (listening) stopRecording();
      else startRecording();
    });

    // Expert : validation du clavier hangeul
    els.btnValidateHangul.addEventListener("click", () => {
      if (answered) return;
      const q = questions[currentQuestionIndex];
      const isCorrect = HangulComposer.value().trim() === q.char;
      handleAnswer(isCorrect, q);
    });

    // Clavier physique pour les modes experts d'ecriture : disposition
    // coreenne standard (2-beolsik), comme un vrai clavier/IME coreen.
    document.addEventListener("keydown", (e) => {
      if (currentScreen !== "game") return;
      if (currentMode !== "expert-fr-to-hangul" && currentMode !== "expert-ecoute") return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (answered) nextQuestion();
        else els.btnValidateHangul.click();
        return;
      }
      if (e.key === "Backspace" && !answered) {
        e.preventDefault();
        HangulComposer.backspace();
        refreshHangulInput();
        return;
      }
      if (answered) return;
      const jamo = jamoFromKey(e);
      if (jamo) {
        e.preventDefault();
        HangulComposer.input(jamo);
        refreshHangulInput();
      }
    });

    // QCM buttons
    $$(".btn-qcm").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (answered) return;
        const q = questions[currentQuestionIndex];
        const isCorrect = btn.dataset.char === q.char;

        if (isCorrect) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("wrong");
          // Highlight correct
          $$(".btn-qcm").forEach((b) => {
            if (b.dataset.char === q.char) b.classList.add("correct");
          });
        }
        $$(".btn-qcm").forEach((b) => (b.disabled = true));

        handleAnswer(isCorrect, q);
      });
    });

    // Next question
    els.btnNext.addEventListener("click", nextQuestion);

    // Listen button in game
    els.btnListenQuestion.addEventListener("click", () => {
      const q = questions[currentQuestionIndex];
      speak(q.char);
    });

    // Ecouter la bonne reponse apres une erreur
    els.btnFeedbackListen.addEventListener("click", () => {
      if (lastCorrectChar) speak(lastCorrectChar);
    });

    // Reference filters
    $$(".btn-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".btn-filter").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        buildReferenceGrid(btn.dataset.filter);
      });
    });

    // Reset stats
    els.btnResetStats.addEventListener("click", () => {
      if (confirm("Reinitialiser toutes les statistiques ?")) {
        resetStats();
        renderStats();
      }
    });

    // Difficulty change
    els.difficulty.addEventListener("change", () => {
      currentDifficulty = els.difficulty.value;
    });
  }

  function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < QUESTIONS_PER_ROUND) {
      showQuestion();
    } else {
      showRoundEnd();
    }
  }

  // ===== INIT =====
  function init() {
    initSpeech();
    initVoiceMode();
    buildHangulKeyboard();
    initEvents();
    showScreen("home");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
