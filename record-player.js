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
    // 支持格式：
    //   1. 炮二平五 马8进7    （天天象棋/书谱：每行一个回合）
    //   炮2平5                 （每行一步）
    //   1.炮二平五
    //   马8进7
    parse(text) {
        this.stop();
        this.moves = [];
        this.current = 0;

        const errors = [];
        let color = 'red'; // 红先

        // 第一步：把文本拆成独立的走法列表
        const moveList = this._extractMoves(text);

        for (let i = 0; i < moveList.length; i++) {
            const raw = moveList[i];
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

    // 从文本中提取独立的走法列表
    _extractMoves(text) {
        const moves = [];
        // 按行分割
        const lines = text.split(/[\n\r]+/).map(s => s.trim()).filter(Boolean);

        for (const line of lines) {
            // 跳过注释行
            if (line.startsWith('#') || line.startsWith('//') || line.startsWith('{')) continue;

            // 尝试匹配“回合编号 + 红走法 + 黑走法”格式
            // 例如: "1. 炮二平五 马8进7" 或 "1、炮二平五 马8进7" 或 "1)炮二平五 马8进7"
            const roundMatch = line.match(/^\d+[\.\、\)\]]?\s*(.+)$/);
            if (roundMatch) {
                const rest = roundMatch[1].trim();
                // 把剩余部分拆成两个走法（红方 + 黑方）
                const pair = this._splitMovePair(rest);
                if (pair) {
                    if (pair[0]) moves.push(pair[0]);
                    if (pair[1]) moves.push(pair[1]);
                    continue;
                }
            }

            // 没有回合编号，尝试按空格/分号拆成多个走法
            const parts = line.split(/[\s;；]+/).map(s => s.trim()).filter(Boolean);
            for (const part of parts) {
                // 跳过纯数字（孤立的回合编号）
                if (/^\d+[\.\、\)\]]?$/.test(part)) continue;
                moves.push(part);
            }
        }

        return moves;
    }

    // 把一行中的两个走法分开（红方走法 + 黑方走法）
    // 例如 "炮二平五 马8进7" → ["炮二平五", "马8进7"]
    _splitMovePair(text) {
        // 找到第二个棋子名的位置
        const pieceNames = ['帅', '将', '仕', '士', '相', '象', '马', '车', '炮', '兵', '卒', '前', '中', '后'];
        // 从第一个棋子名之后开始找第二个
        let firstEnd = -1;
        for (let i = 0; i < text.length; i++) {
            if (pieceNames.indexOf(text[i]) >= 0) {
                // 找到第一个棋子名，继续找它的数字部分
                if (i + 1 < text.length && /[0-9０-９一二两三四五六七八九]/.test(text[i + 1])) {
                    // 继续找动作（进/退/平）
                    let j = i + 2;
                    while (j < text.length && /[0-9０-９一二两三四五六七八九]/.test(text[j])) j++;
                    if (j < text.length && /[进退平]/.test(text[j])) {
                        // 继续找目标数字
                        j++;
                        while (j < text.length && /[0-9０-９一二两三四五六七八九]/.test(text[j])) j++;
                        firstEnd = j;
                        break;
                    }
                }
            }
        }

        if (firstEnd < 0) return null;

        const first = text.substring(0, firstEnd).trim();
        const rest = text.substring(firstEnd).trim();

        if (!rest) return [first, null];

        // 去掉分隔符（空格等）
        const second = rest.replace(/^[\s;；]+/, '').trim();
        if (!second) return [first, null];

        return [first, second];
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
