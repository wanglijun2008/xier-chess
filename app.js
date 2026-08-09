// 主应用逻辑
(function() {
    'use strict';

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
    let lastSpokenMessage = '西尔象棋盲棋已启动，红方先行'; // 修复：追踪最后播报内容

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

    // 初始化
    function init() {
        resizeCanvas();
        drawBoard();
        setupEventListeners();
        setupListTouchEvents();
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

    // 语音播报
    function speak(text) {
        if (currentUtterance) {
            synth.cancel();
        }

        currentUtterance = new SpeechSynthesisUtterance(text);
        currentUtterance.lang = 'zh-CN';
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;
        synth.speak(currentUtterance);
    }

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

        window.addEventListener('resize', function() {
            resizeCanvas();
            drawBoard();
        });
    }

    // 新局
    function newGame() {
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
        const help = '操作说明：点击棋子选中，滑动走棋。语音指令：点击语音按钮后说棋谱，如炮二平五。底部按钮：新局、悔棋、播报、重复、模式切换、语音指令、列表模式、帮助。';
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
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            speak('您的浏览器不支持语音识别');
            return;
        }

        if (isListening) {
            stopVoiceRecognition();
        } else {
            // 默认开启连续模式
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

        recognition.onstart = function() {
            isListening = true;
            document.querySelector('#btn-voice .label').textContent = '监听';
            document.querySelector('#btn-voice').style.borderColor = '#4CAF50';
            if (!voiceContinuous) {
                speak('请说出棋谱，例如炮二平五');
            } else {
                speak('语音指令已开启，请说出棋谱。例如炮二平五。说完一句后会自动继续监听。');
            }
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            speak('识别到：' + transcript);

            const cmd = game.parseVoiceCommand(transcript);
            if (cmd) {
                const move = game.resolveVoiceMove(cmd);
                if (move) {
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
                    speak('无法解析目标位置，请重新说棋谱');
                }
            } else {
                playErrorSound();
                speak('无法识别棋谱格式，请说如炮二平五');
            }
        };

        recognition.onerror = function(event) {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                speak('语音识别错误：' + event.error);
            }
            if (!voiceContinuous) {
                stopVoiceRecognition();
            }
        };

        recognition.onend = function() {
            // 连续模式下自动重启
            if (voiceContinuous && isListening && !game.gameOver) {
                try {
                    recognition.start();
                } catch (e) {
                    // 防止重复启动
                }
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
            html += '<div class="piece-pos">' + game.getColumnName(item.col, item.piece.color) + '路' + game.getRowName(item.row) + '线</div>';
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
