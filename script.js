document.addEventListener('DOMContentLoaded', () => {
    // VexFlowの初期化
    const VF = Vex.Flow;
    let renderer, context, stave, notes = [], currentNoteIndex = 0;
    let selectedScale = 'C';
    let targetPitches = [];
    let tempo = 120;
    let noteDuration = 'eighth';
    let animationTimeoutId;
    let isPaused = false;
    let metronomeIntervalId;
    let waveSurfer;
    let mask = document.getElementById('mask');

    // 要素の取得
    const menu = document.getElementById('menu');
    const gameArea = document.getElementById('game-area');
    const highscoreArea = document.getElementById('highscore-area');
    const challengeArea = document.getElementById('challenge-area');

    const startGameButton = document.getElementById('start-game');
    const viewHighscoreButton = document.getElementById('view-highscore');
    const challengeModeButton = document.getElementById('challenge-mode');

    const backToMenuGame = document.getElementById('back-to-menu-game');
    const backToMenuHighscore = document.getElementById('back-to-menu-highscore');
    const backToMenuChallenge = document.getElementById('back-to-menu-challenge');

    const selectScaleButton = document.getElementById('select-scale');
    const startPerformanceButton = document.getElementById('start-performance');
    const startChallengeButton = document.getElementById('start-challenge');

    const frequencyDisplay = document.getElementById('frequency');
    const scoreBoard = document.getElementById('score');
    const challengeScoreDisplay = document.getElementById('challenge-score');
    const challengeResult = document.getElementById('challenge-result');
    const tempoSlider = document.getElementById('tempo');
    const tempoValue = document.getElementById('tempo-value');
    const noteDurationSelect = document.getElementById('note-duration');
    const usernameInput = document.getElementById('username');
    const highscoreList = document.getElementById('highscore-list');
    const pauseButton = document.getElementById('pause-game');

    let score = 0;
    let highscore = localStorage.getItem('highscore') ? parseInt(localStorage.getItem('highscore')) : 0;
    let challengeScore = 0;
    let challengeTimer;
    let audioContext;
    let analyser;
    let dataArray;
    let source;
    let isTuning = false;
    let userName = '';

    // 音階ごとの音名と周波数
    const scales = {
        'C': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
        'G': ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'],
        'D': ['D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C#4', 'D4'],
        'A': ['A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G#4', 'A4'],
        'E': ['E3', 'F#3', 'G#3', 'A3', 'B3', 'C#4', 'D#4', 'E4'],
        'F': ['F3', 'G3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F4'],
        'Bb': ['A#2', 'C3', 'D3', 'D#3', 'F3', 'G3', 'A3', 'A#3'],
        'Eb': ['D#3', 'F3', 'G3', 'G#3', 'A#3', 'C4', 'D4', 'D#4']
    };

    // 音名から周波数へのマッピング
    const noteFrequencies = {
        'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00,
        'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
        'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99,
        'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
        'C5': 523.25
    };

    // メトロノーム用ビープ音
    let metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    function playMetronomeClick() {
        const oscillator = metronomeAudioContext.createOscillator();
        oscillator.frequency.setValueAtTime(1000, metronomeAudioContext.currentTime); // 1kHz
        oscillator.type = 'sine';
        const gainNode = metronomeAudioContext.createGain();
        gainNode.gain.setValueAtTime(1, metronomeAudioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, metronomeAudioContext.currentTime + 0.1);
        oscillator.connect(gainNode).connect(metronomeAudioContext.destination);
        oscillator.start(metronomeAudioContext.currentTime);
        oscillator.stop(metronomeAudioContext.currentTime + 0.1);
    }

    // イベントリスナーの設定
    startGameButton.addEventListener('click', () => {
        userName = usernameInput.value.trim();
        if (userName === '') {
            alert('ユーザーネームを入力してください。');
            return;
        }
        showSection(gameArea);
        document.querySelector('.game-controls').style.display = 'flex';
    });

    viewHighscoreButton.addEventListener('click', () => {
        updateHighscoreDisplay();
        showSection(highscoreArea);
    });

    challengeModeButton.addEventListener('click', () => {
        showSection(challengeArea);
    });

    backToMenuGame.addEventListener('click', () => {
        stopTuning();
        showSection(menu);
    });

    backToMenuHighscore.addEventListener('click', () => {
        showSection(menu);
    });

    backToMenuChallenge.addEventListener('click', () => {
        stopChallenge();
        showSection(menu);
    });

    selectScaleButton.addEventListener('click', () => {
        selectedScale = document.getElementById('scale').value;
        document.querySelector('.game-controls').style.display = 'none';
        document.getElementById('tuning-area').classList.remove('hidden');
        setupVexFlow();
    });

    startPerformanceButton.addEventListener('click', () => {
        if (isPaused) return;
        startTuning();
    });

    startChallengeButton.addEventListener('click', () => {
        startChallenge();
    });

    tempoSlider.addEventListener('input', () => {
        tempo = parseInt(tempoSlider.value);
        tempoValue.textContent = tempo;
        if (isTuning) {
            clearInterval(metronomeIntervalId);
            startMetronome();
        }
    });

    noteDurationSelect.addEventListener('change', () => {
        noteDuration = noteDurationSelect.value;
        if (isTuning) {
            clearInterval(metronomeIntervalId);
            setupVexFlow();
            startMetronome();
        }
    });

    pauseButton.addEventListener('click', () => {
        if (isPaused) {
            resumeGame();
        } else {
            pauseGame();
        }
    });

    // セクションの表示・非表示を制御する関数
    function showSection(section) {
        document.querySelectorAll('.section').forEach(el => {
            if (el === section) {
                el.classList.add('visible');
                el.classList.remove('hidden');
            } else {
                el.classList.remove('visible');
                el.classList.add('hidden');
            }
        });
    }

    // ハイスコアの表示を更新
    function updateHighscoreDisplay() {
        const highscores = JSON.parse(localStorage.getItem('highscores')) || [];
        if (highscores.length === 0) {
            highscoreList.textContent = 'ハイスコアはまだありません。';
            return;
        }
        highscores.sort((a, b) => b.score - a.score);
        highscoreList.innerHTML = highscores.map(entry => `<p>${entry.username}: ${entry.score} 点</p>`).join('');
    }

    // VexFlowを使って楽譜をセットアップ
    function setupVexFlow() {
        const vexflowContainer = document.getElementById('vexflow-container');
        vexflowContainer.innerHTML = ''; // 既存のレンダラーをクリア
        renderer = new VF.Renderer(vexflowContainer, VF.Renderer.Backends.SVG);
        renderer.resize(700, 200);
        context = renderer.getContext();
        stave = new VF.Stave(10, 40, 680);
        stave.addClef("treble").addTimeSignature("4/4");
        stave.setContext(context).draw();

        // 選択された音階に基づいてノートを生成
        const scaleNotes = scales[selectedScale];
        notes = [];
        targetPitches = [];

        // 2小節の音階（上昇と下降）
        const fullScale = scaleNotes.concat(scaleNotes.slice(0, -1).reverse());
        fullScale.forEach(noteName => {
            let duration = noteDuration === 'eighth' ? '8' : 'q';
            let staveNote = new VF.StaveNote({ clef: "treble", keys: [noteName.toLowerCase()], duration: duration });
            // シャープやフラットの処理
            if (noteName.includes('#')) {
                staveNote.addAccidental(0, new VF.Accidental('#'));
            } else if (noteName.includes('b')) {
                staveNote.addAccidental(0, new VF.Accidental('b'));
            }
            notes.push(staveNote);
            targetPitches.push(noteFrequencies[noteName]);
        });

        // ビームを追加（八分音符の場合）
        if (noteDuration === 'eighth') {
            let beams = VF.Beam.generateBeams(notes);
            VF.Formatter.FormatAndDraw(context, stave, notes);
            beams.forEach(function(beam) {
                beam.setContext(context).draw();
            });
        } else {
            VF.Formatter.FormatAndDraw(context, stave, notes);
        }

        currentNoteIndex = 0;
        highlightCurrentNote();
    }

    // 現在のノートをハイライト
    function highlightCurrentNote() {
        if (currentNoteIndex >= notes.length) {
            currentNoteIndex = 0;
        }
        const svg = document.getElementById('vexflow-container').querySelector('svg');
        const allNotes = svg.querySelectorAll('.vf-note');
        allNotes.forEach((note, index) => {
            if (index === currentNoteIndex) {
                note.style.fill = '#ffdd57'; // ハイライト色
            } else {
                note.style.fill = '#000000'; // 通常色
            }
        });
    }

    // ノートのアニメーションとハイライトの同期
    function animateNotes() {
        if (isPaused) return;
        highlightCurrentNote();
        currentNoteIndex++;
        animationTimeoutId = setTimeout(() => {
            requestAnimationFrame(animateNotes);
        }, (60000 / tempo) * (noteDuration === 'quarter' ? 1 : 0.5)); // 四分音符か八分音符の間隔
    }

    // メトロノームの開始
    function startMetronome() {
        if (metronomeIntervalId) clearInterval(metronomeIntervalId);
        const interval = (60000 / tempo) / (noteDuration === 'quarter' ? 1 : 0.5);
        metronomeIntervalId = setInterval(() => {
            playMetronomeClick();
        }, interval);
    }

    // チューニングの開始
    function startTuning() {
        if (isTuning) return; // 既にチューニング中なら無視
        isTuning = true;
        score = 0;
        scoreBoard.textContent = score;
        animateNotes();
        startMetronome();

        // Web Audio APIを使用してマイク入力を取得
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 2048;
            dataArray = new Float32Array(analyser.fftSize);

            detectPitch();
            setupWaveform(stream);
        }).catch(err => {
            console.error('マイクにアクセスできませんでした:', err);
            alert('マイクにアクセスできませんでした。設定を確認してください。');
            isTuning = false;
            stopAnimation();
            stopMetronome();
        });
    }

    // WaveSurfer.jsで音の波形を表示
    function setupWaveform(stream) {
        const waveformContainer = document.getElementById('waveform-container');
        waveformContainer.innerHTML = ''; // 既存の波形をクリア

        waveSurfer = WaveSurfer.create({
            container: '#waveform-container',
            waveColor: '#ffdd57',
            progressColor: '#ffdd57',
            cursorColor: '#ffdd57',
            height: 150,
            responsive: true,
            interact: false,
            plugins: [
                WaveSurfer.microphone.create()
            ]
        });

        waveSurfer.microphone.on('deviceReady', function(stream) {
            console.log('マイクが準備できました。');
        });
        waveSurfer.microphone.on('deviceError', function(code) {
            console.warn('マイクエラー:', code);
        });

        waveSurfer.microphone.start();
    }

    // ピッチ検出とスコア更新
    function detectPitch() {
        if (!isTuning || isPaused) return;
        analyser.getFloatTimeDomainData(dataArray);
        const pitch = autoCorrelate(dataArray, audioContext.sampleRate);
        if (pitch !== -1) {
            frequencyDisplay.textContent = pitch.toFixed(2);
            const targetPitch = targetPitches[currentNoteIndex % targetPitches.length];
            updateScore(calculateScore(pitch, targetPitch));
        }
        requestAnimationFrame(detectPitch);
    }

    // チャレンジモードの開始
    function startChallenge() {
        challengeScore = 0;
        challengeScoreDisplay.textContent = challengeScore;
        challengeResult.classList.remove('hidden');
        startChallengeButton.disabled = true;

        // チャレンジタイマーを開始（例: 60秒間）
        let timeLeft = 60;
        challengeTimer = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(challengeTimer);
                startChallengeButton.disabled = false;
                saveHighscore(userName, challengeScore);
                alert(`チャレンジ終了！ スコア: ${challengeScore} 点`);
                challengeResult.classList.add('hidden');
            } else {
                if (!isPaused) {
                    // 実際の音程検出に基づくスコア更新に置き換える
                    // ここではランダムなスコアを加算
                    const randomScore = Math.floor(Math.random() * 10);
                    challengeScore += randomScore;
                    challengeScoreDisplay.textContent = challengeScore;
                    timeLeft--;
                }
            }
        }, 1000);
    }

    // チャレンジモードの停止
    function stopChallenge() {
        clearInterval(challengeTimer);
        startChallengeButton.disabled = false;
        challengeResult.classList.add('hidden');
    }

    // チューニングの停止
    function stopTuning() {
        isTuning = false;
        stopAnimation();
        stopMetronome();
        if (audioContext) {
            audioContext.close();
        }
        if (waveSurfer) {
            waveSurfer.microphone.stop();
            waveSurfer.destroy();
        }
    }

    // ノートアニメーションの停止
    function stopAnimation() {
        clearTimeout(animationTimeoutId);
        // ノートの色をリセット
        const svg = document.getElementById('vexflow-container').querySelector('svg');
        if (svg) {
            const allNotes = svg.querySelectorAll('.vf-note');
            allNotes.forEach(note => {
                note.style.fill = '#000000';
            });
        }
    }

    // メトロノームの停止
    function stopMetronome() {
        if (metronomeIntervalId) clearInterval(metronomeIntervalId);
    }

    // ポーズ機能の実装
    function pauseGame() {
        isPaused = true;
        clearTimeout(animationTimeoutId);
        stopMetronome();
        pauseButton.textContent = '再開';
        mask.classList.remove('hidden'); // マスクを表示
    }

    function resumeGame() {
        isPaused = false;
        animateNotes();
        startMetronome();
        pauseButton.textContent = 'ポーズ';
        mask.classList.add('hidden'); // マスクを非表示
        detectPitch();
    }

    // スコアの更新
    function updateScore(newScore) {
        score = Math.round(newScore);
        scoreBoard.textContent = score;
        if (score > highscore) {
            highscore = score;
            localStorage.setItem('highscore', highscore);
            saveHighscore(userName, highscore);
        }
    }

    // スコア計算
    function calculateScore(pitch, targetPitch) {
        const diff = Math.abs(pitch - targetPitch);
        return Math.max(0, 100 - diff); // 差が小さいほど高いスコア
    }

    // スコアをローカルストレージに保存
    function saveHighscore(username, score) {
        let highscores = JSON.parse(localStorage.getItem('highscores')) || [];
        highscores.push({ username, score });
        localStorage.setItem('highscores', JSON.stringify(highscores));
    }

    // 音程検出（Auto-Correlationアルゴリズム）
    function autoCorrelate(buffer, sampleRate) {
        // ...（前回と同じアルゴリズムのため省略）
    }

    // 初期ハイスコア表示の更新
    updateHighscoreDisplay();
});
