// 主应用逻辑
(function() {
    'use strict';

    // 版本号：每次更新递增，状态栏右下角可见，点击查看版本信息
    const APP_VERSION = '20261007h';
    const APP_VERSION_DATE = '2026-10-07';
    const APP_UPDATE_NOTES = [
        'h: 修复语音不清（两句话重叠播放的bug）；轻声母字（七/车/一/九/兵/卒）不再被裁掉字头；新增听棋悬浮控制条，弹窗收起后也能随时暂停/跳步',
        'g: 语音包改用Web Audio拼接播放：裁掉每段录音首尾静音、整句一次播出，字与字之间不再拖长（与每步间隔设置无关）',
        'f: 点选棋谱即自动听棋并收起弹窗；关闭弹窗不再打断听棋；弹窗高度适配手机（底部按钮可点）',
        'e: 状态栏显示版本号，方便确认是否为最新版',
        'd: 离线语音包（断网也能语音播报）',
        'c: 语音走服务器代理/在线自动检测',
        'b: 在线语音兜底、进度条触摸拖动修复'
    ];

    const game = new ChineseChess();
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');

    // 棋盘配置
    const BOARD_CONFIG = {
        rows: 10,
        cols: 9,
        padding: 30,
        cellSize: 0
    };

    // 触摸状态
    let touchStart = null;
    let selectedPos = null;

    // 语音合成
    const synth = window.speechSynthesis;
    let currentUtterance = null;
    let lastSpokenMessage = '西尔象棋盲棋已启动，红方先行';
    let messageTimeout = null;

    // 显示可见文字提示（语音失效时也能看到）
    function showMessage(text, duration) {
        duration = duration || 3000;
        var bar = document.getElementById('message-bar');
        if (bar) {
            bar.textContent = text;
            bar.className = 'message-show';
            if (messageTimeout) clearTimeout(messageTimeout);
            messageTimeout = setTimeout(function() {
                bar.className = '';
            }, duration);
        }
    }

    // ========== 功能1：游戏模式 ==========
    let gameMode = 'pvp'; // 'pvp' 或 'pve'

    // ========== 功能2：语音识别 ==========
    let recognition = null;
    let isListening = false;
    let voiceContinuous = false; // 连续语音模式

    // ========== 功能3：列表模式 ==========
    let listMode = false;
    let listPieces = [];
    let listSelectedIndex = -1;

    // ========== 功能4：音效 ==========
    let audioContext = null;

    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playMoveSound() {
        initAudioContext();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.1);
    }

    function playCaptureSound() {
        initAudioContext();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 400;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
    }

    function playCheckSound() {
        initAudioContext();
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);
        osc1.frequency.value = 1000;
        osc2.frequency.value = 1200;
        osc1.type = 'sine';
        osc2.type = 'sine';
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc1.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.3);
        osc2.stop(audioContext.currentTime + 0.3);
    }

    function playErrorSound() {
        initAudioContext();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = 200;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
    }

    function playWinSound() {
        initAudioContext();
        // 胜利音效：三个上升音符
        [523, 659, 784].forEach(function(freq, i) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            const startTime = audioContext.currentTime + i * 0.15;
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    // ========== 功能5：棋谱回放 ==========
    let recordPlayer = null;

    function setupRecordPlayer() {
        // 检查必要元素是否存在
        if (!document.getElementById('btn-record') ||
            !document.getElementById('record-modal') ||
            typeof ChessRecordPlayer === 'undefined') {
            return; // 旧版 HTML 没有棋谱功能，跳过
        }
    
        recordPlayer = new ChessRecordPlayer(game, {
            move: function(m, result, stepNum, total, isUndo, silent) {
                // silent：拖动进度条/快进跳转时的静默推演，不逐句播报
                if (silent) return null;
                playMoveSound();
                var text = result.message || '';
                if (text) lastSpokenMessage = text;
                updateRecordUI(stepNum, total);
                drawBoard();
                updateStatus();
                if (!text) return null;
                // 返回 Promise：自动播放会等这句播完再计时（"2秒"=播完后再停2秒）
                return speak(text, { noBeep: true });
            },
            playState: function(isPlaying) {
                var playBtn = document.getElementById('record-play');
                var pauseBtn = document.getElementById('record-pause');
                if (playBtn) playBtn.className = isPlaying ? 'rec-primary playing' : 'rec-primary';
                if (pauseBtn) pauseBtn.className = isPlaying ? '' : 'rec-primary';
                syncListenBar();
            },
            seeked: function(current, total) {
                updateRecordUI(current, total);
                drawBoard();
                updateStatus();
            },
            finished: function() {
                speak('棋谱回放完毕，共' + recordPlayer.moves.length + '步');
            }
        });

        // 打开棋谱模态框
        var btnRecord = document.getElementById('btn-record');
        if (btnRecord) btnRecord.addEventListener('click', openRecordModal);
        // 关闭：只收起弹窗，不打断正在播放的听棋（要停时用弹窗里的"暂停"或"新局"）
        var btnClose = document.getElementById('record-close');
        if (btnClose) btnClose.addEventListener('click', function() { closeRecordModal(true); });
        // 解析棋谱（手动粘贴/导入：只解析，不自动收起弹窗，方便再按"播放"或拖进度条）
        var btnParse = document.getElementById('record-parse');
        if (btnParse) btnParse.addEventListener('click', function() { handleRecordParse(false); });
        // 导入棋谱文件
        var btnFile = document.getElementById('record-file');
        var fileInput = document.getElementById('record-file-input');
        if (btnFile && fileInput) {
            btnFile.addEventListener('click', function() { fileInput.click(); });
            fileInput.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var text = ev.target.result;
                    document.getElementById('record-text').value = text;
                    speak('已导入文件，正在解析');
                    handleRecordParse(); // 导入后直接解析，少一步操作
                };
                reader.onerror = function() {
                    showMessage('文件读取失败', 2000);
                    speak('文件读取失败');
                };
                reader.readAsText(file, 'UTF-8');
                e.target.value = '';
            });
        }

        function hasPlayer() {
            if (!recordPlayer || recordPlayer.moves.length === 0) {
                speak('请先选择或导入棋谱');
                return false;
            }
            return true;
        }

        // 上一步
        var btnPrev = document.getElementById('record-prev');
        if (btnPrev) btnPrev.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            if (!recordPlayer.prev()) speak('已经是第一步了');
        });
        // 下一步
        var btnNext = document.getElementById('record-next');
        if (btnNext) btnNext.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            if (!recordPlayer.next()) speak('已经是最后一步了');
        });
        // ▶ 播放
        var btnPlay = document.getElementById('record-play');
        if (btnPlay) btnPlay.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.play();
            if (recordPlayer.playing) speak('开始播放，第' + recordPlayer.current + '步');
        });
        // ⏸ 暂停
        var btnPause = document.getElementById('record-pause');
        if (btnPause) btnPause.addEventListener('click', function() {
            if (!hasPlayer()) return;
            if (recordPlayer.playing) {
                recordPlayer.pause();
                speak('已暂停，停在第' + recordPlayer.current + '步');
            } else {
                speak('现在没有在播放');
            }
        });
        // 快退10步 / 快进10步
        function skipSteps(n, label) {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            var moved = recordPlayer.skip(n);
            syncRecordView();
            if (moved === 0) {
                speak('已经到' + (n > 0 ? '末尾' : '开头') + '了');
                return;
            }
            announceStep(label + Math.abs(moved) + '步');
        }
        var btnBack10 = document.getElementById('record-back10');
        if (btnBack10) btnBack10.addEventListener('click', function() { skipSteps(-10, '已快退'); });
        var btnFwd10 = document.getElementById('record-fwd10');
        if (btnFwd10) btnFwd10.addEventListener('click', function() { skipSteps(10, '已快进'); });
        // 回到开头
        var btnFirst = document.getElementById('record-first');
        if (btnFirst) btnFirst.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            recordPlayer.jumpTo(0);
            syncRecordView();
            speak('已回到开头，棋盘初始局面');
        });
        // 跳到末尾
        var btnLast = document.getElementById('record-last');
        if (btnLast) btnLast.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            recordPlayer.jumpTo(recordPlayer.moves.length);
            syncRecordView();
            announceStep('已跳到末尾，');
        });

        // ===== 听棋悬浮控制条（弹窗收起后仍可操作，逻辑与弹窗按钮一致）=====
        var lbFirst = document.getElementById('lb-first');
        if (lbFirst) lbFirst.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            recordPlayer.jumpTo(0);
            syncRecordView();
            speak('已回到开头，棋盘初始局面');
        });
        var lbPrev = document.getElementById('lb-prev');
        if (lbPrev) lbPrev.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            if (!recordPlayer.prev()) speak('已经是第一步了');
        });
        var lbNext = document.getElementById('lb-next');
        if (lbNext) lbNext.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            if (!recordPlayer.next()) speak('已经是最后一步了');
        });
        var lbLast = document.getElementById('lb-last');
        if (lbLast) lbLast.addEventListener('click', function() {
            if (!hasPlayer()) return;
            recordPlayer.pause();
            recordPlayer.jumpTo(recordPlayer.moves.length);
            syncRecordView();
            announceStep('已跳到末尾，');
        });
        var lbToggle = document.getElementById('lb-toggle');
        if (lbToggle) lbToggle.addEventListener('click', function() {
            if (!hasPlayer()) return;
            if (recordPlayer.playing) {
                recordPlayer.pause();
                speak('已暂停，停在第' + recordPlayer.current + '步');
            } else {
                recordPlayer.play();
            }
        });
        // 点"第x/y步"打开完整播放控制弹窗
        var lbInfo = document.getElementById('lb-info');
        if (lbInfo) lbInfo.addEventListener('click', function() {
            openRecordModal();
        });
        // 进度条：拖动跳转
        var seek = document.getElementById('record-seek');
        if (seek) {
            seek.addEventListener('input', function() {
                if (recordPlayer && recordPlayer.playing) recordPlayer.pause();
                var total = recordPlayer ? recordPlayer.moves.length : 0;
                document.getElementById('record-step-info').textContent =
                    '第 ' + this.value + ' / ' + total + ' 步';
            });
            seek.addEventListener('change', function() {
                if (!hasPlayer()) return;
                recordPlayer.pause();
                recordPlayer.jumpTo(parseInt(this.value, 10) || 0);
                syncRecordView();
                announceStep('已跳到第' + recordPlayer.current + '步，');
            });
            // 手机兼容修复：部分手机浏览器（微信/华为浏览器等）里原生 range 控件
            // 拖不动，这里直接按手指的 X 坐标计算进度，保证任何手机都能拖。
            var seekTouching = false;
            function seekValueFromX(x) {
                var rect = seek.getBoundingClientRect();
                var ratio = (x - rect.left) / Math.max(1, rect.width);
                ratio = Math.max(0, Math.min(1, ratio));
                var total = recordPlayer ? recordPlayer.moves.length : (parseInt(seek.max, 10) || 0);
                var v = Math.round(ratio * total);
                seek.value = String(v);
                document.getElementById('record-step-info').textContent =
                    '第 ' + v + ' / ' + total + ' 步';
            }
            seek.addEventListener('touchstart', function(e) {
                seekTouching = true;
                if (recordPlayer && recordPlayer.playing) recordPlayer.pause();
                seekValueFromX(e.touches[0].clientX);
                e.preventDefault();
            }, { passive: false });
            seek.addEventListener('touchmove', function(e) {
                if (!seekTouching) return;
                seekValueFromX(e.touches[0].clientX);
                e.preventDefault();
            }, { passive: false });
            seek.addEventListener('touchend', function() {
                if (!seekTouching) return;
                seekTouching = false;
                if (!hasPlayer()) return;
                recordPlayer.pause();
                recordPlayer.jumpTo(parseInt(seek.value, 10) || 0);
                syncRecordView();
                announceStep('已跳到第' + recordPlayer.current + '步，');
            }, { passive: false });
        }
        // 速度档位
        buildSpeedPresets();
        // 语音自检
        var btnTtsTest = document.getElementById('record-tts-test');
        if (btnTtsTest) btnTtsTest.addEventListener('click', testTts);
        // 清空"我的棋谱"
        var btnClearSaved = document.getElementById('saved-games-clear');
        if (btnClearSaved) btnClearSaved.addEventListener('click', function() {
            saveGamesList([]);
            buildGameLists();
            speak('已清空我的棋谱');
        });
    }

    // 跳转后同步界面（进度条、棋盘、状态栏）
    function syncRecordView() {
        if (!recordPlayer) return;
        updateRecordUI(recordPlayer.current, recordPlayer.moves.length);
        drawBoard();
        updateStatus();
    }

    // 播报"第N步，红方/黑方 着法"
    function announceStep(prefix) {
        if (!recordPlayer) return;
        var n = recordPlayer.current;
        if (n <= 0) { speak(prefix + '棋盘初始局面'); return; }
        var m = recordPlayer.moves[n - 1];
        var side = (m && m.color === 'black') ? '黑方' : '红方';
        speak(prefix + side + ' ' + ((m && m.message) ? m.message : (m ? m.raw : '')));
    }

    // 速度档位：每步之间停多久
    var SPEED_PRESETS = [
        { label: '2秒', ms: 2000 },
        { label: '10秒', ms: 10000 },
        { label: '30秒', ms: 30000 },
        { label: '1分钟', ms: 60000 },
        { label: '3分钟', ms: 180000 },
        { label: '5分钟', ms: 300000 }
    ];

    function buildSpeedPresets() {
        var box = document.getElementById('record-speed-presets');
        if (!box) return;
        box.innerHTML = '';
        var saved = 2000;
        try { saved = parseInt(localStorage.getItem('xiangqiRecordSpeed'), 10) || 2000; } catch (e) {}
        if (recordPlayer) recordPlayer.setSpeed(saved);
        SPEED_PRESETS.forEach(function(p) {
            var b = document.createElement('button');
            b.className = 'speed-btn' + (p.ms === saved ? ' active' : '');
            b.textContent = p.label;
            b.setAttribute('aria-label', '每步之间停 ' + p.label);
            b.addEventListener('click', function() {
                if (recordPlayer) recordPlayer.setSpeed(p.ms);
                try { localStorage.setItem('xiangqiRecordSpeed', String(p.ms)); } catch (e2) {}
                var all = box.querySelectorAll('.speed-btn');
                for (var i = 0; i < all.length; i++) all[i].className = 'speed-btn';
                b.className = 'speed-btn active';
                speak('每步之间停' + p.label);
            });
            box.appendChild(b);
        });
    }

    // 语音自检
    function testTts() {
        forceRetestTts();
        speak('语音测试，如果能听到这句话，说明语音播报正常').then(function () {
            if (voiceEngine === 'pack') {
                showMessage('正在使用离线语音包（断网也能播报）', 3000);
            } else if (voiceEngine === 'online' && !onlineDead) {
                showMessage(ttsProxyAvailable ? '正在使用在线语音（服务器代理）' : '正在使用在线语音', 3000);
            } else if (voiceEngine === 'local' || ttsWorking) {
                showMessage('正在使用本机语音播报', 3000);
            } else if (voiceEngine === 'beep' || (localDead && onlineDead)) {
                showMessage('此浏览器语音不可用：本机无中文引擎，直连在线语音被拦截。请在电脑上双击"启动服务器.bat"，手机连同一WiFi访问弹出的地址，即有语音', 8000);
                playNotifySound();
            } else {
                showMessage('本浏览器没有中文语音引擎，已自动改用在线语音', 4000);
            }
        });
    }

    function openRecordModal() {
        document.getElementById('record-modal').style.display = 'flex';
        syncListenBar(); // 弹窗开着时隐藏悬浮条（控制都在弹窗里）
        buildGameLists();
        // 已经载入棋谱（比如播放中关掉弹窗又打开）：直接显示控制按钮，不重置
        if (recordPlayer && recordPlayer.moves.length > 0) {
            document.getElementById('record-info').style.display = 'block';
            document.getElementById('record-input-area').style.display = 'none';
            document.getElementById('record-controls').style.display = 'flex';
            syncRecordView();
            speak('棋谱回放，当前第' + recordPlayer.current + '步，共' + recordPlayer.moves.length + '步');
            return;
        }
        document.getElementById('record-info').style.display = 'none';
        document.getElementById('record-controls').style.display = 'none';
        document.getElementById('record-input-area').style.display = 'flex';
        document.getElementById('record-text').value = '';
        var nBuiltin = (typeof BUILTIN_GAMES !== 'undefined') ? BUILTIN_GAMES.length : 0;
        var nSaved = getSavedGames().length;
        speak('棋谱回放。内置棋谱' + nBuiltin + '盘' +
              (nSaved > 0 ? '，我的棋谱' + nSaved + '盘' : '') +
              '。点击棋谱名称即可播放。');
    }

    // ========== 棋谱库（内置 + 自动保存） ==========
    function getSavedGames() {
        try {
            var raw = localStorage.getItem('xiangqiSavedGames');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    function saveGamesList(list) {
        try { localStorage.setItem('xiangqiSavedGames', JSON.stringify(list.slice(0, 50))); } catch (e) {}
    }

    // 生成一个棋谱按钮（deletable 为 true 时附带删除按钮）
    function makeGameButton(name, text, steps, deletable) {
        var wrap = document.createElement('div');
        wrap.className = 'game-item';

        var btn = document.createElement('button');
        btn.className = 'game-btn';
        btn.textContent = steps ? (name + ' ' + steps + '步') : name;
        btn.setAttribute('aria-label', '播放棋谱：' + name);
        btn.addEventListener('click', function() {
            loadGameToPlay(name, text);
        });
        wrap.appendChild(btn);

        if (deletable) {
            var del = document.createElement('button');
            del.className = 'game-del';
            del.textContent = '删';
            del.setAttribute('aria-label', '删除棋谱：' + name);
            del.addEventListener('click', function() {
                var saved = getSavedGames().filter(function(g) {
                    return !(g.name === name && g.text === text);
                });
                saveGamesList(saved);
                buildGameLists();
                speak('已删除 ' + name);
            });
            wrap.appendChild(del);
        }
        return wrap;
    }

    // 构建内置棋谱和我的棋谱列表
    function buildGameLists() {
        var builtinEl = document.getElementById('builtin-games-list');
        var savedEl = document.getElementById('saved-games-list');
        var savedTitle = document.getElementById('saved-games-title');
        if (!builtinEl || !savedEl) return;

        builtinEl.innerHTML = '';
        if (typeof BUILTIN_GAMES !== 'undefined' && BUILTIN_GAMES.length) {
            BUILTIN_GAMES.forEach(function(g) {
                builtinEl.appendChild(makeGameButton(g.name, g.text, 0, false));
            });
        }

        var saved = getSavedGames();
        savedEl.innerHTML = '';
        if (saved.length) {
            savedTitle.style.display = '';
            saved.forEach(function(g) {
                savedEl.appendChild(makeGameButton(g.name, g.text, g.steps || 0, true));
            });
        } else {
            savedTitle.style.display = 'none';
        }
    }

    // 从棋谱库点选加载：解析成功后立刻开始播放并收起弹窗（盲听优先）
    var pendingGameName = null;
    function loadGameToPlay(name, text) {
        pendingGameName = name;
        document.getElementById('record-text').value = text;
        handleRecordParse(true);
    }

    // 从棋谱文本推断名称（优先用 PGN 的 Event 头）
    function deriveGameName(text) {
        var m = text.match(/\[Event\s+"([^"]*)"\]/);
        if (m && m[1].trim()) return m[1].trim();
        var d = new Date();
        return '导入棋谱 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }

    // 导入的棋谱自动保存到"我的棋谱"（内置棋谱不重复保存）
    function autoSaveGame(text, total) {
        try {
            if (typeof BUILTIN_GAMES !== 'undefined') {
                for (var i = 0; i < BUILTIN_GAMES.length; i++) {
                    if (BUILTIN_GAMES[i].text === text) return;
                }
            }
            var saved = getSavedGames();
            for (var j = 0; j < saved.length; j++) {
                if (saved[j].text === text) return; // 已经保存过
            }
            var name = deriveGameName(text);
            var base = name, k = 2;
            while (saved.some(function(g) { return g.name === name; })) {
                name = base + '（' + k + '）';
                k++;
            }
            saved.unshift({ name: name, text: text, steps: total });
            saveGamesList(saved);
            buildGameLists();
        } catch (e) {}
    }

    // keepPlaying=true 时收起弹窗但继续播放（盲听时关掉弹窗也能听、还能看棋盘）
    function closeRecordModal(keepPlaying) {
        if (recordPlayer && !keepPlaying) {
            recordPlayer.stop();
        }
        document.getElementById('record-modal').style.display = 'none';
        syncListenBar(); // 收起弹窗后：棋谱还在就显示悬浮控制条
        // 弹窗遮住棋盘期间画布不刷新，收起后重画一次，保证棋盘正常显示
        try { resizeCanvas(); drawBoard(); } catch (e) {}
    }

    function handleRecordParse(autoPlay) {
        var text = document.getElementById('record-text').value.trim();
        if (!text) {
            showMessage('请先输入棋谱内容', 2000);
            return;
        }

        // 先开始新局（棋谱回放从初始局面开始）
        game.board = game.initBoard();
        game.currentPlayer = 'red';
        game.selectedPiece = null;
        game.moveHistory = [];
        game.round = 1;
        game.resetState();
        selectedPos = null;
        updateStatus();
        drawBoard();

        var result = recordPlayer.parse(text);
        var infoEl = document.getElementById('record-info');
        infoEl.style.display = 'block';

        if (result.total === 0) {
            infoEl.textContent = '未解析到有效走法，请检查棋谱格式';
            speak('未解析到有效走法');
            return;
        }

        var msg = pendingGameName
            ? (pendingGameName + '，共' + result.total + '步棋')
            : ('成功解析' + result.total + '步棋');
        pendingGameName = null;
        if (result.errors.length > 0) {
            msg += '，' + result.errors.length + '步有误';
            infoEl.textContent = msg + '：' + result.errors.slice(0, 3).join('；');
        } else {
            infoEl.textContent = msg;
        }
        speak(msg);

        // 导入的棋谱自动保存到"我的棋谱"，下次打开不用再导入
        autoSaveGame(text, result.total);

        // 显示控制按钮，隐藏输入区
        document.getElementById('record-input-area').style.display = 'none';
        document.getElementById('record-controls').style.display = 'flex';
        updateRecordUI(0, result.total);

        // 点选棋谱库：立刻开始听棋，并收起弹窗露出棋盘（听完要停下时再打开弹窗按暂停）
        if (autoPlay === true) {
            closeRecordModal(true); // true=保留播放，不打断
            setTimeout(function() {
                if (recordPlayer) {
                    recordPlayer.current = 0;
                    recordPlayer.play();
                    if (recordPlayer.playing) speak('开始播放，共' + result.total + '步');
                }
            }, 120);
        }
    }

    function updateRecordUI(current, total) {
        var info = document.getElementById('record-step-info');
        if (info) info.textContent = '第 ' + current + ' / ' + total + ' 步';
        var seek = document.getElementById('record-seek');
        if (seek) {
            if (parseInt(seek.max, 10) !== total) seek.max = String(total);
            seek.value = String(current);
            seek.setAttribute('aria-valuetext', '第' + current + '步，共' + total + '步');
        }
        syncListenBar();
    }

    // 听棋悬浮控制条：弹窗收起后仍浮在屏幕底部，随时能暂停/跳步/打开完整控制
    // （解决"选完棋谱弹窗自动收起后，找不到播放调整界面"的问题）
    function syncListenBar() {
        var bar = document.getElementById('listen-bar');
        if (!bar) return;
        // 浮在底部工具栏正上方，不挡住"新局/棋谱"等按钮
        var tb = document.getElementById('toolbar');
        var bottomPx = (tb && tb.offsetHeight ? tb.offsetHeight : 64) + 8;
        bar.style.bottom = 'calc(' + bottomPx + 'px + env(safe-area-inset-bottom, 0px))';
        var has = recordPlayer && recordPlayer.moves.length > 0;
        var modalOpen = document.getElementById('record-modal').style.display !== 'none' &&
                        document.getElementById('record-modal').style.display !== '';
        bar.style.display = (has && !modalOpen) ? 'flex' : 'none';
        var t = document.getElementById('lb-toggle');
        if (t) t.textContent = (recordPlayer && recordPlayer.playing) ? '⏸' : '▶';
        var li = document.getElementById('lb-info');
        if (li && has) li.textContent = '第 ' + recordPlayer.current + ' / ' + recordPlayer.moves.length + ' 步';
    }

    // 初始化
    function init() {
        try { resizeCanvas(); } catch(e) {}
        try { drawBoard(); } catch(e) {}
        try { setupEventListeners(); } catch(e) {}
        try { setupListTouchEvents(); } catch(e) {}
        try { setupRecordPlayer(); } catch(e) {}
        // 状态栏版本号：点击查看当前版本与更新记录（用于确认手机上跑的是不是新版）
        try {
            var vEl = document.getElementById('version-info');
            if (vEl) {
                vEl.textContent = 'v' + APP_VERSION;
                vEl.addEventListener('click', function() {
                    showMessage('当前版本 v' + APP_VERSION + '（' + APP_VERSION_DATE + '）\n' +
                                APP_UPDATE_NOTES.join('；'), 6000);
                });
            }
            console.log('西尔象棋盲棋 v' + APP_VERSION);
        } catch(e) {}
        // 首次触摸/点击解锁 Web Audio（语音包拼接播放用；否则第一下点击前是静音的）
        try {
            var unlockPackAudio = function () {
                var c = getPackCtx();
                if (c && c.state === 'suspended') { try { c.resume(); } catch (e2) {} }
            };
            document.addEventListener('touchend', unlockPackAudio, { passive: true });
            document.addEventListener('click', unlockPackAudio);
        } catch(e) {}
        speak('西尔象棋盲棋已启动，红方先行');
    }

    // 调整画布大小
    function resizeCanvas() {
        const container = document.getElementById('board-container');
        const maxWidth = container.clientWidth - 20;
        const maxHeight = container.clientHeight - 20;

        const cellSize = Math.min(
            (maxWidth - BOARD_CONFIG.padding * 2) / (BOARD_CONFIG.cols - 1),
            (maxHeight - BOARD_CONFIG.padding * 2) / (BOARD_CONFIG.rows - 1)
        );

        BOARD_CONFIG.cellSize = cellSize;
        canvas.width = cellSize * (BOARD_CONFIG.cols - 1) + BOARD_CONFIG.padding * 2;
        canvas.height = cellSize * (BOARD_CONFIG.rows - 1) + BOARD_CONFIG.padding * 2;
    }

    // 绘制棋盘
    function drawBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;

        const { padding, cellSize } = BOARD_CONFIG;

        // 横线
        for (let i = 0; i < BOARD_CONFIG.rows; i++) {
            ctx.beginPath();
            ctx.moveTo(padding, padding + i * cellSize);
            ctx.lineTo(padding + (BOARD_CONFIG.cols - 1) * cellSize, padding + i * cellSize);
            ctx.stroke();
        }

        // 竖线
        for (let i = 0; i < BOARD_CONFIG.cols; i++) {
            if (i === 0 || i === BOARD_CONFIG.cols - 1) {
                ctx.beginPath();
                ctx.moveTo(padding + i * cellSize, padding);
                ctx.lineTo(padding + i * cellSize, padding + (BOARD_CONFIG.rows - 1) * cellSize);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(padding + i * cellSize, padding);
                ctx.lineTo(padding + i * cellSize, padding + 4 * cellSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(padding + i * cellSize, padding + 5 * cellSize);
                ctx.lineTo(padding + i * cellSize, padding + (BOARD_CONFIG.rows - 1) * cellSize);
                ctx.stroke();
            }
        }

        // 九宫格斜线
        ctx.beginPath();
        ctx.moveTo(padding + 3 * cellSize, padding);
        ctx.lineTo(padding + 5 * cellSize, padding + 2 * cellSize);
        ctx.moveTo(padding + 5 * cellSize, padding);
        ctx.lineTo(padding + 3 * cellSize, padding + 2 * cellSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(padding + 3 * cellSize, padding + 7 * cellSize);
        ctx.lineTo(padding + 5 * cellSize, padding + 9 * cellSize);
        ctx.moveTo(padding + 5 * cellSize, padding + 7 * cellSize);
        ctx.lineTo(padding + 3 * cellSize, padding + 9 * cellSize);
        ctx.stroke();

        // 楚河汉界
        ctx.fillStyle = '#888';
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('楚 河', padding + 2 * cellSize, padding + 4.5 * cellSize);
        ctx.fillText('汉 界', padding + 6 * cellSize, padding + 4.5 * cellSize);

        drawPieces();

        if (selectedPos) {
            drawSelection(selectedPos.row, selectedPos.col);
        }

        // 游戏结束时显示半透明遮罩
        if (game.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 28px serif';
            ctx.textAlign = 'center';
            const winnerText = game.winner === 'red' ? '红方获胜！' : '黑方获胜！';
            ctx.fillText(winnerText, canvas.width / 2, canvas.height / 2);
        }
    }

    // 绘制棋子
    function drawPieces() {
        const { padding, cellSize } = BOARD_CONFIG;

        for (let r = 0; r < BOARD_CONFIG.rows; r++) {
            for (let c = 0; c < BOARD_CONFIG.cols; c++) {
                const piece = game.getPiece(r, c);
                if (piece) {
                    const x = padding + c * cellSize;
                    const y = padding + r * cellSize;
                    drawPiece(x, y, piece);
                }
            }
        }
    }

    // 绘制单个棋子
    function drawPiece(x, y, piece) {
        const radius = BOARD_CONFIG.cellSize * 0.4;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = piece.color === 'red' ? '#8b0000' : '#1a1a1a';
        ctx.fill();

        ctx.strokeStyle = piece.color === 'red' ? '#ff6b6b' : '#666';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = piece.color === 'red' ? '#fff' : '#ccc';
        ctx.font = 'bold 18px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(piece.name, x, y);
    }

    // 绘制选中高亮
    function drawSelection(row, col) {
        const { padding, cellSize } = BOARD_CONFIG;
        const x = padding + col * cellSize;
        const y = padding + row * cellSize;
        const radius = cellSize * 0.45;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // 坐标转换
    function screenToBoard(x, y) {
        const rect = canvas.getBoundingClientRect();
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;

        const { padding, cellSize } = BOARD_CONFIG;
        const col = Math.round((canvasX - padding) / cellSize);
        const row = Math.round((canvasY - padding) / cellSize);

        if (row >= 0 && row < BOARD_CONFIG.rows && col >= 0 && col < BOARD_CONFIG.cols) {
            return { row, col };
        }
        return null;
    }

    // 触摸事件处理
    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        touchStart = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        if (!touchStart) return;

        const touch = e.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        const dx = endX - touchStart.x;
        const dy = endY - touchStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = Date.now() - touchStart.time;

        if (distance < 10 && duration < 300) {
            const pos = screenToBoard(touchStart.x, touchStart.y);
            if (pos) {
                handleTap(pos.row, pos.col);
            }
        }
        else if (distance > 30 && selectedPos) {
            handleSwipe(dx, dy);
        }

        touchStart = null;
    }

    // 处理点击
    function handleTap(row, col) {
        // 游戏结束后不允许操作
        if (game.gameOver) {
            speak('游戏已结束，请点击新局重新开始');
            return;
        }

        const piece = game.getPiece(row, col);

        if (selectedPos) {
            const result = game.movePiece(row, col);
            if (result.success) {
                handleMoveResult(result);

                // ========== 关键修复：处理游戏结束 ==========
                if (result.gameOver) {
                    handleGameOver(result.winner);
                    return;
                }

                // AI 走棋
                if (gameMode === 'pve' && game.currentPlayer === 'black') {
                    setTimeout(triggerAIMove, 500);
                }
            } else {
                if (piece && piece.color === game.currentPlayer) {
                    selectPieceAt(row, col);
                } else {
                    playErrorSound();
                    speak(result.message);
                }
            }
        }
        else if (piece && piece.color === game.currentPlayer) {
            selectPieceAt(row, col);
        }
    }

    // 选中棋子
    function selectPieceAt(row, col) {
        const result = game.selectPiece(row, col);
        if (result.success) {
            selectedPos = { row, col };
            speak(result.message);
            drawBoard();
        } else {
            speak(result.message);
        }
    }

    // 处理滑动
    function handleSwipe(dx, dy) {
        if (!selectedPos || game.gameOver) return;

        const { row, col } = selectedPos;
        let targetRow = row;
        let targetCol = col;

        if (Math.abs(dx) > Math.abs(dy)) {
            targetCol = col + (dx > 0 ? 1 : -1);
        } else {
            targetRow = row + (dy > 0 ? 1 : -1);
        }

        const result = game.movePiece(targetRow, targetCol);
        if (result.success) {
            handleMoveResult(result);

            if (result.gameOver) {
                handleGameOver(result.winner);
                return;
            }

            if (gameMode === 'pve' && game.currentPlayer === 'black') {
                setTimeout(triggerAIMove, 500);
            }
        } else {
            playErrorSound();
            speak('不能这样走');
        }
    }

    // ========== 统一处理走棋结果 ==========
    function handleMoveResult(result) {
        if (result.message.includes('吃掉')) {
            playCaptureSound();
        } else {
            playMoveSound();
        }

        speak(result.message);
        lastSpokenMessage = result.message; // 修复：更新最后播报内容
        selectedPos = null;
        updateStatus();
        drawBoard();
    }

    // ========== 关键修复：处理游戏结束 ==========
    function handleGameOver(winner) {
        const winnerName = winner === 'red' ? '红方' : '黑方';
        updateStatus();
        drawBoard();

        setTimeout(function() {
            playWinSound();
            speak(winnerName + '获胜！游戏结束。点击新局可重新开始。');
            lastSpokenMessage = winnerName + '获胜！游戏结束。';

            // 停止语音识别
            if (isListening) {
                stopVoiceRecognition();
            }
        }, 1000);
    }

    // ========== 语音播报 ==========
    // 双引擎方案（与围棋听棋页同源）：
    //   1) 设备自带的 speechSynthesis（离线、响应快，电脑和多数手机可用）
    //   2) 设备没有中文语音引擎时，自动切换"百度在线语音"
    //   3) 在线也连不上（断网）时，退回"嘀嘀"提示音 + 屏幕文字
    // 注意：有些手机浏览器（如华为自带浏览器、微信内置浏览器）没有中文语音引擎，
    // 这就是"手机上没声音"的原因——现在会自动改用在线语音。
    var ttsWorking = false;   // 本地语音引擎是否真的出声了
    var ttsTested = false;    // 是否已测出结果
    var ttsFailCount = 0;     // 连续失败次数
    var ttsRetested = false;  // 是否已在用户交互后重测
    var voiceEngine = null;   // null=未确定, 'local'=本地可用, 'online'=在线语音, 'beep'=只能提示音
    var localDead = false;    // 本地引擎已判死（无声/无中文语音/连续报错）
    var onlineDead = false;   // 在线语音已判死（网络不通）
    var onlineAudio = null;   // 在线语音的 <audio> 元素

    // 在线语音来源自动检测（与围棋听棋页同一方案）：
    //   - 通过电脑上的"启动服务器.bat"访问时，服务器带 /tts 代理（手机实测可靠）
    //   - GitHub Pages 等静态托管没有代理 → 直连百度
    //     （手机浏览器直连会被百度反爬拦截，此时退回提示音——这是站点无法服务端转发的限制）
    var ttsProxyAvailable = null; // null=检测中, true=代理可用, false=无代理
    var localNoCallbackStrikes = 0; // 本地引擎"完全不回调"的次数
    (function detectTtsProxy() {
        if (location.protocol === 'file:') { ttsProxyAvailable = false; return; }
        fetch('/tts?text=' + encodeURIComponent('测'), { method: 'GET' })
            .then(function (r) {
                ttsProxyAvailable = r.ok &&
                    String(r.headers.get('Content-Type') || '').indexOf('audio') === 0;
            })
            .catch(function () { ttsProxyAvailable = false; });
    })();
    // 等代理检测结果出来（最多3秒）：第一条播报时通常已经测好
    function whenProxyKnown() {
        if (ttsProxyAvailable !== null) return Promise.resolve(ttsProxyAvailable);
        return new Promise(function (resolve) {
            var t0 = Date.now();
            (function check() {
                if (ttsProxyAvailable !== null) return resolve(ttsProxyAvailable);
                if (Date.now() - t0 > 3000) return resolve(false);
                setTimeout(check, 120);
            })();
        });
    }

    // 用户第一次触摸/点击后重测一次：
    // 浏览器要求"先有交互"才允许发声，加载时的第一次播报失败不算数
    (function () {
        var events = ['pointerdown', 'touchstart', 'click', 'keydown'];
        function rearm() {
            if (ttsRetested) return;
            ttsRetested = true;
            ttsTested = false;
            ttsWorking = false;
            ttsFailCount = 0;
            events.forEach(function (e) { window.removeEventListener(e, rearm); });
        }
        events.forEach(function (e) { window.addEventListener(e, rearm, { once: true }); });
    })();

    // 主动重新检测（"测试语音"按钮用）
    function forceRetestTts() {
        ttsRetested = true;
        ttsTested = false;
        ttsWorking = false;
        ttsFailCount = 0;
        voiceEngine = null;
        localDead = false;
        onlineDead = false;
    }

    // 这台设备有没有中文语音引擎？（null = 声音列表还没加载出来，不知道）
    function hasChineseVoice() {
        try {
            if (!synth) return false;
            var vs = synth.getVoices();
            if (!vs || !vs.length) return null;
            for (var i = 0; i < vs.length; i++) {
                if (/^zh/i.test(String(vs[i].lang || ''))) return true;
            }
            return false;
        } catch (e) { return false; }
    }

    // 百度在线语音接口（与围棋听棋页完全一致）
    // useProxy=true 时走本站 /tts 代理（电脑服务器转发，手机可靠）；否则直连百度
    function buildOnlineTtsUrl(text, useProxy) {
        var enc = encodeURIComponent(text);
        if (useProxy) return '/tts?text=' + enc;
        return 'https://fanyi.baidu.com/gettts?lan=zh&text=' + enc +
               '&spd=5&pit=5&vol=9&per=0';
    }

    // 用在线语音播一句话，返回 Promise（播完/失败/超时后结束）
    function speakOnline(text, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            whenProxyKnown().then(function (useProxy) {
                try {
                    if (!onlineAudio) {
                        onlineAudio = new Audio();
                        onlineAudio.preload = 'auto';
                        try { onlineAudio.referrerPolicy = 'no-referrer'; } catch (e) {}
                    }
                    var a = onlineAudio;
                    var done = false;
                    var timer = null;
                    function finish(ok) {
                        if (done) return;
                        done = true;
                        if (timer) { clearTimeout(timer); timer = null; }
                        if (ok) { onlineDead = false; voiceEngine = 'online'; }
                        resolve();
                    }
                    a.onended = function () { finish(true); };
                    a.onerror = function () {
                        onlineDead = true;
                        if (voiceEngine === 'online') voiceEngine = 'beep';
                        if (!opts.noBeep) playNotifySound();
                        finish(false);
                    };
                    // 兜底：网络太慢时不能把回放卡死，最多等 15 秒
                    timer = setTimeout(function () { finish(false); }, 15000);
                    a.src = buildOnlineTtsUrl(text, useProxy);
                    var p = a.play();
                    if (p && p.catch) p.catch(function () {
                        // 被浏览器拦住（音频还没解锁）不算判死：这次先不出声
                        finish(false);
                    });
                } catch (e) { resolve(); }
            });
        });
    }

    // 只能用提示音
    function speakBeep(opts) {
        if (!opts || !opts.noBeep) playNotifySound();
        return Promise.resolve();
    }

    // ========== 离线语音包（audio/ 目录预生成的 MP3，断网也能播报） ==========
    // 手机浏览器普遍没有中文语音引擎、直连在线语音又会被拦截，
    // 语音包把常用播报句和单字提前生成好，本地拼接播放 —— 完全不依赖网络。
    var packDead = false;   // 包不可用（缺文件等）时置 true，走旧引擎链
    var packAudio = null;   // 顺序播放用的 Audio 元素
    var packSeq = 0;        // 序号：新播报开始后，旧序列立即作废

    // 阿拉伯数字转中文（0-999，用于拼"第10步""第3回合"等）
    function numToCn(n) {
        if (!isFinite(n) || n < 0 || n > 999) return null;
        n = Math.round(n);
        if (n === 0) return '零';
        var D = '零一二三四五六七八九';
        var out = '';
        if (n >= 100) { out += D[Math.floor(n / 100)] + '百'; n %= 100; if (n > 0 && n < 10) out += '零'; }
        if (n >= 10) { var t = Math.floor(n / 10); if (t > 1) out += D[t]; out += '十'; n %= 10; }
        if (n > 0) out += D[n];
        return out || null;
    }

    // 把一句话解析成语音包文件序列：['audio/xxx.mp3', 260(停顿ms), ...]
    // 拼不出来（含包外文字）返回 null，交给本地/在线引擎
    function packResolve(text) {
        var pack = window.XIER_AUDIO_PACK;
        if (!pack) return null;
        var base = pack.base || 'audio/';
        // 1) 整句完全匹配（提示语等，语气最自然）
        if (pack.phrases && pack.phrases[text]) return [base + pack.phrases[text]];
        // 2) 最长词优先分词 + 单字拼接（棋步播报，如 红方|炮|二|平|五）
        var words = pack.words ? Object.keys(pack.words).sort(function (a, b) { return b.length - a.length; }) : [];
        var seq = [];
        var i = 0;
        while (i < text.length) {
            var ch = text.charAt(i);
            // 数字串（含全角）→ 中文数字
            if ((ch >= '0' && ch <= '9') || (ch >= '０' && ch <= '９')) {
                var num = 0;
                while (i < text.length) {
                    var d = text.charAt(i);
                    if (d >= '０' && d <= '９') d = String.fromCharCode(d.charCodeAt(0) - 0xFEE0);
                    if (d < '0' || d > '9') break;
                    num = num * 10 + (d.charCodeAt(0) - 48);
                    i++;
                }
                var cn = numToCn(num);
                if (!cn) return null;
                for (var k = 0; k < cn.length; k++) {
                    if (!pack.chars || !pack.chars[cn.charAt(k)]) return null;
                    seq.push(base + pack.chars[cn.charAt(k)]);
                }
                continue;
            }
            // 标点/空格 → 停顿
            if ('，。！？：、；·（）() '.indexOf(ch) >= 0) { seq.push(ch === ' ' ? 140 : 260); i++; continue; }
            // 常用词（红方/黑方/吃掉/将军！...）
            var matched = false;
            for (var w = 0; w < words.length; w++) {
                if (text.startsWith(words[w], i)) {
                    seq.push(base + pack.words[words[w]]);
                    i += words[w].length;
                    matched = true;
                    break;
                }
            }
            if (matched) continue;
            // 单字
            if (pack.chars && pack.chars[ch]) { seq.push(base + pack.chars[ch]); i++; continue; }
            // 包外文字（英文/生僻字等）→ 交给本地/在线引擎
            return null;
        }
        return seq.length ? seq : null;
    }

    // 顺序播放文件序列，返回 Promise（播完/被打断/出错时结束）
    // 优先 Web Audio：把整句话裁掉每段首尾静音后拼成一个音频一次性播放，
    // 字与字之间只有约60毫秒间隔 —— 听起来是正常说话的节奏（不会逐字拖长）
    function speakPackSeq(seq) {
        // 新播报开始：先停掉正在播的（onended保留，让旧Promise正常结束）
        if (packSrcNode) { try { packSrcNode.stop(); } catch (e) {} packSrcNode = null; }
        packAudioStop();
        return speakPackWebAudio(seq).then(function (played) {
            if (played) return;
            return speakPackChain(seq); // 兜底：<audio> 逐段播放
        });
    }

    // ---- Web Audio 拼接播放 ----
    var packCtx = null;        // AudioContext
    var packBufCache = {};     // url -> Promise<AudioBuffer>
    var packSrcNode = null;    // 当前播放的音源

    function getPackCtx() {
        if (packCtx) return packCtx;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) packCtx = new AC();
        } catch (e) { packCtx = null; }
        return packCtx;
    }

    function loadPackBuffer(url) {
        if (!packBufCache[url]) {
            packBufCache[url] = fetch(url).then(function (r) {
                if (!r.ok) throw new Error('http ' + r.status);
                return r.arrayBuffer();
            }).then(function (ab) {
                return new Promise(function (res, rej) {
                    getPackCtx().decodeAudioData(ab, res, rej);
                });
            });
        }
        return packBufCache[url];
    }

    // 裁掉录音首尾的静音（百度每段MP3首尾自带约0.2~0.3秒静音，不裁字与字之间会拖长）
    function trimPackBuffer(buf) {
        try {
            var ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
            var c, i, d, peak = 0;
            d = buf.getChannelData(0);
            for (i = 0; i < len; i += 3) {
                var v = Math.abs(d[i]);
                if (v > peak) peak = v;
            }
            // 阈值=峰值的1.5%（下限0.002）：裁掉静音但绝不切掉
            // "七/车/一/九/兵/卒"这类轻声母的字头（声母音量小，阈值高了会切掉导致不清）
            var thresh = Math.max(0.002, peak * 0.015);
            var start = -1, end = -1;
            for (i = 0; i < len && start < 0; i++) {
                for (c = 0; c < ch; c++) {
                    d = buf.getChannelData(c);
                    if (Math.abs(d[i]) > thresh) { start = i; break; }
                }
            }
            if (start < 0) return buf;               // 整段静音：原样返回
            for (i = len - 1; i > start && end < 0; i--) {
                for (c = 0; c < ch; c++) {
                    d = buf.getChannelData(c);
                    if (Math.abs(d[i]) > thresh) { end = i; break; }
                }
            }
            // 字头留50ms、字尾留80ms余韵：保留声母和韵尾，听感自然
            start = Math.max(0, start - Math.floor(sr * 0.05));
            end = Math.min(len - 1, end + Math.floor(sr * 0.08));
            var n = end - start + 1;
            if (n >= len || n <= 0) return buf;
            var out = getPackCtx().createBuffer(1, n, sr);
            out.getChannelData(0).set(buf.getChannelData(0).subarray(start, end + 1));
            return out;
        } catch (e) { return buf; }
    }

    // seq: ['audio/x.mp3', 260, 'audio/y.mp3', ...]（数字=停顿毫秒）
    // 返回 Promise<true>=已用WebAudio播出（含被打断），<false>=不可用需走兜底
    function speakPackWebAudio(seq) {
        return new Promise(function (resolve) {
            var ctx = getPackCtx();
            if (!ctx) return resolve(false);
            // 同步登记序号：必须在任何异步操作之前！
            // 否则两条播报重叠时（如"成功解析48步"还没播完、下一步棋已开始），
            // 旧播报解码完后会误认为自己最新而同时播出——两个声音叠加就是"语音不清"
            var mySeq = ++packSeq;
            var urls = [];
            for (var i = 0; i < seq.length; i++) if (typeof seq[i] === 'string') urls.push(seq[i]);
            Promise.all(urls.map(loadPackBuffer)).then(function (bufs) {
                try {
                    var sr = ctx.sampleRate, k = 0;
                    // 段落序列：{buf} 或 {ms}
                    var segs = [];
                    for (var j = 0; j < seq.length; j++) {
                        if (typeof seq[j] === 'number') segs.push({ ms: seq[j] });
                        else segs.push({ buf: trimPackBuffer(bufs[k++] || bufs[0]) });
                    }
                    // 计算总时长（两个读音段之间默认留 60ms）
                    var pos = 0, prevBuf = false, schedule = [];
                    for (j = 0; j < segs.length; j++) {
                        var s = segs[j];
                        if (s.buf) {
                            if (prevBuf) pos += Math.floor(sr * 0.06);
                            schedule.push({ buf: s.buf, at: pos });
                            pos += s.buf.length;
                            prevBuf = true;
                        } else { pos += Math.floor(sr * s.ms / 1000); prevBuf = false; }
                    }
                    if (pos <= 0) return resolve(false);
                    var outBuf = ctx.createBuffer(1, pos, sr);
                    var od = outBuf.getChannelData(0);
                    for (j = 0; j < schedule.length; j++) {
                        od.set(schedule[j].buf.getChannelData(0), schedule[j].at);
                    }
                    // 播放（可能被浏览器自动播放策略拦住：此时静默结束，不算包坏了）
                    var settled = false;
                    function done(playedOk) {
                        if (settled) return;
                        settled = true;
                        if (playedOk && mySeq === packSeq) voiceEngine = 'pack';
                        resolve(playedOk);
                    }
                    function tryPlay() {
                        if (mySeq !== packSeq) return done(true); // 被新播报取代
                        if (ctx.state !== 'running') return done(false);
                        try {
                            if (packSrcNode) { try { packSrcNode.stop(); } catch (e2) {} } // 防叠音
                            var node = ctx.createBufferSource();
                            node.buffer = outBuf;
                            node.connect(ctx.destination);
                            node.onended = function () { if (packSrcNode === node) packSrcNode = null; done(true); };
                            packSrcNode = node;
                            node.start();
                        } catch (e) { done(false); }
                    }
                    if (ctx.state === 'suspended') {
                        var t = setTimeout(function () { done(false); }, 400); // 没解锁：不卡回放
                        ctx.resume().then(function () { clearTimeout(t); tryPlay(); },
                                          function () { clearTimeout(t); done(false); });
                    } else tryPlay();
                } catch (e) { resolve(false); }
            }).catch(function () { resolve(false); }); // 文件取不到等：走兜底
        });
    }

    // 停掉兜底用的 <audio>
    function packAudioStop() {
        if (packAudio) { try { packAudio.pause(); packAudio.onended = null; } catch (e) {} }
    }

    // 兜底：<audio> 逐段顺序播放（Web Audio 不可用时）
    function speakPackChain(seq) {
        return new Promise(function (resolve) {
            if (!packAudio) {
                packAudio = new Audio();
                packAudio.preload = 'auto';
            }
            var a = packAudio;
            var mySeq = ++packSeq;
            var idx = 0;
            function step() {
                if (mySeq !== packSeq) return resolve(); // 被新播报取代
                if (idx >= seq.length) { voiceEngine = 'pack'; return resolve(); }
                var item = seq[idx++];
                if (typeof item === 'number') return setTimeout(step, item); // 停顿
                a.onended = function () { a.onended = null; setTimeout(step, 60); };
                a.onerror = function () {
                    // 包里缺文件：标记后整体降级（之后走本地/在线/提示音）
                    packDead = true;
                    resolve();
                };
                a.src = item;
                var p = a.play();
                if (p && p.catch) p.catch(function () {
                    // 自动播放被浏览器拦（还没解锁）：本次不出声，不算包坏了
                    packSeq++;
                    resolve();
                });
            }
            step();
        });
    }

    // 语音播报（同时显示可见文字）
    // 返回 Promise：这一句播完（或确定播不了）时结束 —— 棋谱回放靠它"播完一句再走一步"
    function speak(text, opts) {
        opts = opts || {};
        if (typeof text !== 'string' || !text) return Promise.resolve();
        showMessage(text);

        // 已确认在用离线语音包：继续用包（稳定、断网可用）
        if (voiceEngine === 'pack' && !packDead) {
            var keepFiles = packResolve(text);
            if (keepFiles) return speakPackSeq(keepFiles, opts);
        }

        // 本机没有可用的中文语音（大多数手机浏览器）→ 离线语音包优先于在线
        // （包内文件由 Service Worker 预缓存，彻底断网也能正常播报）
        if (!packDead && hasChineseVoice() !== true) {
            var packFiles = packResolve(text);
            if (packFiles) return speakPackSeq(packFiles, opts);
        }

        // 已确认在线语音可用：直接在线播
        if (voiceEngine === 'online' && !onlineDead) return speakOnline(text, opts);

        // 两个引擎都确认不可用：提示音（点"测试语音"可重新检测）
        if (voiceEngine === 'beep') return speakBeep(opts);

        // 本地引擎不可用（判死过/接口不存在/确认无中文语音）：在线，不行就提示音
        if (localDead || !synth || typeof SpeechSynthesisUtterance === 'undefined' || hasChineseVoice() === false) {
            localDead = true;
            if (onlineDead) { voiceEngine = 'beep'; return speakBeep(opts); }
            return speakOnline(text, opts).then(function () {
                if (onlineDead) { voiceEngine = 'beep'; if (!opts.noBeep) playNotifySound(); }
            });
        }

        return new Promise(function (resolve) {
            var done = false;
            var timer = null;
            var started = false;
            var t0 = Date.now();
            function finish() {
                if (done) return;
                done = true;
                if (timer) { clearTimeout(timer); timer = null; }
                resolve();
            }
            // 本地引擎不行了：这一句转在线播，回放不中断
            function fallbackOnline() {
                localDead = true;
                resolve(speakOnline(text, opts).then(function () {
                    if (onlineDead) { voiceEngine = 'beep'; if (!opts.noBeep) playNotifySound(); }
                }));
            }

            var utter;
            try {
                utter = new SpeechSynthesisUtterance(text);
            } catch (e) {
                ttsTested = true; ttsWorking = false;
                fallbackOnline();
                return;
            }
            utter.lang = 'zh-CN';
            utter.rate = opts.rate || 1.0;
            utter.pitch = 1.0;

            utter.onstart = function () {
                started = true;
                ttsWorking = true; ttsTested = true; ttsFailCount = 0;
                localNoCallbackStrikes = 0;
                voiceEngine = 'local';
            };
            utter.onend = function () {
                if (utter._superseded) { finish(); return; }
                if (!started && !localDead && Date.now() - t0 < 500) {
                    // 没出声就"瞬间播完"：这台设备本地语音是坏的
                    // （常见于没装中文语音引擎的手机浏览器，表现为完全没声音）
                    fallbackOnline();
                    return;
                }
                ttsWorking = true; ttsTested = true; ttsFailCount = 0;
                localNoCallbackStrikes = 0;
                voiceEngine = 'local';
                finish();
            };
            utter.onerror = function () {
                // 被后一句主动取消的，不算"引擎坏了"
                if (utter._superseded) { finish(); return; }
                ttsFailCount++;
                if (ttsFailCount >= 2) {
                    ttsTested = true; ttsWorking = false;
                    fallbackOnline();
                    return;
                }
                if (!opts.noBeep) playNotifySound();
                finish();
            };

            if (currentUtterance) currentUtterance._superseded = true;
            currentUtterance = utter;

            // 关键修复：cancel() 之后立刻 speak()，部分安卓浏览器会静默无声，
            // 这里留 60 毫秒再播，声音就正常了。
            try { synth.cancel(); } catch (e2) {}
            setTimeout(function () {
                try {
                    synth.speak(utter);
                } catch (e3) {
                    fallbackOnline();
                    return;
                }
                // 兜底：引擎完全不回调时，按字数估算时间后继续，别把回放卡死。
                // 连续两次完全不回调 → 判定本地引擎不可靠，之后改用在线语音
                var est = Math.max(1200, text.length * 250);
                timer = setTimeout(function () {
                    if (done) return;
                    localNoCallbackStrikes++;
                    ttsTested = true;
                    if (localNoCallbackStrikes >= 2) localDead = true;
                    finish();
                }, est + 1500);
            }, 60);
        });
    }

    // 通知提示音（TTS不可用时的替代）
    function playNotifySound() {
        initAudioContext();
        if (!audioContext) return;
        // 两声清脆的"嘀嘀"
        [880, 1100].forEach(function(freq, i) {
            var osc = audioContext.createOscillator();
            var gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            var t = audioContext.currentTime + i * 0.12;
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        });
    }
    
    // （TTS 检测逻辑已在 speak() 内实现：见 ttsWorking / ttsFailCount）

    // 更新状态栏
    function updateStatus() {
        const turnEl = document.getElementById('turn-info');
        if (game.gameOver) {
            const winnerName = game.winner === 'red' ? '红方' : '黑方';
            turnEl.textContent = winnerName + '获胜！';
            turnEl.style.color = '#FFD700';
        } else {
            turnEl.textContent = game.currentPlayer === 'red' ? '红方走棋' : '黑方走棋';
            turnEl.style.color = '#ff6b6b';
        }
        document.getElementById('round-info').textContent = '第 ' + game.round + ' 回合';
    }

    // 设置事件监听
    function setupEventListeners() {
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        document.getElementById('btn-new').addEventListener('click', newGame);
        document.getElementById('btn-undo').addEventListener('click', undoMove);
        document.getElementById('btn-speak').addEventListener('click', speakBoard);
        document.getElementById('btn-repeat').addEventListener('click', repeatLast);
        document.getElementById('btn-help').addEventListener('click', showHelp);

        document.getElementById('btn-mode').addEventListener('click', toggleMode);
        document.getElementById('btn-voice').addEventListener('click', toggleVoice);
        document.getElementById('btn-list').addEventListener('click', toggleListMode);

        // 文字输入走棋
        var moveInput = document.getElementById('move-input');
        var btnSend = document.getElementById('btn-send');
        btnSend.addEventListener('click', handleTextInput);
        moveInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTextInput();
            }
        });

        window.addEventListener('resize', function() {
            resizeCanvas();
            drawBoard();
        });
    }

    // 文字输入走棋处理
    function handleTextInput() {
        var input = document.getElementById('move-input');
        var text = input.value.trim();
        if (!text) return;

        if (game.gameOver) {
            showMessage('游戏已结束，请点击新局重新开始', 3000);
            input.value = '';
            return;
        }

        var cmd = game.parseVoiceCommand(text);
        if (cmd) {
            var move = game.resolveVoiceMove(cmd);
            if (move && move.ambiguous) {
                playErrorSound();
                speak('这一列有多个相同棋子，请用前或后区分，例如前车2进3');
                return;
            }
            if (move) {
                var result = game.movePieceByCoords(move.fromRow, move.fromCol, move.toRow, move.toCol);
                if (result.success) {
                    handleMoveResult(result);
                    input.value = '';

                    if (result.gameOver) {
                        handleGameOver(result.winner);
                        return;
                    }

                    if (gameMode === 'pve' && game.currentPlayer === 'black') {
                        setTimeout(triggerAIMove, 500);
                    }
                } else {
                    playErrorSound();
                    speak(result.message);
                }
            } else {
                playErrorSound();
                speak('找不到能这样走的棋子，请检查棋谱');
            }
        } else {
            playErrorSound();
            speak('无法识别棋谱，请输入如炮2平5或炮二平五');
        }
    }

    // 新局
    function newGame() {
        // 新局：结束正在进行的棋谱听棋（否则旧棋谱会继续播报，和当前对局对不上）
        if (recordPlayer && (recordPlayer.playing || recordPlayer.moves.length > 0)) {
            recordPlayer.stop();
            recordPlayer.moves = [];
            recordPlayer.current = 0;
        }
        syncListenBar(); // 棋谱已清空：隐藏悬浮控制条
        game.board = game.initBoard();
        game.currentPlayer = 'red';
        game.selectedPiece = null;
        game.moveHistory = [];
        game.round = 1;
        game.resetState(); // 重置游戏结束状态
        selectedPos = null;
        updateStatus();
        drawBoard();
        speak('新局开始，红方先行');
        lastSpokenMessage = '新局开始，红方先行';
    }

    // 悔棋
    function undoMove() {
        const result = game.undo();
        if (result.success) {
            selectedPos = null;
            updateStatus();
            drawBoard();
            speak(result.message);
            lastSpokenMessage = result.message;
        } else {
            speak(result.message);
        }
    }

    // 播报局面
    function speakBoard() {
        const desc = game.describeBoard();
        speak(desc);
        lastSpokenMessage = desc;
    }

    // ========== 修复：重复播报使用追踪的最后消息 ==========
    function repeatLast() {
        speak(lastSpokenMessage);
    }

    // 帮助
    function showHelp() {
        const help = '操作说明：点击棋子选中，滑动走棋。输入或说出棋谱，如炮2平5或炮二平五，同列有相同棋子时加前或后，如前车2进3。列号1到9从自己右边向左数，行号0到9从自己向对方数，双方各以自己的右下角为基准。点击棋谱按钮可导入棋谱听棋。底部按钮：新局、悔棋、播报、重复、模式、语音、列表、棋谱、帮助。';
        speak(help);
        lastSpokenMessage = help;
    }

    // ========== 功能1：AI 对弈 ==========
    function toggleMode() {
        if (gameMode === 'pvp') {
            gameMode = 'pve';
            document.querySelector('#btn-mode .label').textContent = '人机';
            speak('已切换到人机对弈模式，您执红方');
        } else {
            gameMode = 'pvp';
            document.querySelector('#btn-mode .label').textContent = '双人';
            speak('已切换到双人对弈模式');
        }
        lastSpokenMessage = gameMode === 'pve' ? '人机对弈模式' : '双人对弈模式';
    }

    function triggerAIMove() {
        if (gameMode !== 'pve' || game.currentPlayer !== 'black' || game.gameOver) return;

        speak('AI思考中');
        setTimeout(function() {
            const bestMove = game.getBestMove('black');
            if (bestMove) {
                const result = game.movePieceByCoords(
                    bestMove.fromRow, bestMove.fromCol,
                    bestMove.toRow, bestMove.toCol
                );
                if (result.success) {
                    handleMoveResult(result);

                    if (result.gameOver) {
                        handleGameOver(result.winner);
                        return;
                    }
                }
            }
        }, 300);
    }

    // ========== 功能2：语音指令识别 ==========
    // ========== 修复：支持连续语音模式，盲人可持续下棋 ==========
    function toggleVoice() {
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showMessage('此浏览器不支持语音识别，请用Chrome浏览器', 5000);
            speak('您的浏览器不支持语音识别，请使用Chrome浏览器打开');
            return;
        }

        if (isListening) {
            stopVoiceRecognition();
        } else {
            voiceContinuous = true;
            startVoiceRecognition();
        }
    }

    function startVoiceRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = voiceContinuous; // 连续模式
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function() {
            isListening = true;
            document.querySelector('#btn-voice .label').textContent = '监听';
            document.querySelector('#btn-voice').style.borderColor = '#4CAF50';
            // 只在非连续模式下播报提示，连续模式下不播报（避免TTS干扰麦克风）
            if (!voiceContinuous) {
                speak('请说出棋谱，例如炮2平5');
            }
        };

        recognition.onresult = function(event) {
            const transcript = event.results[event.results.length - 1][0].transcript;
            // 连续模式下不播报"识别到"，避免TTS抢占音频通道导致麦克风中断
            if (!voiceContinuous) {
                speak('识别到：' + transcript);
            }

            const cmd = game.parseVoiceCommand(transcript);
            if (cmd) {
                const move = game.resolveVoiceMove(cmd);
                if (move && move.ambiguous) {
                    playErrorSound();
                    speak('这一列有多个相同棋子，请用前或后区分，例如前车2进3');
                } else if (move) {
                    const result = game.movePieceByCoords(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    if (result.success) {
                        handleMoveResult(result);

                        if (result.gameOver) {
                            handleGameOver(result.winner);
                            if (voiceContinuous) {
                                stopVoiceRecognition();
                            }
                            return;
                        }

                        if (gameMode === 'pve' && game.currentPlayer === 'black') {
                            setTimeout(triggerAIMove, 500);
                        }
                    } else {
                        playErrorSound();
                        speak(result.message);
                    }
                } else {
                    playErrorSound();
                    speak('找不到能这样走的棋子，请重新说棋谱');
                }
            } else {
                playErrorSound();
                speak('无法识别棋谱格式，请说如炮2平5或炮二平五');
            }
        };

        recognition.onerror = function(event) {
            // no-speech 和 aborted 是正常情况，不播报
            if (event.error === 'no-speech' || event.error === 'aborted') {
                return;
            }
            if (event.error === 'audio-capture') {
                speak('无法访问麦克风，请检查权限');
                stopVoiceRecognition();
                return;
            }
            if (event.error === 'not-allowed') {
                speak('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
                stopVoiceRecognition();
                return;
            }
            // 其他错误在连续模式下不播报，避免干扰
            if (!voiceContinuous) {
                speak('语音识别错误：' + event.error);
            }
            if (!voiceContinuous) {
                stopVoiceRecognition();
            }
        };

        recognition.onend = function() {
            // 连续模式下自动重启，但要等TTS播完再重启
            if (voiceContinuous && isListening && !game.gameOver) {
                // 等300ms让TTS有机会释放音频通道
                setTimeout(function() {
                    if (isListening && !game.gameOver) {
                        try {
                            recognition.start();
                        } catch (e) {
                            // 已经在运行，忽略
                        }
                    }
                }, 300);
            } else {
                stopVoiceRecognition();
            }
        };

        try {
            recognition.start();
        } catch (e) {
            speak('语音识别启动失败');
        }
    }

    function stopVoiceRecognition() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        isListening = false;
        voiceContinuous = false;
        document.querySelector('#btn-voice .label').textContent = '语音';
        document.querySelector('#btn-voice').style.borderColor = '#555';
    }

    // ========== 功能3：棋子列表模式 ==========
    // ========== 修复：显示双方所有棋子，盲人可了解全局 ==========
    function toggleListMode() {
        listMode = !listMode;
        const listContainer = document.getElementById('list-container');

        if (listMode) {
            document.querySelector('#btn-list .label').textContent = '棋盘';
            canvas.style.display = 'none';
            listContainer.style.display = 'block';
            initListMode();
            speak('已进入列表模式，显示双方所有棋子');
        } else {
            document.querySelector('#btn-list .label').textContent = '列表';
            listContainer.style.display = 'none';
            canvas.style.display = 'block';
            speak('已退出列表模式');
        }
    }

    function initListMode() {
        // 获取双方所有棋子
        listPieces = game.getAllPieces();
        listSelectedIndex = -1;
        renderList();
    }

    function renderList() {
        const listContainer = document.getElementById('list-container');
        let html = '<div class="list-header">棋盘全部棋子</div>';
        html += '<div class="list-grid">';

        listPieces.forEach(function(item, index) {
            var colorClass = item.piece.color === 'red' ? 'red-piece' : 'black-piece';
            var cls = 'list-piece ' + colorClass + (index === listSelectedIndex ? ' selected' : '');
            var sideName = item.piece.color === 'red' ? '红' : '黑';
            html += '<div class="' + cls + '" data-index="' + index + '">';
            html += '<div class="piece-name">' + sideName + item.piece.name + '</div>';
            var uCol = game.internalToUserCol(item.col, item.piece.color);
            var uRow = game.internalToUserRow(item.row, item.piece.color);
            html += '<div class="piece-pos">第' + uCol + '列第' + uRow + '行</div>';
            html += '</div>';
        });

        html += '</div>';
        html += '<p class="list-hint">点击棋子播报位置，滑动走棋</p>';

        listContainer.innerHTML = html;
    }

    function handleListPieceTap(index) {
        listSelectedIndex = index;
        var item = listPieces[index];
        var desc = game.describePiece(item.row, item.col, item.piece);
        speak(desc);
        lastSpokenMessage = desc;
        renderList();
    }

    // 列表模式下的触摸事件
    var listTouchStart = null;

    function setupListTouchEvents() {
        var listContainer = document.getElementById('list-container');

        listContainer.addEventListener('touchstart', function(e) {
            var target = e.target.closest('.list-piece');
            if (target) {
                var index = parseInt(target.getAttribute('data-index'), 10);
                handleListPieceTap(index);
                listTouchStart = null;
                return;
            }
            if (listSelectedIndex < 0) return;
            listTouchStart = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }, { passive: true });

        listContainer.addEventListener('touchend', function(e) {
            if (listSelectedIndex < 0 || !listTouchStart) return;

            var dx = e.changedTouches[0].clientX - listTouchStart.x;
            var dy = e.changedTouches[0].clientY - listTouchStart.y;
            var distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 30) {
                var item = listPieces[listSelectedIndex];
                // 只能走当前方的棋子
                if (item.piece.color !== game.currentPlayer) {
                    playErrorSound();
                    speak('只能走' + (game.currentPlayer === 'red' ? '红方' : '黑方') + '的棋子');
                    listTouchStart = null;
                    return;
                }

                var targetRow = item.row;
                var targetCol = item.col;

                if (Math.abs(dx) > Math.abs(dy)) {
                    targetCol = item.col + (dx > 0 ? 1 : -1);
                } else {
                    targetRow = item.row + (dy > 0 ? 1 : -1);
                }

                var result = game.movePieceByCoords(item.row, item.col, targetRow, targetCol);
                if (result.success) {
                    handleMoveResult(result);

                    if (result.gameOver) {
                        handleGameOver(result.winner);
                        listTouchStart = null;
                        return;
                    }

                    listSelectedIndex = -1;
                    updateStatus();

                    if (listMode) {
                        initListMode();
                    } else {
                        drawBoard();
                    }

                    if (gameMode === 'pve' && game.currentPlayer === 'black') {
                        setTimeout(triggerAIMove, 500);
                    }
                } else {
                    playErrorSound();
                    speak('不能这样走');
                }
            }

            listTouchStart = null;
        }, { passive: true });
    }

    // 启动
    init();
})();
