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
  let currentMode = null;     // "hangul-to-fr" | "fr-to-hangul" | "ecoute"
  let currentDifficulty = "debutant";
  let koreanVoice = null;
  let speechAvailable = false;
  let useFallbackTTS = false;
  let fallbackAudio = null;

  // État de la manche
  let pool = [];
  let questions = [];
  let currentQuestionIndex = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let answered = false;

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
    feedback: $("feedback"),
    feedbackIcon: $("feedback-icon"),
    feedbackText: $("feedback-text"),
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

  // ===== WEB SPEECH API =====
  function enableListening() {
    speechAvailable = true;
    els.cardEcoute.classList.remove("disabled");
    els.ecouteWarning.classList.add("hidden");
  }

  function initSpeech() {
    // Try native Web Speech API first
    if ("speechSynthesis" in window) {
      function findKoreanVoice() {
        const voices = speechSynthesis.getVoices();
        koreanVoice = voices.find((v) => v.lang.startsWith("ko"));
        if (koreanVoice) {
          useFallbackTTS = false;
          enableListening();
        }
      }

      speechSynthesis.onvoiceschanged = findKoreanVoice;
      findKoreanVoice();
    }

    // If no native Korean voice found, enable fallback TTS
    if (!koreanVoice) {
      useFallbackTTS = true;
      fallbackAudio = new Audio();
      enableListening();
    }
  }

  function disableListening() {
    speechAvailable = false;
    els.cardEcoute.classList.add("disabled");
    els.ecouteWarning.classList.remove("hidden");
  }

  function speak(text) {
    if (!speechAvailable) return;

    if (!useFallbackTTS && koreanVoice) {
      // Native Web Speech API
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.voice = koreanVoice;
      utter.lang = "ko-KR";
      utter.rate = SPEECH_RATE;
      speechSynthesis.speak(utter);
    } else if (fallbackAudio) {
      // Fallback: Google Translate TTS
      fallbackAudio.pause();
      fallbackAudio.src = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ko&q=" + encodeURIComponent(text);
      fallbackAudio.playbackRate = SPEECH_RATE;
      fallbackAudio.play().catch(function () { /* user gesture required */ });
    }
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
    els.btnNext.classList.add("hidden");

    // Reset QCM buttons
    $$(".btn-qcm").forEach((btn) => {
      btn.classList.remove("correct", "wrong");
      btn.disabled = false;
    });

    if (currentMode === "hangul-to-fr") {
      // Show character, user types pronunciation
      els.questionChar.textContent = q.char;
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerInputZone.classList.remove("hidden");
      els.answerQcmZone.classList.add("hidden");
      els.answerInput.value = "";
      els.answerInput.disabled = false;
      els.answerInput.focus();
    } else if (currentMode === "fr-to-hangul") {
      // Show pronunciation, user picks Hangul from QCM
      els.questionChar.classList.add("hidden");
      els.questionText.textContent = q.pronFR;
      els.questionText.classList.remove("hidden");
      els.btnListenQuestion.classList.add("hidden");
      els.answerInputZone.classList.add("hidden");
      els.answerQcmZone.classList.remove("hidden");
      setupQCM(q);
    } else if (currentMode === "ecoute") {
      // Speak character, user picks Hangul from QCM
      els.questionChar.textContent = "?";
      els.questionChar.classList.remove("hidden");
      els.questionText.classList.add("hidden");
      els.btnListenQuestion.classList.remove("hidden");
      els.answerInputZone.classList.add("hidden");
      els.answerQcmZone.classList.remove("hidden");
      setupQCM(q);
      // Auto-play
      setTimeout(() => speak(q.char), 300);
    }
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

    if (isCorrect) {
      score++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      els.feedbackIcon.textContent = "\u2705";
      els.feedbackText.textContent = "Correct !";
      els.feedback.className = "feedback correct";
    } else {
      streak = 0;
      els.feedbackIcon.textContent = "\u274C";
      els.feedbackText.textContent = "Incorrect. Reponse : " + correctItem.char + " = " + correctItem.pronFR;
      els.feedback.className = "feedback incorrect";
    }

    els.feedback.classList.remove("hidden");
    els.scoreDisplay.textContent = score + " / " + (currentQuestionIndex + 1);
    els.streakDisplay.textContent = "\uD83D\uDD25 " + streak;

    recordAnswer(correctItem.char, isCorrect);

    // Disable input
    if (currentMode === "hangul-to-fr") {
      els.answerInput.disabled = true;
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
    els.answerInputZone.classList.add("hidden");
    els.answerQcmZone.classList.add("hidden");
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
        if (mode === "ecoute" && !speechAvailable) return;
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
