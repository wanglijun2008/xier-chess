// 棋谱导入与回放模块
// 支持格式：每行一步，如 炮2平5、马8进7、炮二平五、前车2进3
// 双方各以自己右下角为基准（列1-9右到左，行0-9下到上）

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

    // 解析棋谱文本，返回 { total, ok, errors }
    parse(text) {
        this.stop();
        this.moves = [];
        this.current = 0;

        // 按行分割，支持多种分隔符
        const lines = text.split(/[\n\r;；]+/).map(s => s.trim()).filter(Boolean);
        const errors = [];
        let color = 'red'; // 红先

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            // 跳过纯数字行（回合编号如 "1." "1、"）
            if (/^\d+[\.\、\)]?\s*$/.test(raw)) continue;
            // 跳过注释行
            if (raw.startsWith('#') || raw.startsWith('//')) continue;

            const cmd = this.game.parseVoiceCommand(raw);
            if (!cmd) {
                errors.push('第' + (this.moves.length + 1) + '步：无法识别「' + raw + '」');
                continue;
            }

            // 尝试当前走棋方解析
            let move = this.game.resolveVoiceMove(cmd);

            // 如果当前方无合法走法，尝试另一方（兼容传统棋谱格式）
            if (!move || move.ambiguous) {
                const origColor = this.game.currentPlayer;
                const otherColor = origColor === 'red' ? 'black' : 'red';
                // 临时切换
                this.game.currentPlayer = otherColor;
                const altMove = this.game.resolveVoiceMove(cmd);
                this.game.currentPlayer = origColor;
                if (altMove && !altMove.ambiguous) {
                    move = altMove;
                    color = otherColor;
                }
            }

            if (!move || move.ambiguous) {
                errors.push('第' + (this.moves.length + 1) + '步：无法执行「' + raw + '」');
                continue;
            }

            this.moves.push({
                raw: raw,
                fromRow: move.fromRow,
                fromCol: move.fromCol,
                toRow: move.toRow,
                toCol: move.toCol,
                color: color
            });

            // 切换走棋方
            color = color === 'red' ? 'black' : 'red';
        }

        return { total: this.moves.length, errors: errors };
    }

    // 执行第 index 步（0-based）
    playMove(index) {
        if (index < 0 || index >= this.moves.length) return false;
        const m = this.moves[index];
        const result = this.game.movePieceByCoords(m.fromRow, m.fromCol, m.toRow, m.toCol);
        if (result.success) {
            this.current = index + 1;
            if (this.on.move) this.on.move(m, result, index + 1, this.moves.length);
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

    // 跳到指定步
    jumpTo(index) {
        this.stop();
        // 先回到初始状态
        while (this.current > 0) {
            this.game.undo();
            this.current--;
        }
        // 逐步走到目标
        for (let i = 0; i < index && i < this.moves.length; i++) {
            if (!this.playMove(i)) break;
        }
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
        if (this.playing) {
            this.timer = setTimeout(() => this._tick(), this.speed);
        }
    }

    // 暂停
    pause() {
        this.playing = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.on.playState) this.on.playState(false);
    }

    // 停止
    stop() {
        this.playing = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.on.playState) this.on.playState(false);
    }

    // 设置速度（毫秒/步）
    setSpeed(ms) {
        this.speed = Math.max(500, Math.min(5000, ms));
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
