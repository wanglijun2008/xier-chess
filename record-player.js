// 棋谱导入与回放模块 v2（2026-10-06 重大修复）
// 修复内容：
//   1. 严格按棋谱"红先黑后"一一对应解析，不再猜测走棋方（修复串色、播报多余着法的问题）
//   2. 解析时在棋盘上实际推演每一步，保证每步坐标与棋谱完全一致
//   3. 自动过滤 PGN 头信息、{注释}、广告行、结果标记
//   4. 支持"前炮平五 / 后马进3 / 前车退一"等不带列号的着法
// 支持的棋谱格式：
//   1. 兵七进一 炮２平３      （每行一个回合：编号 + 红着 + 黑着）
//   兵七进一                   （每行一步）
//   1.兵七进一 炮2平3 2.马二进三  （一行多个回合也能正确拆分）

class ChessRecordPlayer {
    constructor(game, callbacks) {
        this.game = game;
        this.on = callbacks || {};
        this.moves = [];       // [{raw, fromRow, fromCol, toRow, toCol, color}]
        this.current = 0;
        this.playing = false;
        this.speed = 2000;     // 毫秒/步
        this.timer = null;
    }

    // 把棋盘恢复到初始局面
    _resetBoard() {
        while (this.game.moveHistory && this.game.moveHistory.length > 0) {
            this.game.undo();
        }
        this.game.currentPlayer = 'red';
        this.game.round = 1;
        this.game.gameOver = false;
        this.game.winner = null;
        this.game.selectedPiece = null;
    }

    // 解析棋谱文本，返回 { total, errors }
    // 核心原则：红方一步、黑方一步，严格与棋谱一一对应，直到棋局终了
    parse(text) {
        this.stop();
        this.moves = [];
        this.current = 0;

        // 从初始局面开始推演
        this._resetBoard();

        const errors = [];
        const moveList = this._extractMoves(text);

        let color = 'red'; // 红先
        for (let i = 0; i < moveList.length; i++) {
            const raw = moveList[i];
            const sideName = color === 'red' ? '红方' : '黑方';
            const stepNo = i + 1;

            const cmd = this.game.parseVoiceCommand(raw);
            let move = null;
            if (cmd) {
                // 强制按棋谱规定的走棋方解析，绝不"猜"
                this.game.currentPlayer = color;
                move = this.game.resolveVoiceMove(cmd);
            }

            if (move && !move.ambiguous) {
                // 在棋盘上实际走出这一步，保证后续着法坐标正确
                const res = this.game.movePieceByCoords(
                    move.fromRow, move.fromCol, move.toRow, move.toCol);
                if (res.success) {
                    this.moves.push({
                        raw: raw,
                        message: res.message, // 标准播报文本（拖动/快进后播报这一步用）
                        fromRow: move.fromRow,
                        fromCol: move.fromCol,
                        toRow: move.toRow,
                        toCol: move.toCol,
                        color: color
                    });
                    color = color === 'red' ? 'black' : 'red';
                    continue;
                }
                errors.push('第' + stepNo + '步 ' + sideName + '「' + raw + '」无法执行（' + res.message + '）');
            } else if (cmd) {
                errors.push('第' + stepNo + '步 ' + sideName + '「' + raw + '」无法确定棋子位置');
            } else {
                errors.push('第' + stepNo + '步 ' + sideName + '「' + raw + '」无法识别');
            }

            // 这一步没有走成，但红黑顺序仍按棋谱推进（保持一一对应）
            color = color === 'red' ? 'black' : 'red';
        }

        // 推演完毕，棋盘回到初始局面等待播放
        this._resetBoard();

        return { total: this.moves.length, errors: errors };
    }

    // 从文本中提取独立的走法列表（只保留真正的着法，过滤一切杂讯）
    _extractMoves(text) {
        const moves = [];
        const lines = text.split(/[\n\r]+/);

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line.charAt(0) === '[') continue;   // PGN 头信息
            if (line.charAt(0) === '*') continue;   // PGN 结束标记
            if (line.indexOf('官网') >= 0 || line.indexOf('助手') >= 0) continue; // 广告行

            line = line.replace(/\{[^}]*\}/g, ' '); // 去掉 {注释}

            // 去掉行首回合编号（1. / 1、 / 1) 等）
            line = line.replace(/^[0-9０-９]+\s*[\.．、\)\]]?\s*/, '');

            // 按空白和常见分隔符拆分
            const parts = line.split(/[\s;；,，]+/);
            for (let part of parts) {
                part = part.trim();
                if (!part) continue;
                // 去掉粘连的回合编号（如 "2.马二进三"）
                part = part.replace(/^[0-9０-９]+[\.．、\)\]]?/, '');
                // 去掉首尾杂符号
                part = part.replace(/^["'“”「『（(]+/, '')
                           .replace(/["'“”」』）)，。；、！？:\]】]+$/, '');
                if (!part) continue;
                if (this._looksLikeMove(part)) moves.push(part);
            }
        }

        return moves;
    }

    // 判断是否像一个着法：前/中/后? + 棋子名 + 列号? + 进/退/平 + 数字
    // 例：炮二平五、马8进7、前炮平五、后马进3、前车2进3、后炮退一、仕四进五
    _looksLikeMove(s) {
        return /^[前后中]?[帅将士仕象相马车炮兵卒][0-9０-９一二两三四五六七八九]?[进退平][0-9０-９一二两三四五六七八九]$/.test(s);
    }

    // 执行第 index 步（0-based）
    // silent=true 时不播报（拖动进度条/快进跳转时用，避免把中间的每一步都念一遍）
    playMove(index, silent) {
        if (index < 0 || index >= this.moves.length) return false;
        const m = this.moves[index];
        const result = this.game.movePieceByCoords(m.fromRow, m.fromCol, m.toRow, m.toCol);
        if (result.success) {
            this.current = index + 1;
            // on.move 若返回 Promise（表示这一句还没播完），自动播放会等它播完再计时
            this._pendingWait = null;
            if (this.on.move) {
                const r = this.on.move(m, result, index + 1, this.moves.length, false, !!silent);
                if (r && typeof r.then === 'function') this._pendingWait = r;
            }
            return true;
        }
        return false;
    }

    // 下一步
    next() {
        if (this.current < this.moves.length) {
            return this.playMove(this.current);
        }
        return false;
    }

    // 上一步（悔棋）
    prev() {
        if (this.current > 0) {
            const result = this.game.undo();
            if (result.success) {
                this.current--;
                if (this.on.move) {
                    const m = this.moves[this.current];
                    this.on.move(m, result, this.current, this.moves.length, true);
                }
                return true;
            }
        }
        return false;
    }

    // 跳到指定步（拖动进度条用）：静默推演，不逐步播报
    jumpTo(index) {
        this.stop();
        index = Math.max(0, Math.min(index, this.moves.length));
        if (index !== this.current) {
            // 先回到初始状态
            while (this.current > 0) {
                this.game.undo();
                this.current--;
            }
            // 静默走到目标
            for (let i = 0; i < index; i++) {
                if (!this.playMove(i, true)) break;
            }
        }
        if (this.on.seeked) this.on.seeked(this.current, this.moves.length);
    }

    // 快进/快退 n 步（n 为负数表示后退）
    skip(n) {
        const target = Math.max(0, Math.min(this.current + n, this.moves.length));
        const moved = target - this.current;
        this.jumpTo(target);
        return moved;
    }

    // 自动播放
    play() {
        if (this.moves.length === 0) return;
        if (this.current >= this.moves.length) {
            // 已到末尾，从头开始
            this.jumpTo(0);
        }
        this.playing = true;
        if (this.on.playState) this.on.playState(true);
        this._tick();
    }

    _tick() {
        if (!this.playing) return;
        if (this.current >= this.moves.length) {
            this.stop();
            if (this.on.finished) this.on.finished();
            return;
        }
        this.next();
        if (!this.playing) return;
        const self = this;
        const wait = this._pendingWait;
        this._pendingWait = null;
        // 先等这一句播报完（若语音可用），再停设定的间隔，然后走下一步。
        // 这样"2秒"就是"播完后再停2秒"，不会把话截断，跟摆时也不抢跑。
        const startNext = function () {
            if (!self.playing) return;
            self.timer = setTimeout(function () { self._tick(); }, self.speed);
        };
        if (wait && typeof wait.then === 'function') {
            wait.then(startNext, startNext);
        } else {
            startNext();
        }
    }

    // 暂停
    pause() {
        this.playing = false;
        this._pendingWait = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.on.playState) this.on.playState(false);
    }

    // 停止
    stop() {
        this.playing = false;
        this._pendingWait = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.on.playState) this.on.playState(false);
    }

    // 设置速度（毫秒/步，播完一句后再等这么久）
    setSpeed(ms) {
        ms = parseInt(ms, 10);
        if (isNaN(ms)) return;
        this.speed = Math.max(500, Math.min(600000, ms));
    }

    // 获取进度信息
    getProgress() {
        return {
            current: this.current,
            total: this.moves.length,
            playing: this.playing,
            speed: this.speed
        };
    }
}
